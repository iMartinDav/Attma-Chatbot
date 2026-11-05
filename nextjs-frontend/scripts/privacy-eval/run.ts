/**
 * Privacy guard evaluation on synthetic clinical-genetics text.
 *
 *   bun scripts/privacy-eval/run.ts
 *
 * Every person, number and record is generated here from fixed lists and a
 * seeded random generator; nothing comes from a real patient. Three sets:
 *
 * - planted: notes in English and Spanish with identifiers after the cues a
 *   clinician writes (Patient:, MRN, DOB, NHC). Scored by leak rate: a planted
 *   value still readable after masking, in full or in part (a surname alone).
 * - research: genetics text with no identifiers (genes, HGVS, rsIDs,
 *   coordinates, versions, public reference samples). Scored by over-masking.
 * - uncued: names in free text with no cue. This rules tier is expected to
 *   miss them; the set measures that gap instead of hiding it.
 *
 * These are development numbers: the rules and the templates were written by
 * the same people, so they describe coverage of the patterns, not performance
 * on real clinical notes.
 */
import { detectPhi } from '../../lib/privacy/detect';
import { PrivacyVault } from '../../lib/privacy/vault';

let seed = 20261105;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32;
  return seed / 2 ** 32;
}
const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)];
const digits = (n: number) =>
  Array.from({ length: n }, () => Math.floor(rand() * 10)).join('');

const GIVEN = [
  'Maria',
  'Lucía',
  'Ahmed',
  'Grace',
  'Tomasz',
  'Aiyana',
  'Kenji',
  'Olusegun',
  'Inés',
  'Hannah',
  'Mateo',
  'Priya',
];
const FAMILY = [
  'Lopez',
  'Fernández',
  'Okafor',
  'Nowak',
  'Tanaka',
  'Haddad',
  'Martín',
  'Schmidt',
  'Rossi',
  'Iyer',
  'Duarte',
  'Novak',
];
const STREETS = [
  'Calle Mayor',
  'Avenida del Puerto',
  'Elm Street',
  'Rue des Lilas',
];
const MONTHS_EN = ['January', 'March', 'May', 'July', 'October', 'December'];
const MONTHS_ES = ['enero', 'marzo', 'mayo', 'julio', 'octubre', 'diciembre'];
const GENES = [
  'SCN1A p.Arg1648His',
  'KCNQ2 c.881C>T',
  'CDKL5 p.Arg178Trp',
  'STXBP1 c.1162C>T',
  'MECP2 p.Thr158Met',
];

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
function dni(): string {
  const n = digits(8);
  return n + DNI_LETTERS[Number(n) % 23];
}
function ssn(): string {
  return `${100 + Math.floor(rand() * 500)}-${10 + Math.floor(rand() * 89)}-${1000 + Math.floor(rand() * 8999)}`;
}

interface Planted {
  text: string;
  values: Array<{ type: string; value: string }>;
}

function plantedNote(): Planted {
  const given = pick(GIVEN);
  const family = pick(FAMILY);
  const name = `${given} ${family}`;
  const mrn = digits(8);
  const day = 1 + Math.floor(rand() * 27);
  const year = 1950 + Math.floor(rand() * 70);
  const phone = `+34 6${digits(2)} ${digits(3)} ${digits(3)}`;
  const email = `${given.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')}.${family.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')}@example-hospital.org`;
  const sample = `FAM${digits(2)}-P${digits(3)}`;
  const gene = pick(GENES);
  const spanish = rand() < 0.4;

  if (spanish) {
    const dob = `${day} de ${pick(MONTHS_ES)} de ${year}`;
    const id = dni();
    return {
      text: `Paciente: ${name}. NHC ${mrn}. Fecha de nacimiento: ${dob}. DNI ${id}. Teléfono ${phone}. Muestra ${sample} con ${gene}; ${family} presenta crisis febriles.`,
      values: [
        { type: 'PERSON', value: name },
        { type: 'MRN', value: mrn },
        { type: 'DOB', value: dob },
        { type: 'NATIONAL_ID', value: id },
        { type: 'PHONE', value: phone },
        { type: 'SAMPLE_ID', value: sample },
      ],
    };
  }
  const dob = `${pick(MONTHS_EN)} ${day}, ${year}`;
  const id = ssn();
  const street = `${1 + Math.floor(rand() * 400)} ${pick(STREETS.filter((s) => /Street/.test(s)))}`;
  return {
    text: `Patient Name: ${name}\nMRN: ${mrn}\nDOB: ${dob}\nSSN ${id}\nEmail ${email}\nlives at ${street} today.\nSample ID: ${sample}. Proband carries ${gene}. Mr. ${family} reports seizures since infancy.`,
    values: [
      { type: 'PERSON', value: name },
      { type: 'MRN', value: mrn },
      { type: 'DOB', value: dob },
      { type: 'NATIONAL_ID', value: id },
      { type: 'EMAIL', value: email },
      { type: 'ADDRESS', value: street },
      { type: 'SAMPLE_ID', value: sample },
    ],
  };
}

