// Brand profile: load, validate, and resolve the active brand.
// Reads plain files from the USER's repo; no network, no dependencies.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const HEX = /^#[0-9a-fA-F]{6}$/;
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {});

// Read a brand profile directory → normalized profile object.
export function loadProfile(dir) {
  const colors = readJson(join(dir, 'color-system.json'));
  const typography = readJson(join(dir, 'typography.json'));
  let tone = '';
  let imageryStyle = '';
  const idPath = join(dir, 'visual-identity.md');
  if (existsSync(idPath)) {
    const md = readFileSync(idPath, 'utf8');
    tone = (md.match(/tone:\s*(.+)/i)?.[1] ?? '').trim();
    imageryStyle = (md.match(/imagery:\s*(.+)/i)?.[1] ?? '').trim();
  }
  return {
    name: colors.name ?? typography.name ?? 'brand',
    colors,
    typography,
    tone,
    imageryStyle,
    rules: { do: colors.rules?.do ?? [], dont: colors.rules?.dont ?? [] },
  };
}

// Structural check → { ok, errors[] }. Enforces exact hex + required font families.
export function validateProfile(p) {
  const errors = [];
  for (const key of ['primary', 'secondary', 'accent']) {
    const v = p.colors?.[key];
    if (!v) errors.push(`colors.${key} is required`);
    else if (!HEX.test(v)) errors.push(`colors.${key} must be a 6-digit hex, got "${v}"`);
  }
  if (!p.typography?.heading?.family) errors.push('typography.heading.family is required');
  if (!p.typography?.body?.family) errors.push('typography.body.family is required');
  return { ok: errors.length === 0, errors };
}

// Available brand slugs. `brands/*` dirs, else `brand` if a single-brand repo.
export function listBrands(repoRoot) {
  const dir = join(repoRoot, 'brands');
  if (!existsSync(dir)) return existsSync(join(repoRoot, 'brand')) ? ['brand'] : [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

// Resolve the current brand → { slug, dir } or null.
// Order: brand/.active pointer → single brand/ dir → the sole brands/* dir.
export function resolveActive(repoRoot) {
  const activeFile = join(repoRoot, 'brand', '.active');
  if (existsSync(activeFile)) {
    const slug = readFileSync(activeFile, 'utf8').trim();
    const dir = slug === 'brand' ? join(repoRoot, 'brand') : join(repoRoot, 'brands', slug);
    if (existsSync(dir)) return { slug, dir };
  }
  if (existsSync(join(repoRoot, 'brand', 'color-system.json'))) {
    return { slug: 'brand', dir: join(repoRoot, 'brand') };
  }
  const brands = listBrands(repoRoot).filter((b) => b !== 'brand');
  if (brands.length === 1) return { slug: brands[0], dir: join(repoRoot, 'brands', brands[0]) };
  return null;
}
