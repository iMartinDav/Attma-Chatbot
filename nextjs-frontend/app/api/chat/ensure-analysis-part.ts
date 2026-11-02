// A stopped run may end before the final gate state is written, so saving appends it when the stream never did.
export function ensureAnalysisPart<T>(
  parts: T[],
  hasChecklist: boolean,
  analysisData: unknown,
): Array<T | { type: 'data-analysis'; data: unknown }> {
  if (!hasChecklist) return parts;
  const hasAnalysis = parts.some(
    (part) =>
      part !== null &&
      typeof part === 'object' &&
      (part as { type?: string }).type === 'data-analysis',
  );
  if (hasAnalysis) return parts;
  return [...parts, { type: 'data-analysis', data: analysisData }];
}
