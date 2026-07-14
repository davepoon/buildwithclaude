// Input for the Northwind raster MOCKUP. Because we can't call the live image API
// in this environment, a branded gradient landscape stands in for the AI photo; the
// real pipeline would pass an `imageHref` to the generated PNG instead. Shared by the
// example generator and the byte-stability test so they never drift.

export const HERO_MOCKUP = {
  width: 1200,
  height: 630,
  caption: 'Built for the long trail',
  // Self-contained backdrop (a stand-in for the generated photo).
  inlineBackground:
    '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#F7F4EC"/><stop offset="1" stop-color="#0B3D2E"/>' +
    '</linearGradient></defs>' +
    '<rect width="1200" height="630" fill="url(#sky)"/>' +
    '<circle cx="960" cy="150" r="70" fill="#E8B04B"/>' +
    '<path d="M0 470 Q 300 380 600 460 T 1200 440 L1200 630 L0 630 Z" fill="#0B3D2E"/>' +
    '<path d="M0 520 Q 350 450 700 520 T 1200 510 L1200 630 L0 630 Z" fill="#0A2A20"/>',
};
