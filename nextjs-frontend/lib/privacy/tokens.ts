/**
 * Placeholder tokens for protected identifiers, shared by the server (which
 * issues them) and the browser (which shows the real values again). Safe to
 * import on the client: no detection, no Node APIs.
 */

/** `[[PERSON_1]]`, `[[MRN_2]]`, `[[SAMPLE_ID_1]]`. */
export const TOKEN_PATTERN = /\[\[([A-Z][A-Z0-9_]*?)_(\d+)\]\]/g;

export function formatToken(type: string, index: number): string {
  return `[[${type}_${index}]]`;
}

export interface PrivacyEntry {
  token: string;
  type: string;
  value: string;
}

/** What the browser receives per assistant message: the run's tokens and counts. */
export interface PrivacySummary {
  /** Detection method, so a saved chat says which rules protected it. */
  method: string;
  entries: PrivacyEntry[];
  counts: Record<string, number>;
  /** Attachments sent to a model as files, which this tier cannot scan. */
  unscannedFiles: number;
}

/** Put the real values back for display. Unknown tokens are left as written. */
export function restoreTokens(
  text: string,
  values: Map<string, string>,
): string {
  if (!text || values.size === 0) return text;
  return text.replace(TOKEN_PATTERN, (token) => values.get(token) ?? token);
}

export const PRIVACY_TYPE_LABELS: Record<string, string> = {
  PERSON: 'name',
  MRN: 'record number',
  SAMPLE_ID: 'sample ID',
  DOB: 'date of birth',
  DATE: 'date',
  AGE_90_PLUS: 'age over 89',
  PHONE: 'phone',
  EMAIL: 'email',
  NATIONAL_ID: 'national ID',
  INSURANCE_ID: 'insurance ID',
  IBAN: 'bank account',
  ADDRESS: 'address',
  IP_ADDRESS: 'IP address',
};
