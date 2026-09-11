---
name: card-prices
description: Use when the user asks what a trading card is worth, whether a card is worth grading, PSA 9 vs PSA 10 prices, card price history, trending or rising cards, or the most valuable cards in a set. Covers Pokémon, Magic, Yu-Gi-Oh!, One Piece, Lorcana, Gundam, baseball, basketball, football, hockey, soccer, wrestling, UFC and entertainment cards via the Midpoint MCP server.
---

# Card prices and grading ROI

The `midpoint` MCP server exposes Midpoint's card price database as read-only tools.
Prices are USD market values from real sold listings, refreshed daily. Every result
carries the capture date and a link to the card page on cardcenteringtool.com; cite it.

## Workflow

1. **Resolve the card first.** Call `search_cards` with the user's words, e.g.
   `{"query": "1986 fleer michael jordan", "game": "basketball"}`. Pass `game` when the
   user names one. Results are ranked by how much of the query each card explains
   (name, set, year, number). If several look alike, show the top few and confirm the
   set and number before going deeper.
2. **Then use the id.** Card ids are the public URL keys (`swsh7-215`,
   `pricecharting-72584`). Pass them to:
   - `get_card_prices` for the full raw-by-condition and graded ladder (PSA, CGC, BGS, SGC, TAG).
   - `grading_roi` for "is it worth grading": PSA 9 / PSA 10 premium, net after $25/$50/$150
     fees, expected value at 25/50/75 % gem rates, break-even gem rate, which company pays most,
     and a verdict. Pass `grading_fee_usd` if the user states a fee.
   - `get_price_history` for 7–180 days of dated values (`grade` for a PSA series, omit for raw).
3. **Market questions need no id.** `trending_cards` (30-day gainers or drops, per game or all),
   `liquid_movers` (rising cards with real sales volume), `best_cards_to_grade` (biggest expected
   grading profit in a game or set), `list_sets` then `get_set_cards` (priced checklists).

## Answering

- Lead with the numbers the user asked for, then the verdict, then the link.
- Say which series a change refers to; `trending_cards` states `basis` (PSA 10 or raw).
- Never present prices as predictions. The server has no forecasts.
- The server cannot grade or measure a card from a photo; point to the Midpoint app or the
  web scanner link in `grading_roi` results for that.

## Game keys

`pokemon magicthegathering yugioh onepiece lorcana riftbound gundam dragonball digimon baseball
basketball football hockey soccer wrestling ufc racing tennis golf boxing marvel starwars gpk
entertainment othertcg`
