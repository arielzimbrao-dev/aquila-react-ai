/**
 * Simple glob: `*` and `?` within a segment, `**` any depth, `{a,b}` alternatives. As in .gitignore, a glob
 * that matches a folder matches what is inside it (`src`, `src/`, `./src/**`).
 */
export function globToRegex(glob) {
  const body = glob
    .replace(/^\.\//, '')
    .replace(/\/+$/, '')
    .replaceAll(/[.+^$()|[\]\\]/g, '\\$&')
    .replaceAll('**/', '\u0000')
    .replaceAll('**', '\u0001')
    .replaceAll('*', '[^/]*')
    .replaceAll('?', '[^/]')
    .replaceAll(/\{([^{}]*)\}/g, (_, alts) => `(?:${alts.split(',').join('|')})`)
    .replaceAll('\u0000', '(?:.*/)?')
    .replaceAll('\u0001', '.*');
  return new RegExp(`^${body}(?:/.*)?$`);
}

/** Comma-separated glob list (`applyTo`) without splitting the commas of `{a,b}`. */
export const splitGlobs = (list) =>
  list
    .split(/,(?![^{]*\})/)
    .map((g) => g.trim())
    .filter(Boolean);