const RESEARCH = [
  'SCN1A p.Arg1648His (NM_001165963.4:c.4943G>A) ranks first, CADD 28.6, absent from gnomAD.',
  'rs121918623 at chr2:166848646 on GRCh38; ClinVar lists it as pathogenic.',
  'Compare NA12878, HG002 and HG005 from Genome in a Bottle against the truth set.',
  'Cluster PBMC 3k with scanpy 1.10.2 (python 3.10.12), Leiden resolution 0.5, 2,700 cells.',
  'An 18-month-old with febrile seizures, hypotonia and developmental delay (HP:0002373, HP:0001252).',
  'Run g:Profiler on MS4A1 CD79A CD79B; Reactome R-HSA-983705 is the top term, p = 1.2e-8.',
  'AlphaFold pLDDT 92 at residue 1648; UniProt P35498 domain IV, segment S4.',
  'Held-out benchmark: top-1 50.5%, top-5 63% on 200 phenopacket cases, HPO release 2026.',
  'KCNQ2 encephalopathy; consider a Patient-reported outcome measure for seizure burden.',
  'TP53 R175H is a hotspot; see PMID 12345678 and the IARC TP53 database.',
  'Filter variants with QUAL > 30 and DP >= 10 in the trio VCF, then annotate with VEP 113.',
  'Name the gene behind Dravet syndrome and the protein domain most often affected.',
];

function uncuedNote(): Planted {
  const name = `${pick(GIVEN)} ${pick(FAMILY)}`;
  return {
    text: `${name} came back to clinic after the third seizure; we discussed the SCN1A result with her parents.`,
    values: [{ type: 'PERSON', value: name }],
  };
}

function leaked(
  masked: string,
  value: string,
): { full: boolean; partial: boolean } {
  const lower = masked.toLowerCase();
  const full = lower.includes(value.toLowerCase());
  const parts = value.split(/[\s,]+/).filter((p) => p.length >= 4);
  const partial =
    !full &&
    parts.some((p) =>
      new RegExp(`(?<![\\p{L}\\d])${p}(?![\\p{L}\\d])`, 'iu').test(masked),
    );
  return { full, partial };
}

function scoreLeaks(notes: Planted[]) {
  const byType = new Map<string, { total: number; caught: number }>();
  let values = 0;
  let fullLeaks = 0;
  let partialLeaks = 0;
  let notesFullyProtected = 0;
  for (const note of notes) {
    const masked = new PrivacyVault().mask(note.text);
    let clean = true;
    for (const { type, value } of note.values) {
      values += 1;
      const stat = byType.get(type) ?? { total: 0, caught: 0 };
      stat.total += 1;
      const { full, partial } = leaked(masked, value);
      if (full) fullLeaks += 1;
      else if (partial) partialLeaks += 1;
      if (!full && !partial) stat.caught += 1;
      else clean = false;
      byType.set(type, stat);
    }
    if (clean) notesFullyProtected += 1;
  }
  return {
    notes: notes.length,
    values,
    fullLeaks,
    partialLeaks,
    notesFullyProtected,
    byType,
  };
}

const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(1)}%`;

const planted = Array.from({ length: 300 }, plantedNote);
const uncued = Array.from({ length: 100 }, uncuedNote);

const p = scoreLeaks(planted);
console.log(
  `\nPlanted identifiers (cued), ${p.notes} notes, ${p.values} values`,
);
console.log(
  `  leaked in full:     ${p.fullLeaks} (${pct(p.fullLeaks, p.values)})`,
);
console.log(
  `  leaked in part:     ${p.partialLeaks} (${pct(p.partialLeaks, p.values)})`,
);
console.log(
  `  notes fully clean:  ${p.notesFullyProtected} (${pct(p.notesFullyProtected, p.notes)})`,
);
for (const [type, stat] of [...p.byType].sort()) {
  console.log(
    `  ${type.padEnd(12)} recall ${pct(stat.caught, stat.total)} (${stat.caught}/${stat.total})`,
  );
}

let maskedSentences = 0;
let maskedChars = 0;
let totalChars = 0;
const overMasked: string[] = [];
for (const sentence of RESEARCH) {
  const spans = detectPhi(sentence);
  totalChars += sentence.length;
  if (spans.length > 0) {
    maskedSentences += 1;
    overMasked.push(
      `${spans.map((s) => `${s.type}:"${s.value}"`).join(', ')} in "${sentence.slice(0, 60)}..."`,
    );
  }
  maskedChars += spans.reduce((n, s) => n + (s.end - s.start), 0);
}
console.log(
  `\nResearch text without identifiers, ${RESEARCH.length} sentences`,
);
console.log(
  `  sentences with any mask: ${maskedSentences} (${pct(maskedSentences, RESEARCH.length)})`,
);
console.log(`  characters masked:       ${pct(maskedChars, totalChars)}`);
for (const line of overMasked) console.log(`  over-masked: ${line}`);

const u = scoreLeaks(uncued);
console.log(
  `\nUncued names in free text (known gap of the rules tier), ${u.values} names`,
);
console.log(
  `  caught: ${u.values - u.fullLeaks - u.partialLeaks} (${pct(u.values - u.fullLeaks - u.partialLeaks, u.values)})`,
);
console.log(
  '\nDevelopment numbers on synthetic text; not a measure on real clinical notes.\n',
);
