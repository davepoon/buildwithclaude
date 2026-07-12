// Optional SVG → PNG export. `sharp` is used if present; otherwise the default
// backend throws an actionable message. The backend is injectable, so this module
// is fully testable without the native dependency — and the plugin never requires it.
import { writeFileSync, renameSync } from 'node:fs';

// Default backend: render via the optional `sharp` dependency.
// `importSharp` is injectable for testing.
export async function sharpRender(svg, width = 1024, importSharp = () => import('sharp')) {
  let mod;
  try {
    mod = await importSharp();
  } catch {
    throw new Error(
      "PNG export needs the optional 'sharp' dependency (run `npm i sharp`), " +
      'or rasterize the SVG with an OS tool — see /brand-export for fallbacks.',
    );
  }
  const sharp = mod.default ?? mod;
  return sharp(Buffer.from(svg)).resize({ width }).png().toBuffer();
}

// Render an SVG string to a PNG file. `render(svg, width) => Buffer` is pluggable;
// defaults to sharpRender. Writes atomically; leaves no file if the backend fails.
export async function rasterize({ svg, outPath, width = 1024, render = sharpRender } = {}) {
  if (!svg) throw new Error('rasterize requires `svg`.');
  if (!outPath) throw new Error('rasterize requires `outPath`.');
  const buf = await render(svg, width);
  const tmp = `${outPath}.part`;
  writeFileSync(tmp, buf);
  renameSync(tmp, outPath);
  return { path: outPath, bytes: buf.length, width };
}

// CLI: node lib/rasterize.mjs <in.svg> <out.png> [width]
if (import.meta.url === `file://${process.argv[1]}`) {
  const [inPath, outPath, width] = process.argv.slice(2);
  try {
    if (!inPath || !outPath) throw new Error('usage: node lib/rasterize.mjs <in.svg> <out.png> [width]');
    const { readFileSync } = await import('node:fs');
    const svg = readFileSync(inPath, 'utf8');
    const r = await rasterize({ svg, outPath, width: width ? Number(width) : 1024 });
    process.stdout.write(`wrote ${r.path} (${r.bytes} bytes, ${r.width}px wide)\n`);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
