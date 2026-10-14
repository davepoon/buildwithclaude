# Extracting angles from live ads

An "angle" is the reason-to-believe an ad leads with, not the product feature. Four questions per ad:

| Question | Where to look | Example |
|---|---|---|
| What is the hook? | First line of `body`, or `headline` when body is empty | "Standard headsets make you feel like you are just playing a video game" |
| What is the offer? | `cta`, discounts or bundles in `body`, `linkUrl` path (`/products/x-bundle`) | Bundle with case, "Shop now" |
| Who is it for? | Named use case, placement (`platforms`), format | Gamers; Instagram + Threads; VIDEO |
| What proof does it lean on? | Numbers, named authority, comparison in `body` | "Designed by an audio engineering legend" |

## Weighting

- **Days running** (`start` to `end` or today) is the primary rank. Keep the top three oldest active ads regardless of how dull they look.
- **Several ads, one landing page** outranks one ad with a clever line. Count ads per `linkUrl`.
- **Format diversity on the same angle** (VIDEO + Image + DCO all pushing the same bundle) means the angle, not the asset, is what works.
- Treat `is_active: false` ads as history: useful for "what they stopped", not for "what to copy".

## Google-side caveats

Google Ads Transparency exposes advertiser, format, dates and region, usually without copy. Use it to confirm *that* they buy search/display and *since when*; do not invent headlines for Google ads. Where `region` is `all`, the ad is not US-specific.

## Traps

- A catalogue ad (`DCO`/`DPA`) with `{{product.name}}` placeholders has no human-written hook. Skip it for copy; keep it for landing-page discovery.
- Ten ads from one `pageName` that is not the brand (an affiliate or publisher page) are someone else's angle. Note the page name.
- The Ad Library search is keyword-based on the domain; a brand whose page never mentions its domain can return unrelated advertisers. Check `pageName` and `linkUrl` host before attributing.
- Ad presence proves spend, not profit or scale. Do not estimate budget from ad count.
