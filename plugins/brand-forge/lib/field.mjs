// Read a dotted path (`"colors.primary"`) out of a plain object.
// Returns `fallback` on any missing/non-object segment. No dependencies.
export function readField(obj, path, fallback = undefined) {
  let cur = obj;
  for (const key of String(path).split('.')) {
    if (cur == null || typeof cur !== 'object' || !(key in cur)) return fallback;
    cur = cur[key];
  }
  return cur === undefined ? fallback : cur;
}

// CLI: `node lib/field.mjs <file.json> <path>` prints the value (empty on miss,
// exit 0) so bash context emitters can extract fields without a JSON parser.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, path] = process.argv.slice(2);
  try {
    const { readFileSync } = await import('node:fs');
    const val = readField(JSON.parse(readFileSync(file, 'utf8')), path, '');
    process.stdout.write(typeof val === 'object' ? JSON.stringify(val) : String(val));
  } catch {
    /* print nothing, exit 0 — bash treats a missing field as empty */
  }
}
