// Compose a brand overlay over a generated raster — without a raster library.
// The result is an SVG that places the image (or an inline backdrop for mockups)
// and stamps a brand lockup + caption on a legibility scrim. Pure, no dependencies.
import { esc } from './svg.mjs';

// { width, height, profile, caption, imageHref, inlineBackground } → SVG string.
// Backdrop precedence: inlineBackground (self-contained) → <image href> (real pipeline).
export function buildOverlay({
  width: W,
  height: H,
  profile = {},
  caption = '',
  imageHref = '',
  inlineBackground = '',
} = {}) {
  const colors = profile.colors ?? {};
  const primary = colors.primary ?? '#111111';
  const accent = colors.accent ?? primary;
  const headFont = profile.typography?.heading?.family ?? 'system-ui';
  const bodyFont = profile.typography?.body?.family ?? 'system-ui';
  const brand = profile.name ?? 'Brand';

  const margin = Math.round(W * 0.05);
  const scrimH = Math.round(H * 0.28);
  const brandSize = Math.max(14, Math.round(W * 0.03));
  const capSize = Math.max(12, Math.round(W * 0.024));
  const dotR = Math.round(brandSize * 0.32);

  const backdrop = inlineBackground
    ? inlineBackground
    : `<image href="${esc(imageHref)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(brand)} marketing graphic">` +
    backdrop +
    // Bottom scrim for legible overlay text
    `<rect x="0" y="${H - scrimH}" width="${W}" height="${scrimH}" fill="${primary}" fill-opacity="0.72"/>` +
    // Brand lockup: accent dot + name
    `<circle cx="${margin + dotR}" cy="${H - scrimH + Math.round(scrimH * 0.34)}" r="${dotR}" fill="${accent}"/>` +
    `<text x="${margin + dotR * 2 + 10}" y="${H - scrimH + Math.round(scrimH * 0.42)}" font-family="${esc(headFont)}" font-size="${brandSize}" font-weight="700" fill="#FFFFFF">${esc(brand)}</text>` +
    // Caption
    (caption
      ? `<text x="${margin}" y="${H - Math.round(scrimH * 0.28)}" font-family="${esc(bodyFont)}" font-size="${capSize}" fill="#FFFFFF">${esc(caption)}</text>`
      : '') +
    `</svg>\n`
  );
}
