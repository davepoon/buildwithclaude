# Midpoint Card Prices

Trading card market prices and grading ROI inside Claude Code, through one remote MCP server.
Read-only, no account, no API key.

```
/plugin install midpoint-card-prices@buildwithclaude
```

Or register the server directly:

```
claude mcp add --transport http midpoint https://mcp.cardcenteringtool.com/mcp
```

## What you can ask

- "What is a PSA 10 Base Set Charizard worth?"
- "Is my Umbreon VMAX alt art worth grading?"
- "1986 Fleer Michael Jordan raw and PSA 10 price"
- "How has the 1952 Topps Mantle PSA 10 moved this year?"
- "Which Pokémon cards jumped the most this month?"
- "Most valuable cards in Evolving Skies"
- "Best basketball cards to grade"

Every answer includes USD market values from real sold listings, the capture date, and a link
to the card page on [cardcenteringtool.com](https://www.cardcenteringtool.com/prices).

## Tools

| Tool | Use it when |
|---|---|
| `search_cards` | the user names a card; returns prices and the card id |
| `get_card_prices` | full raw-by-condition and graded ladder (PSA, CGC, BGS, SGC, TAG) |
| `grading_roi` | "worth grading?": PSA 9 / PSA 10 premium, net after fees, expected value, verdict |
| `get_price_history` | 7–180 days of dated values, raw or a PSA grade |
| `best_cards_to_grade` | biggest expected grading profit in a game or set |
| `trending_cards` | biggest 30-day gainers or drops |
| `liquid_movers` | rising cards with real sales volume |
| `list_sets` / `get_set_cards` | set ids and priced checklists |

All tools are read-only (`readOnlyHint: true`). Coverage: Pokémon, Magic: The Gathering,
Yu-Gi-Oh!, One Piece, Disney Lorcana, Riftbound, Gundam, Dragon Ball, Digimon; baseball,
basketball, football, hockey, soccer, wrestling, UFC, racing, tennis, golf, boxing; Marvel,
Star Wars, Garbage Pail Kids and other entertainment and TCG sets.

## Links

- Docs and connect instructions: <https://www.cardcenteringtool.com/mcp>
- Source: <https://github.com/kolourr/midpoint-mcp>
- Privacy: <https://www.cardcenteringtool.com/privacy> · Terms: <https://www.cardcenteringtool.com/terms>
