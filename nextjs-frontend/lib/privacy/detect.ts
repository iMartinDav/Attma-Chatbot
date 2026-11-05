/**
 * Deterministic detection of patient identifiers in research text.
 *
 * Rules only, so every hit can be explained and nothing leaves the server to
 * be detected. The set follows HIPAA Safe Harbor where it applies to a
 * genetics workflow (names, record and sample numbers, full dates, ages of 90
 * and over, contact details, national and insurance IDs, addresses, IPs) and
 * adds what generic PII tools miss: MRNs and sample IDs in context, and VCF
 * sample columns. Names are found only after a cue (Patient:, Mr., paciente,
 * Name:), so an uncued name in free text is a known miss of this rules tier.
 *
 * Public reference samples (Coriell NA/GM, 1000 Genomes and GIAB HG) are
 * research identifiers, not patients, and are never masked.
 */

export type PhiType =
  | 'PERSON'
  | 'MRN'
  | 'SAMPLE_ID'
  | 'DOB'
  | 'DATE'
  | 'AGE_90_PLUS'
  | 'PHONE'
  | 'EMAIL'
  | 'NATIONAL_ID'
  | 'INSURANCE_ID'
  | 'IBAN'
  | 'ADDRESS'
  | 'IP_ADDRESS';

export interface PhiSpan {
  start: number;
  end: number;
  type: PhiType;
  value: string;
  rule: string;
}

const PUBLIC_REFERENCE_SAMPLE = /^(?:NA|GM|HG)\d{5}$/i;

const UPPER = 'A-ZÁÉÍÓÚÑÜÀÈÌÒÙÂÊÎÔÛÇÄÖ';
const NAME_WORD = `[${UPPER}][\\p{L}'’-]+(?![\\p{L}\\d])`;
/** One to four capitalised words, optionally "SURNAME, Given". */
const NAME = `${NAME_WORD}(?:,?\\s+${NAME_WORD}){0,3}`;

/** Capitalised words that follow a cue but are not names. */
const NOT_NAMES = new Set([
  'with',
  'presents',
  'presented',
  'has',
  'had',
  'is',
  'was',
  'the',
  'and',
  'con',
  'presenta',
  'tiene',
  'es',
  'el',
  'la',
  'de',
  'del',
  'y',
  'unknown',
  'desconocido',
  'id',
  'number',
  'no',
  'record',
  'name',
  // Field labels and acronyms that often follow a name in a record.
  'mrn',
  'dob',
  'nhc',
  'ssn',
  'dni',
  'nie',
  'nhs',
  'cip',
  'nss',
  'iban',
  'age',
  'sex',
  'male',
  'female',
  'dx',
  'hx',
  'vcf',
  'hpo',
  'phone',
  'tel',
  'email',
  'address',
  'sample',
  'edad',
  'sexo',
  'varón',
  'mujer',
]);

const MONTHS =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
const DATE_EXPR = [
  '\\d{4}-\\d{1,2}-\\d{1,2}',
  '\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}',
  // Dots only with a 4-digit year, so version strings like 3.10.12 stay.
  '\\d{1,2}\\.\\d{1,2}\\.\\d{4}',
  `\\d{1,2}(?:st|nd|rd|th)?\\s+(?:de\\s+)?(?:${MONTHS})\\.?,?\\s+(?:de\\s+)?\\d{4}`,
  `(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}`,
].join('|');

interface Rule {
  name: string;
  type: PhiType;
  /** Must use the `g` flag. Group `v` marks the value; otherwise the whole match. */
  pattern: RegExp;
  validate?: (value: string) => boolean;
}

function validSsn(value: string): boolean {
  const [area, group, serial] = value.split('-');
  return (
    area !== '000' &&
    area !== '666' &&
    !area.startsWith('9') &&
    group !== '00' &&
    serial !== '0000'
  );
}

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
function validSpanishId(value: string): boolean {
  const id = value.toUpperCase();
  const nie = /^[XYZ]/.test(id)
    ? String('XYZ'.indexOf(id[0])) + id.slice(1, 8)
    : id.slice(0, 8);
  return DNI_LETTERS[Number(nie) % 23] === id[8];
}

function validNhsNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 10) return false;
  const sum = [...digits.slice(0, 9)].reduce(
    (total, digit, index) => total + Number(digit) * (10 - index),
    0,
  );
  const check = 11 - (sum % 11);
  return (check === 11 ? 0 : check) === Number(digits[9]) && check !== 10;
}

function validIban(value: string): boolean {
  const iban = value.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) =>
    String(c.charCodeAt(0) - 55),
  );
  let remainder = 0;
  for (const digit of numeric)
    remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

