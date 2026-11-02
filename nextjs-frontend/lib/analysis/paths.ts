export type PathResult = { found: true; value: unknown } | { found: false };

// Paths come from the model, so resolution must fail closed and never throw on malformed input.
export function resolvePath(root: unknown, path: string): PathResult {
  if (typeof path !== 'string' || path.trim() === '') return { found: false };
  const tokens = parsePath(path);
  if (!tokens) return { found: false };

  let current: unknown = root;
  for (const token of tokens) {
    if (typeof token === 'number') {
      if (!Array.isArray(current) || token >= current.length)
        return { found: false };
      current = current[token];
    } else if (Array.isArray(current) && /^\d+$/.test(token)) {
      const index = Number(token);
      if (index >= current.length) return { found: false };
      current = current[index];
    } else if (
      current !== null &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      Object.prototype.hasOwnProperty.call(current, token)
    ) {
      current = (current as Record<string, unknown>)[token];
    } else {
      return { found: false };
    }
  }
  return { found: true, value: current };
}

function parsePath(path: string): Array<string | number> | null {
  const tokens: Array<string | number> = [];
  let index = 0;
  while (index < path.length) {
    if (path[index] === '.') {
      // A leading or doubled dot would mean an empty segment, which cannot resolve.
      if (
        tokens.length === 0 ||
        path[index + 1] === '.' ||
        index === path.length - 1
      ) {
        return null;
      }
      index++;
      continue;
    }
    if (path[index] === '[') {
      const close = path.indexOf(']', index);
      if (close === -1) return null;
      const inside = path.slice(index + 1, close);
      if (!/^\d+$/.test(inside)) return null;
      tokens.push(Number(inside));
      index = close + 1;
      continue;
    }
    const match = /^[^.[\]]+/.exec(path.slice(index));
    if (!match) return null;
    tokens.push(match[0]);
    index += match[0].length;
  }
  return tokens.length > 0 ? tokens : null;
}
