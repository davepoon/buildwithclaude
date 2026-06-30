---
description: Renew a Let's Encrypt certificate before it expires
argument-hint: <domain>
allowed-tools: Bash(openssl*), Bash(open*), Write
---

Renew the Let's Encrypt certificate for `$ARGUMENTS`. Renewal issues a fresh 90-day cert for the same domain; the user's monitoring picks up the new cert on the next scan.

## Flow

`tlsradar.renew_certificate` clones an existing order by its **`order_id`**, and orders are purged ~24h after creation - so months later at renewal time there's usually no order to clone. Two cases:

- **No `order_id` (the normal case):** just run a fresh issuance - it *is* the renewal. Follow `/tls-cert` exactly: `tlsradar.create_certificate(domain=$ARGUMENTS, email=…)` → publish TXT → `tlsradar.check_certificate_propagation` until green → generate a CSR locally → `tlsradar.finalize_certificate(order_id, csr_pem)`.
- **User still has a recent `order_id`:** call `tlsradar.renew_certificate` with it to get a fresh order + new TXT records, then continue from the propagation step as above.

Either way the private key is generated locally (CSR path) and the monitoring handoff fires automatically when the cert completes - you do not register anything.

## When to suggest this proactively

If the user runs an expiry check and any entry shows < 30 days remaining, suggest `/tls-renew <domain>`. Don't auto-renew without asking - renewal involves DNS changes the user controls.

## Things this command should NOT do

- Don't renew an unrelated domain just because it's expiring - only act on `$ARGUMENTS`.
- Don't call `tlsradar.renew_certificate` with a domain - it takes an `order_id`. Without one, use `tlsradar.create_certificate`.
- Don't tell the user to manually update monitoring afterward - the cert change is picked up on the next scheduled scan.
