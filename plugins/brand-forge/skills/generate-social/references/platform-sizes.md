# Social platform sizes

Canvas sizes `lib/social.mjs` ships, and when to use each.

| Preset             | Size (px)   | Ratio  | Use for |
|--------------------|-------------|--------|---------|
| `instagram-square` | 1080 × 1080 | 1:1    | Instagram/LinkedIn feed posts, general square posts |
| `instagram-story`  | 1080 × 1920 | 9:16   | Instagram/Facebook/TikTok stories & reels covers |
| `og-card`          | 1200 × 630  | 1.91:1 | Open Graph / Twitter link cards, LinkedIn shares |
| `youtube-thumb`    | 1280 × 720  | 16:9   | YouTube thumbnails, wide banners |

## Safe zones
- Keep the headline and CTA clear of the outer 8% margin (the generator already
  insets to `W * 0.08`).
- For `instagram-story`, avoid the top and bottom ~14% — platform UI overlaps there.

## Layout the generator produces
- A brand band across the top in `primary` with the brand name.
- A wrapped headline in the heading font (editable zone `id="headline"`).
- An optional subhead in the body font (`id="subhead"`).
- An optional CTA pill in `accent` near the bottom (`id="cta"`).

## Extending
Add a preset by extending `PLATFORMS` in `lib/social.mjs` with `{ w, h }`; every
downstream layout is proportional to `W`/`H`, so no other change is needed.
