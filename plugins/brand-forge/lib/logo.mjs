// Build on-brand SVG logo variants from a profile. Pure strings, no dependencies.
// Vector output is the "right" format for logos: scalable, editable, zero-permission.
import { esc, initials } from './svg.mjs';

// profile + { text } → { wordmark, monogram, favicon } as SVG strings.
export function buildLogos(profile, { text } = {}) {
  const label = text ?? profile.name ?? 'Brand';
  const primary = profile.colors?.primary ?? '#111111';
  const accent = profile.colors?.accent ?? primary;
  const font = profile.typography?.heading?.family ?? 'system-ui';
  const inits = initials(label);

  const wordmark =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 120" role="img" aria-label="${esc(label)} logo">` +
    `<rect width="480" height="120" fill="none"/>` +
    `<circle cx="60" cy="60" r="26" fill="${accent}"/>` +
    `<text x="104" y="74" font-family="${esc(font)}" font-size="52" font-weight="700" fill="${primary}">${esc(label)}</text>` +
    `</svg>\n`;

  const monogram =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="${esc(label)} monogram">` +
    `<rect x="8" y="8" width="144" height="144" rx="24" fill="${primary}"/>` +
    `<text x="80" y="104" text-anchor="middle" font-family="${esc(font)}" font-size="72" font-weight="700" fill="#FFFFFF">${esc(inits)}</text>` +
    `</svg>\n`;

  const favicon =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${esc(label)} favicon">` +
    `<rect width="64" height="64" rx="12" fill="${primary}"/>` +
    `<text x="32" y="44" text-anchor="middle" font-family="${esc(font)}" font-size="36" font-weight="700" fill="#FFFFFF">${esc(inits[0] ?? '')}</text>` +
    `</svg>\n`;

  return { wordmark, monogram, favicon };
}
