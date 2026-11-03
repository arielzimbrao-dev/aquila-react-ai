/** Simple glob: `*` matches one segment, `**` any depth. */
export function globToRegex(glob) {
  return new RegExp(
    '^' +
      glob
        .replaceAll(/[.+^${}()|[\]\\]/g, '\\$&')
        .replaceAll('**/', '\u0000')
        .replaceAll('**', '\u0001')
        .replaceAll('*', '[^/]*')
        .replaceAll('\u0000', '(?:.*/)?')
        .replaceAll('\u0001', '.*') +
      '$',
  );
}
