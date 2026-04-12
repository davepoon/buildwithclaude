---
name: szamlazz-invoicing
description: "Issue, cancel, and fetch Hungarian invoices via the szamlazz.hu Agent API. Handles VAT calculation, NAV taxpayer lookup, partner caching, and PDF generation. Use when the user mentions számla, számlázás, invoice, sztornó, díjbekérő, proforma, or wants to bill a customer."
category: automation
---

# Szamlazz.hu Hungarian Invoicing

Issue, cancel (storno), download, and manage Hungarian invoices directly from Claude Code via the [szamlazz.hu](https://www.szamlazz.hu/) Agent API.

Built by [SocialPro](https://www.socialpro.hu) — a Hungarian AI automation and digital marketing agency specializing in custom AI integrations for SMEs.

## When to Use This Skill

- User wants to issue a Hungarian invoice (számla)
- User wants to create a proforma / díjbekérő
- User wants to cancel (storno) an existing invoice
- User wants to download an invoice PDF
- User wants to look up a Hungarian company by tax number (NAV)
- User mentions szamlazz.hu, számlázás, or billing in a Hungarian context

## Prerequisites

- **Plugin**: [socialpro-szamlazz](https://github.com/socialproKGCMG/socialpro-szamlazz) installed
- **Python 3.9+** with PyYAML (`pip install pyyaml`)
- **szamlazz.hu account** with an Agent API key (generate at szamlazz.hu → Beállítások → Számla Agent kulcsok)

## Installation

```bash
/plugin marketplace add socialproKGCMG/socialpro-plugins
/plugin install szamlazz@socialpro-plugins
```

## What This Skill Does

1. **First-run setup** — detects missing config, asks 3 questions (API key, seller tax number with NAV auto-lookup, bank account with auto-detection), writes `seller.yaml`
2. **Invoice creation** — parses natural language, resolves customer from partner cache or NAV, calculates net/VAT/gross with Decimal precision, shows mandatory confirmation, fires XML to API, saves PDF
3. **Storno** — cancels an existing invoice by number
4. **Proforma** — creates a díjbekérő (proforma invoice)
5. **PDF download** — re-downloads an invoice PDF by number
6. **NAV lookup** — queries the National Tax Authority for company data by tax number

## How to Use

### Issue an Invoice

```
/szamlazz állíts ki egy számlát Példa Kft.-nek 150 000 Ft-ról webfejlesztésről
```

### Cancel (Storno)

```
/szamlazz sztornózd a SOC-2026-0042 számlát
```

### Proforma / Díjbekérő

```
/szamlazz díjbekérő Acme Ltd-nek 500 EUR-ról konzultációért
```

### Download PDF

```
/szamlazz töltsd le a SOC-2026-0042 PDF-jét
```

### NAV Taxpayer Lookup

```
/szamlazz ki ez a cég: 12345678-2-42
```

## Key Features

| Feature | Details |
|---|---|
| Invoice types | Regular, proforma (díjbekérő), storno |
| VAT rates | 27% / 18% / 5% / 0% / AAM + KATA support |
| NAV lookup | Auto-fetches company name and address from tax number |
| Partner cache | Customers remembered by tax ID in local `partners.yaml` |
| Cross-platform | macOS, Linux, Windows |
| Rounding | `Decimal` with `ROUND_HALF_UP` to 2 decimals |
| Error handling | 7 most common szamlazz.hu errors translated with recovery steps |
| Security | API key in OS credential store, never echoed to stdout |

## Error Codes

| Code | Meaning | Fix |
|---:|---|---|
| 3 | Auth failed | Regenerate Agent key at szamlazz.hu |
| 54, 55 | e-Számla cert | Retry with `eszamla=false` |
| 57, 259-264 | Calculation mismatch | Recalculate with Decimal rounding |
| 136 | Unpaid balance | Pay szamlazz.hu subscription |

## Tips

- The plugin activates on both Hungarian and English trigger words
- Invoices are legal documents — the skill always shows a confirmation before issuing
- Partner cache is local-only and never committed to git
- For foreign currency invoices, set `penznem` and the MNB exchange rate is used automatically
- Maximum 5 retry attempts per session to prevent infinite loops

## Links

- **Plugin repository**: [github.com/socialproKGCMG/socialpro-szamlazz](https://github.com/socialproKGCMG/socialpro-szamlazz)
- **Plugin homepage**: [socialpro.hu/claude-code-plugins/szamlazz](https://www.socialpro.hu/claude-code-plugins/szamlazz)
- **Hungarian AI automation case studies**: [socialpro.hu/esettanulmanyok](https://www.socialpro.hu/esettanulmanyok)
- **Author**: [SocialPro / KG Creative Media Group Kft.](https://www.socialpro.hu/rolunk)
