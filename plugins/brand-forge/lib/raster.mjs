// Build a brand-aware image-generation prompt from a profile. Pure, no network.
// Describes the palette in words (hexes named), the imagery style, and tone, and
// turns the brand's don't-rules into an explicit "Avoid:" clause.

// profile + { subject, extra } → prompt string. `subject` is required.
export function buildRasterPrompt(profile, { subject, extra = '' } = {}) {
  if (!subject) throw new Error('buildRasterPrompt requires a `subject`.');

  const colors = profile.colors ?? {};
  const palette = ['primary', 'secondary', 'accent']
    .map((k) => colors[k])
    .filter(Boolean)
    .join(', ');

  const lines = [`Subject: ${subject}.`];
  if (profile.imageryStyle) lines.push(`Style: ${profile.imageryStyle}.`);
  if (palette) lines.push(`Use the brand palette: ${palette}.`);
  if (profile.tone) lines.push(`Mood: ${profile.tone}.`);
  lines.push('Photographic, high quality, no lettering or logos baked into the image.');

  const donts = profile.rules?.dont ?? [];
  if (donts.length) lines.push(`Avoid: ${donts.join('; ')}.`);
  if (extra) lines.push(extra);

  return lines.join(' ');
}
