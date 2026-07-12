// Build on-brand document/deck templates. Pure strings, no dependencies.
// Editable zones: id="title" / "subtitle" / "body".
import { esc, wrapText } from './svg.mjs';

// Document kind → canvas size (px). Portrait docs at US-Letter @96dpi; slide 16:9.
export const DOC_KINDS = {
  letterhead: { w: 816, h: 1056 },
  slide: { w: 1280, h: 720 },
  'one-pager': { w: 816, h: 1056 },
};

// profile + { kind, title, subtitle, body } → { svg, width, height, kind }.
export function buildDoc(profile, { kind = 'letterhead', title = '', subtitle = '', body = '' } = {}) {
  const size = DOC_KINDS[kind];
  if (!size) {
    throw new Error(`Unknown doc kind "${kind}". Valid: ${Object.keys(DOC_KINDS).join(', ')}`);
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
  const margin = Math.round(W * 0.09);

  const p = [];
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(brand)} ${kind}">`);
  p.push(`<rect width="${W}" height="${H}" fill="${bg}"/>`);

  if (kind === 'slide') {
    // Left accent bar, brand top-left, large title, subtitle, footer rule.
    p.push(`<rect x="0" y="0" width="${Math.round(W * 0.02)}" height="${H}" fill="${accent}"/>`);
    p.push(`<text x="${margin}" y="${Math.round(H * 0.14)}" font-family="${esc(headFont)}" font-size="28" font-weight="700" fill="${primary}">${esc(brand)}</text>`);
    let y = Math.round(H * 0.44);
    const tSize = 72;
    p.push(`<g id="title">`);
    for (const line of wrapText(title, 24)) {
      p.push(`<text x="${margin}" y="${y}" font-family="${esc(headFont)}" font-size="${tSize}" font-weight="700" fill="${primary}">${esc(line)}</text>`);
      y += Math.round(tSize * 1.12);
    }
    p.push(`</g>`);
    if (subtitle) {
      p.push(`<g id="subtitle"><text x="${margin}" y="${y + 8}" font-family="${esc(bodyFont)}" font-size="30" fill="${textColor}">${esc(subtitle)}</text></g>`);
      y += 46;
    }
    if (body) {
      p.push(`<g id="body">`);
      let by = y + 20;
      for (const line of wrapText(body, 72)) {
        p.push(`<text x="${margin}" y="${by}" font-family="${esc(bodyFont)}" font-size="24" fill="${textColor}">${esc(line)}</text>`);
        by += 34;
      }
      p.push(`</g>`);
    }
    p.push(`<rect x="${margin}" y="${H - Math.round(H * 0.1)}" width="${Math.round(W * 0.12)}" height="6" fill="${accent}"/>`);
  } else {
    // Portrait: letterhead / one-pager. Header (brand + accent rule), title, body, footer.
    if (kind === 'one-pager') {
      const band = Math.round(H * 0.09);
      p.push(`<rect x="0" y="0" width="${W}" height="${band}" fill="${primary}"/>`);
      p.push(`<text x="${margin}" y="${Math.round(band * 0.62)}" font-family="${esc(headFont)}" font-size="34" font-weight="700" fill="#FFFFFF">${esc(brand)}</text>`);
    } else {
      p.push(`<text x="${margin}" y="${Math.round(H * 0.07)}" font-family="${esc(headFont)}" font-size="34" font-weight="700" fill="${primary}">${esc(brand)}</text>`);
      p.push(`<rect x="${margin}" y="${Math.round(H * 0.083)}" width="${W - 2 * margin}" height="4" fill="${accent}"/>`);
    }

    let y = Math.round(H * 0.2);
    const tSize = 40;
    p.push(`<g id="title">`);
    for (const line of wrapText(title, 30)) {
      p.push(`<text x="${margin}" y="${y}" font-family="${esc(headFont)}" font-size="${tSize}" font-weight="700" fill="${primary}">${esc(line)}</text>`);
      y += Math.round(tSize * 1.25);
    }
    p.push(`</g>`);

    if (subtitle) {
      p.push(`<g id="subtitle"><text x="${margin}" y="${y}" font-family="${esc(bodyFont)}" font-size="22" fill="${textColor}">${esc(subtitle)}</text></g>`);
      y += 40;
    }

    p.push(`<g id="body">`);
    if (body) {
      for (const line of wrapText(body, 78)) {
        p.push(`<text x="${margin}" y="${y}" font-family="${esc(bodyFont)}" font-size="20" fill="${textColor}">${esc(line)}</text>`);
        y += 30;
      }
    } else {
      // Placeholder rules suggesting where content goes.
      for (let i = 0; i < 6; i += 1) {
        p.push(`<rect x="${margin}" y="${y}" width="${W - 2 * margin}" height="10" rx="5" fill="#E5E1D6"/>`);
        y += 34;
      }
    }
    p.push(`</g>`);

    p.push(`<rect x="${margin}" y="${H - Math.round(H * 0.08)}" width="${W - 2 * margin}" height="3" fill="${accent}"/>`);
    p.push(`<text x="${margin}" y="${H - Math.round(H * 0.05)}" font-family="${esc(bodyFont)}" font-size="16" fill="${textColor}">${esc(brand)} · hello@example.com</text>`);
  }

  p.push(`</svg>\n`);
  return { svg: p.join(''), width: W, height: H, kind };
}
