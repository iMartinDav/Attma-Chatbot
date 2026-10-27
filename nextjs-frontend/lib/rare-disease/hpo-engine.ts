/**
 * Local phenotype engine: HPO term resolution and disease ranking by Resnik
 * semantic similarity (Köhler et al. 2009), computed in-process from the HPO
 * release compiled by scripts/rare-disease-engine/build_hpo_index.py.
 *
 * Pairwise similarity is the information content of the most informative common
 * ancestor (MICA). A disease's score combines the patient's best matches into the
 * disease ('patient' = patient→disease average, as in Phenomizer) or both directions
 * ('symmetric' = best-match average).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface HpoIndexFile {
  version: string;
  terms: string[];
  names: string[];
  synonyms: string[];
  parents: number[][];
  ic: number[];
  alias: Record<string, number>;
  diseases: { id: string; name: string; terms: number[]; genes: string[] }[];
}

export type SimilarityMode = 'patient' | 'symmetric';

export interface EngineTerm {
  id: string;
  label: string;
}

export interface EngineDisease {
  id: string;
  name: string;
  score: number;
  genes: string[];
}

/** The shipped index; a static path, so only this file is traced for deployment. */
const INDEX_PATH = join(process.cwd(), 'lib/rare-disease/data/hpo-index.json');

/** HPO_INDEX_PATH lets the benchmark load its held-out evaluation index instead. */
function readIndex(): string {
  const override = process.env.HPO_INDEX_PATH;
  return override
    ? readFileSync(/*turbopackIgnore: true*/ override, 'utf8')
    : readFileSync(INDEX_PATH, 'utf8');
}

class HpoEngine {
  readonly version: string;
  private readonly ids: string[];
  private readonly names: string[];
  private readonly ic: Float64Array;
  private readonly ancestors: Int32Array[];
  private readonly byId = new Map<string, number>();
  private readonly byLabel = new Map<string, number>();
  private readonly searchable: { index: number; text: string }[] = [];
  private readonly diseases: HpoIndexFile['diseases'];

  constructor(file: HpoIndexFile) {
    this.version = file.version;
    this.ids = file.terms;
    this.names = file.names;
    this.ic = Float64Array.from(file.ic);
    this.diseases = file.diseases;

    file.terms.forEach((id, i) => this.byId.set(id, i));
    for (const [id, i] of Object.entries(file.alias)) this.byId.set(id, i);

    file.terms.forEach((_, i) => {
      const labels = [file.names[i], ...file.synonyms[i].split('|')].filter(
        Boolean,
      );
      for (const label of labels) {
        const key = normalize(label);
        if (!this.byLabel.has(key)) this.byLabel.set(key, i);
        this.searchable.push({ index: i, text: key });
      }
    });

    const closures: (Int32Array | undefined)[] = new Array(file.terms.length);
    const closure = (i: number): Int32Array => {
      const cached = closures[i];
      if (cached) return cached;
      const set = new Set<number>([i]);
      for (const p of file.parents[i]) for (const a of closure(p)) set.add(a);
      const result = Int32Array.from(set);
      closures[i] = result;
      return result;
    };
    this.ancestors = file.terms.map((_, i) => closure(i));
  }

  /** Resolves an HPO ID (including obsolete and alternative IDs) or a free-text label. */
  resolve(hpoId: string | undefined, label: string): EngineTerm | null {
    const index =
      (hpoId ? this.byId.get(hpoId.trim()) : undefined) ??
      this.byLabel.get(normalize(label)) ??
      this.search(label);
    return index == null
      ? null
      : { id: this.ids[index], label: this.names[index] };
  }