function validDate(value: string): boolean {
  const numeric = value.match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/);
  if (!numeric) return true;
  const [a, b, c] = numeric.slice(1).map(Number);
  if (numeric[1].length === 4) return b >= 1 && b <= 12 && c >= 1 && c <= 31;
  const dayFirst = a >= 1 && a <= 31 && b >= 1 && b <= 12;
  const monthFirst = a >= 1 && a <= 12 && b >= 1 && b <= 31;
  return dayFirst || monthFirst;
}

const RULES: Rule[] = [
  {
    name: 'email',
    type: 'EMAIL',
    pattern: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
  },
  {
    name: 'dob-cued',
    type: 'DOB',
    pattern: new RegExp(
      `\\b(?:DOB|D\\.O\\.B\\.?|date of birth|birth ?date|born(?: on)?|fecha de nacimiento|f\\. ?nac\\.?|nacid[oa] (?:el )?)\\s*[:#-]?\\s*(?<v>${DATE_EXPR})`,
      'giu',
    ),
  },
  {
    name: 'date',
    type: 'DATE',
    pattern: new RegExp(`\\b(?<v>${DATE_EXPR})\\b`, 'giu'),
    validate: validDate,
  },
  {
    name: 'age-90-plus',
    type: 'AGE_90_PLUS',
    pattern:
      /\b(?<v>(?:9\d|1[0-1]\d))(?=\s*(?:-|\s)?(?:years?[- ]old|y\/?o\b|yo\b|years? of age|años|a\.)|\s*(?:years?|años)\b)/giu,
  },
  {
    name: 'mrn-cued',
    type: 'MRN',
    pattern:
      /\b(?:MRN|medical record(?: number| no\.?)?|record (?:number|no\.?)|hospital (?:number|no\.?)|chart (?:number|no\.?)|patient id|pt\.? id|NHC|n\.?[ºo°]?\s*(?:de )?historia(?: cl[ií]nica)?|historia cl[ií]nica)\s*[:#-]?\s*(?<v>[A-Z0-9][A-Z0-9-]{3,})/giu,
    validate: (v) => /\d{3,}/.test(v),
  },
  {
    name: 'sample-cued',
    type: 'SAMPLE_ID',
    pattern:
      /\b(?:sample(?: id)?|specimen(?: id)?|biobank(?: id)?|subject(?: id)?|participant(?: id)?|family(?: id)?|muestra|id de muestra)\s*[:#-]?\s*(?<v>[A-Z][A-Z0-9_-]{2,}\d[A-Z0-9_-]*|\d{4,}[A-Z0-9_-]*)/giu,
    validate: (v) => !PUBLIC_REFERENCE_SAMPLE.test(v),
  },
  {
    name: 'insurance-cued',
    type: 'INSURANCE_ID',
    pattern:
      /\b(?:member id|insurance (?:id|number|no\.?)|policy (?:number|no\.?)|n\.?[ºo°]? de afiliaci[oó]n|NSS|tarjeta sanitaria|CIP)\s*[:#-]?\s*(?<v>[A-Z0-9][A-Z0-9-]{4,})/giu,
    validate: (v) => /\d{3,}/.test(v),
  },
  {
    name: 'ssn',
    type: 'NATIONAL_ID',
    pattern: /\b(?<v>\d{3}-\d{2}-\d{4})\b/g,
    validate: validSsn,
  },
  {
    name: 'dni-nie',
    type: 'NATIONAL_ID',
    pattern: /\b(?<v>[XYZ]?\d{7,8}[A-Z])\b/g,
    validate: (v) => v.length === 9 && validSpanishId(v),
  },
  {
    name: 'nhs-number',
    type: 'NATIONAL_ID',
    pattern:
      /\bNHS(?: number| no\.?)?\s*[:#-]?\s*(?<v>\d{3}\s?\d{3}\s?\d{4})\b/giu,
    validate: validNhsNumber,
  },
  {
    name: 'iban',
    type: 'IBAN',
    pattern:
      /\b(?<v>[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?)\b/g,
    validate: validIban,
  },
  {
    name: 'phone',
    type: 'PHONE',
    pattern:
      /(?<v>\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}|\(\d{3}\)\s?\d{3}[\s.-]\d{4}|\b\d{3}[.-]\d{3}[.-]\d{4}\b)/g,
  },
  {
    name: 'phone-cued',
    type: 'PHONE',
    pattern:
      /\b(?:phone|tel(?:éfono|efono)?\.?|móvil|movil|mobile|cell|fax)\s*[:#-]?\s*(?<v>\d[\d\s.-]{6,16}\d)/giu,
  },
  {
    name: 'ipv4',
    type: 'IP_ADDRESS',
    pattern:
      /\b(?<v>(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d))\b/g,
  },
  {
    name: 'address-cued',
    type: 'ADDRESS',
    pattern:
      /\b(?:address|addr\.?|home address|direcci[oó]n|domicilio)\s*[:#-]\s*(?<v>[^\n;]{6,80}?)(?=\s*(?:\n|;|$|\.\s))/giu,
  },
  {
    name: 'street',
    type: 'ADDRESS',
    pattern: new RegExp(
      `\\b(?<v>\\d{1,5}\\s+${NAME_WORD}(?:\\s+${NAME_WORD})?\\s+(?:Street|St\\.?|Avenue|Ave\\.?|Road|Rd\\.?|Boulevard|Blvd\\.?|Lane|Ln\\.?|Drive|Way|Court|Ct\\.?))\\b`,
      'gu',
    ),
  },
];

/** The cue is matched case-insensitively; the name after it must be capitalised. */
const PERSON_CUE =
  /\b(?:patient(?: name)?|pt\.?|proband|probando|paciente|name|nombre|full name|nombre completo|mother|father|madre|padre|mr|mrs|ms|miss|mx|dr|sr|sra|srta|don|doña)\.?\s*[:-]?\s+/giu;
const PERSON_NAME = new RegExp(NAME, 'uy');

function trimName(value: string): string | null {
  const words = value.split(/\s+/);
  const kept: string[] = [];
  for (const word of words) {
    const bare = word.replace(/[,]/g, '');
    if (NOT_NAMES.has(bare.toLowerCase())) break;
    kept.push(word);
  }
  const name = kept.join(' ').replace(/,$/, '');
  return name.length >= 2 ? name : null;
}

function vcfSampleSpans(text: string): PhiSpan[] {
  const spans: PhiSpan[] = [];
  const header =
    /^#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t(.+)$/gm;
  for (const match of text.matchAll(header)) {
    let offset = (match.index ?? 0) + match[0].length - match[1].length;
    for (const sample of match[1].split('\t')) {
      const value = sample.trim();
      if (value && !PUBLIC_REFERENCE_SAMPLE.test(value)) {
        spans.push({
          start: offset,
          end: offset + sample.length,
          type: 'SAMPLE_ID',
          value,
          rule: 'vcf-header',
        });
      }
      offset += sample.length + 1;
    }
  }
  for (const match of text.matchAll(/##SAMPLE=<ID=([^,>]+)/g)) {
    const value = match[1];
    if (PUBLIC_REFERENCE_SAMPLE.test(value)) continue;
    const start = (match.index ?? 0) + match[0].length - value.length;
    spans.push({
      start,
      end: start + value.length,
      type: 'SAMPLE_ID',
      value,
      rule: 'vcf-meta',
    });
  }
  return spans;
}

function personSpans(text: string): PhiSpan[] {
  const spans: PhiSpan[] = [];
  for (const cue of text.matchAll(PERSON_CUE)) {
    PERSON_NAME.lastIndex = (cue.index ?? 0) + cue[0].length;
    const found = PERSON_NAME.exec(text);
    const value = found ? trimName(found[0]) : null;
    if (!found || !value) continue;
    spans.push({
      start: found.index,
      end: found.index + value.length,
      type: 'PERSON',
      value,
      rule: 'person-cued',
    });
  }
  return spans;
}

function ruleSpans(text: string): PhiSpan[] {
  const spans: PhiSpan[] = [];
  for (const rule of RULES) {
    for (const match of text.matchAll(rule.pattern)) {
      let value = match.groups?.v ?? match[0];
      value = value.trim();
      if (!value || (rule.validate && !rule.validate(value))) continue;
      const base = match.index ?? 0;
      const offset = match[0].lastIndexOf(value);
      const start = base + (offset >= 0 ? offset : 0);
      spans.push({
        start,
        end: start + value.length,
        type: rule.type,
        value,
        rule: rule.name,
      });
    }
  }
  return spans;
}

/** Earlier and longer spans win; a cued DOB beats the plain date rule on the same text. */
function resolve(spans: PhiSpan[]): PhiSpan[] {
  const priority = (s: PhiSpan) =>
    s.type === 'DOB' ? 0 : s.type === 'DATE' ? 2 : 1;
  const sorted = [...spans].sort(
    (a, b) => a.start - b.start || priority(a) - priority(b) || b.end - a.end,
  );
  const kept: PhiSpan[] = [];
  for (const span of sorted) {
    const last = kept.at(-1);
    if (last && span.start < last.end) {
      if (
        priority(span) < priority(last) ||
        (priority(span) === priority(last) && span.end > last.end)
      ) {
        kept[kept.length - 1] = span;
      }
      continue;
    }
    kept.push(span);
  }
  return kept;
}

export function detectPhi(text: string): PhiSpan[] {
  if (!text) return [];
  return resolve([
    ...vcfSampleSpans(text),
    ...ruleSpans(text),
    ...personSpans(text),
  ]);
}
