// Input QC runs before any ranking, so a report can never be built on an empty or malformed variant list.
export interface QcResult {
  status: 'pass' | 'warn' | 'fail';
  total: number;
  genomic: number;
  problems: string[];
  warnings: string[];
}

const GENOMIC = /^(\d{1,2}|X|Y|M|MT)-(\d+)-([ACGT]+)-([ACGT]+)$/i;
const RSID = /^rs\d+$/i;
// Identifiers must look like real accessions or HGVS, so free text with a colon or a dot cannot slip through as one.
const ACCESSION = /^[A-Za-z]{1,4}_?\d+\.\d+$/;
const HGVS = /^[A-Za-z][\w.-]*:(c|g|m|n|p|r)\.[A-Za-z0-9_+\-*?[\]=>]+$/;
const PROTEIN_CHANGE = /^[A-Za-z]{1,4}\d+\.?\d*:p\.[A-Za-z]{3}\d+[A-Za-z]{3}$/;
const MAX_VARIANTS = 200;

// A genomic coordinate must name a real chromosome and valid alleles, or VEP annotation downstream is meaningless.
function classify(variant: string): 'genomic' | 'identifier' | 'invalid' {
  const match = GENOMIC.exec(variant);
  if (match) {
    const chr = match[1].toUpperCase();
    const numeric = Number(chr);
    const chrOk =
      chr === 'X' ||
      chr === 'Y' ||
      chr === 'M' ||
      chr === 'MT' ||
      (Number.isInteger(numeric) && numeric >= 1 && numeric <= 22);
    return chrOk && Number(match[2]) > 0 ? 'genomic' : 'invalid';
  }
  if (RSID.test(variant) || ACCESSION.test(variant) || HGVS.test(variant)) {
    return 'identifier';
  }
  if (PROTEIN_CHANGE.test(variant)) return 'identifier';
  return 'invalid';
}

export function checkVariantInput(variants: string[]): QcResult {
  const problems: string[] = [];
  const warnings: string[] = [];
  // Duplicates would count twice toward the cap and in ranking, so the list is deduplicated before anything is counted.
  const seen = new Set<string>();
  const list = variants
    .map((v) => v.trim())
    .filter((v) => v !== '')
    .filter((v) => {
      const key = v.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (list.length === 0) {
    problems.push('No candidate variants were given. Provide at least one.');
  }
  if (list.length > MAX_VARIANTS) {
    problems.push(
      `Too many variants: ${list.length}. The ranker takes at most ${MAX_VARIANTS}; prefilter first.`,
    );
  }
  let genomic = 0;
  for (const variant of list) {
    const kind = classify(variant);
    if (kind === 'genomic') genomic += 1;
    if (kind === 'invalid') {
      problems.push(
        `Variant "${variant}" is not a GRCh38 chr-pos-ref-alt coordinate, an rsID, or an HGVS/protein identifier.`,
      );
    }
  }
  if (list.length > 0 && genomic === 0 && problems.length === 0) {
    warnings.push(
      'No GRCh38 chr-pos-ref-alt coordinates: every variant is an identifier, so annotation depends on identifier lookup.',
    );
  } else if (genomic > 0 && genomic < list.length) {
    warnings.push(
      `${list.length - genomic} of ${list.length} variants are identifiers, not GRCh38 coordinates.`,
    );
  }
  const status =
    problems.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass';
  return { status, total: list.length, genomic, problems, warnings };
}

// Coverage is checked on the annotation result itself, because a ranking with no annotated variants proves nothing.
export function checkAnnotationCoverage(output: unknown): QcResult {
  const record =
    output !== null && typeof output === 'object'
      ? (output as Record<string, unknown>)
      : {};
  const variants = Array.isArray(record.variants) ? record.variants : [];
  const notAnnotated = Array.isArray(record.notAnnotated)
    ? record.notAnnotated
    : [];
  const total = variants.length + notAnnotated.length;
  const problems: string[] = [];
  const warnings: string[] = [];
  if (total === 0) {
    problems.push('Annotation returned no variants at all.');
  } else if (variants.length === 0) {
    problems.push(
      `Annotation covered none of the ${total} variants (wrong build or unrecognised identifiers).`,
    );
  } else if (notAnnotated.length > 0) {
    warnings.push(
      `${notAnnotated.length} of ${total} variants were not annotated.`,
    );
  }
  const status =
    problems.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass';
  return { status, total, genomic: variants.length, problems, warnings };
}