  /**
   * Text search over labels and synonyms: the label matching the most query
   * words wins (shorter labels break ties). Plurals are folded and common
   * modifiers ignored, so "mild hypotonia" or "focal seizures with hemiclonic
   * jerks" still resolve.
   */
  private search(label: string): number | undefined {
    const words = [
      ...new Set(
        normalize(label)
          .split(' ')
          .filter(
            (w) => (w.length > 2 || /\d/.test(w)) && !IGNORED_WORDS.has(w),
          )
          .map(stem),
      ),
    ];
    if (words.length === 0) return undefined;
    let best:
      | { index: number; matched: number; coverage: number; length: number }
      | undefined;
    for (const { index, text } of this.searchable) {
      const padded = ` ${text} `;
      let matched = 0;
      for (const w of words) {
        // Short tokens such as "7" must match a whole word, not a substring.
        if (w.length > 3 ? text.includes(w) : padded.includes(` ${w} `)) {
          matched++;
        }
      }
      if (matched === 0) continue;
      // Prefer labels the query explains fully: "decreased cholesterol" beats
      // "decreased hdl cholesterol" for "low total cholesterol".
      const coverage = matched / text.split(' ').length;
      if (
        !best ||
        matched > best.matched ||
        (matched === best.matched &&
          (coverage > best.coverage ||
            (coverage === best.coverage && text.length < best.length)))
      ) {
        best = { index, matched, coverage, length: text.length };
      }
    }
    if (!best) return undefined;
    const enough =
      words.length <= 2 ? best.matched === words.length : best.matched >= 2;
    return enough && best.matched / words.length >= 0.5
      ? best.index
      : undefined;
  }

  rankDiseases(
    termIds: string[],
    limit: number,
    mode: SimilarityMode = 'patient',
  ): EngineDisease[] {
    const given = [
      ...new Set(
        termIds
          .map((id) => this.byId.get(id))
          .filter((i): i is number => i != null),
      ),
    ];
    // Keep the most specific terms: drop any term that is an ancestor of another.
    const patient = given.filter(
      (p) => !given.some((q) => q !== p && this.ancestors[q].includes(p)),
    );
    if (patient.length === 0) return [];

    const termCount = this.ids.length;
    const mica = patient.map((p) => {
      const isAncestor = new Uint8Array(termCount);
      for (const a of this.ancestors[p]) isAncestor[a] = 1;
      const row = new Float64Array(termCount);
      for (let t = 0; t < termCount; t++) {
        let best = 0;
        for (const a of this.ancestors[t]) {
          if (isAncestor[a] && this.ic[a] > best) best = this.ic[a];
        }
        row[t] = best;
      }
      return row;
    });

    const scored = this.diseases.map((disease) => {
      let patientSide = 0;
      for (const row of mica) {
        let best = 0;
        for (const t of disease.terms) if (row[t] > best) best = row[t];
        patientSide += best;
      }
      patientSide /= mica.length;

      let score = patientSide;
      if (mode === 'symmetric') {
        let diseaseSide = 0;
        for (const t of disease.terms) {
          let best = 0;
          for (const row of mica) if (row[t] > best) best = row[t];
          diseaseSide += best;
        }
        score = (patientSide + diseaseSide / disease.terms.length) / 2;
      }
      return { disease, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(({ disease, score }) => ({
      id: disease.id,
      name: disease.name,
      score: Math.round(score * 1000) / 1000,
      genes: disease.genes,
    }));
  }
}

const IGNORED_WORDS = new Set([
  'and',
  'with',
  'the',
  'some',
  'mild',
  'moderate',
  'severe',
  'repeated',
  'recurrent',
  'frequent',
  'occasional',
  'episodes',
  'now',
  'history',
]);

function stem(word: string): string {
  if (word.length <= 4) return word;
  return word.replace(/ies$/, 'y').replace(/s$/, '');
}

// Clinical shorthand and HPO wording differ ("raised" vs "Elevated"); both
// labels and queries fold these words to one form before matching.
const SAME_MEANING: [RegExp, string][] = [
  [/\b(raised|elevated|high|increased)\b/g, 'increased'],
  [/\b(low|reduced|lowered|decreased)\b/g, 'decreased'],
];

function normalize(text: string): string {
  let result = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  for (const [pattern, word] of SAME_MEANING) {
    result = result.replace(pattern, word);
  }
  return result.trim();
}

let engine: HpoEngine | undefined;

/** Loads the HPO index once per process (about 0.3 s, then cached). */
export function getHpoEngine(): HpoEngine {
  engine ??= new HpoEngine(JSON.parse(readIndex()) as HpoIndexFile);
  return engine;
}
