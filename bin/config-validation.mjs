const typeOf = (v) =>
  v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v;

/**
 * Validates against the JSON Schema subset used by aquila.json. `unknown` are keys outside the
 * schema: a warning, not a failure — an extra key does not turn CI red after an upgrade.
 */
export function validate(schema, value, path = '', out = { errors: [], unknown: [] }) {
  const at = path || '(root)';
  if (schema.anyOf) {
    if (!schema.anyOf.some((s) => !validate(s, value, path).errors.length))
      out.errors.push(`${at}: invalid format`);
    return out;
  }
  const types = [schema.type ?? []].flat();
  const type = typeOf(value);
  if (types.length && !types.includes(type) && !(type === 'integer' && types.includes('number'))) {
    out.errors.push(`${at}: expected ${types.join(' | ')}, found ${type}`);
    return out;
  }
  const show = (v) => JSON.stringify(v);
  if ('const' in schema && value !== schema.const)
    out.errors.push(`${at}: must be ${show(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value))
    out.errors.push(`${at}: ${show(value)} is not ${schema.enum.map(show).join(' | ')}`);
  if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum)
    out.errors.push(`${at}: ${value} < ${schema.minimum}`);
  if (type === 'array' && schema.items)
    value.forEach((v, i) => validate(schema.items, v, `${path}[${i}]`, out));
  if (type === 'object') {
    const child = (key) => (path ? `${path}.${key}` : key);
    for (const key of (schema.required ?? []).filter((k) => !(k in value)))
      out.errors.push(`${child(key)}: missing`);
    for (const [key, v] of Object.entries(value)) {
      const s = schema.properties?.[key] ?? schema.additionalProperties;
      if (s === false) out.unknown.push(child(key));
      else if (s && s !== true) validate(s, v, child(key), out);
    }
  }
  return out;
}

/** Validates config details JSON Schema cannot express, such as gates referenced by a phase. */
export function checkConfig(schema, cfg) {
  const { errors, unknown } = validate(schema, cfg);
  const legacyWhen = [];
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return { errors, unknown, legacyWhen };
  for (const [name, gate] of Object.entries(cfg.gates ?? {})) {
    if (gate && typeof gate === 'object' && typeof gate.when === 'string') legacyWhen.push(name);
    if (
      gate &&
      typeof gate === 'object' &&
      Array.isArray(gate.when) &&
      (!gate.when.length ||
        gate.when.some((pattern) => typeof pattern !== 'string' || !pattern.trim()))
    ) {
      errors.push(`gates.${name}.when: define at least one non-empty path pattern`);
    }
  }
  for (const [phase, names] of Object.entries(cfg.hooks ?? {})) {
    if (!Array.isArray(names)) continue;
    for (const name of names.filter((n) => !cfg.gates?.[n]))
      errors.push(`hooks.${phase}: gate "${name}" is not in gates`);
  }
  for (const name of (Array.isArray(cfg.done?.gates) ? cfg.done.gates : []).filter(
    (n) => !cfg.gates?.[n],
  ))
    errors.push(`done.gates: gate "${name}" is not in gates`);
  return { errors, unknown, legacyWhen };
}
