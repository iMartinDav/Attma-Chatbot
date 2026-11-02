import type { ToolSet } from 'ai';
import type { AnalysisSession } from './session';

// Only plain objects can carry the extra ref field without changing what callers and cards expect.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function withCapture(
  tools: ToolSet,
  session: AnalysisSession,
  names: string[],
): ToolSet {
  const wanted = new Set(names);
  const wrapped: ToolSet = {};
  for (const [name, tool] of Object.entries(tools)) {
    if (!wanted.has(name) || typeof tool.execute !== 'function') {
      wrapped[name] = tool;
      continue;
    }
    const execute = tool.execute;
    wrapped[name] = {
      ...tool,
      execute: async (
        input: Parameters<typeof execute>[0],
        options: Parameters<typeof execute>[1],
      ) => {
        const output: unknown = await execute(input, options);
        if (!isPlainObject(output)) return output;
        const ref = session.captureResult(name, output);
        return { ...output, ref };
      },
    };
  }
  return wrapped;
}
