// Build on-brand social templates at platform sizes. Pure strings, no dependencies.
// The output SVG has editable text zones (id="headline"/"subhead"/"cta").
import { esc, wrapText } from './svg.mjs';

// Platform → canvas size. The safe, common sizes for each surface.
export const PLATFORMS = {
  'instagram-square': { w: 1080, h: 1080 },
  'instagram-story': { w: 1080, h: 1920 },
  'og-card': { w: 1200, h: 630 },
  'youtube-thumb': { w: 1280, h: 720 },
};

// profile + { platform, headline, subhead, cta } → { svg, width, height, platform }.
export function buildSocial(profile, { platform = 'instagram-square', headline = '', subhead = '', cta = '' } = {}) {
  const size = PLATFORMS[platform];
  if (!size) {
    throw new Error(`Unknown platform "${platform}". Valid: ${Object.keys(PLATFORMS).join(', ')}`);
  }
  const { w: W, h: H } = size;

  const colors = profile.colors ?? {};
  const roles = colors.roles ?? {};
  const bg = roles.background ?? '#FFFFFF';
  const primary = colors.primary ?? '#111111';
  const accent = colors.accent ?? primary;
  const textColor = roles.text ?? primary;
  const headFont = profile.typography?.heading?.family ?? 'system-ui';
  const bodyFont = profile.typography?.body?.family ?? 'system-ui';
  const brand = profile.name ?? 'Brand';

  const margin = Math.round(W * 0.08);
  const band = Math.round(H * 0.1);
  const headSize = Math.round(W * 0.075);
  const bodySize = Math.round(W * 0.038);
  const maxChars = Math.max(8, Math.floor((W - 2 * margin) / (headSize * 0.55)));

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(brand)} social template">`);
  parts.push(`<rect width="${W}" height="${H}" fill="${bg}"/>`);

  // Brand band
  parts.push(`<rect x="0" y="0" width="${W}" height="${band}" fill="${primary}"/>`);
  parts.push(`<text x="${margin}" y="${Math.round(band * 0.64)}" font-family="${esc(headFont)}" font-size="${Math.round(band * 0.42)}" font-weight="700" fill="#FFFFFF">${esc(brand)}</text>`);

  // Headline (wrapped) — editable zone
  const lines = wrapText(headline, maxChars);
  let y = Math.round(H * 0.42);
  parts.push(`<g id="headline">`);
  for (const line of lines) {
    parts.push(`<text x="${margin}" y="${y}" font-family="${esc(headFont)}" font-size="${headSize}" font-weight="700" fill="${textColor}">${esc(line)}</text>`);
    y += Math.round(headSize * 1.15);
  }
  parts.push(`</g>`);

  // Subhead — editable zone
  if (subhead) {
    parts.push(`<g id="subhead">`);
    for (const line of wrapText(subhead, Math.round(maxChars * 1.6))) {
      y += Math.round(bodySize * 0.4);
      parts.push(`<text x="${margin}" y="${y}" font-family="${esc(bodyFont)}" font-size="${bodySize}" fill="${textColor}">${esc(line)}</text>`);
      y += Math.round(bodySize * 1.2);
    }
    parts.push(`</g>`);
  }

  // CTA pill — editable zone, only when provided
  if (cta) {
    const pillH = Math.round(bodySize * 2.2);
    const pillW = Math.round(cta.length * bodySize * 0.62 + bodySize * 2);
    const pillY = H - band - pillH;
    parts.push(`<g id="cta">`);
    parts.push(`<rect x="${margin}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${Math.round(pillH / 2)}" fill="${accent}"/>`);
    parts.push(`<text x="${margin + Math.round(pillW / 2)}" y="${pillY + Math.round(pillH * 0.66)}" text-anchor="middle" font-family="${esc(bodyFont)}" font-size="${bodySize}" font-weight="700" fill="#FFFFFF">${esc(cta)}</text>`);
    parts.push(`</g>`);
  }

  parts.push(`</svg>\n`);
  return { svg: parts.join(''), width: W, height: H, platform };
}
