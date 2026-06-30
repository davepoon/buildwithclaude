---
description: Issue a free 90-day Let's Encrypt certificate
argument-hint: <domain>
allowed-tools: Bash(openssl*), Bash(python3 *dns_provider.py*), Bash(mkdir -p *tlsradar*), Read, Write
---

Issue a free SSL/TLS certificate from Let's Encrypt for `$ARGUMENTS`, entirely through the TLS Radar MCP server's certificate tools. The private key is generated **locally** and never leaves the machine.

## 1. Choose the validation (challenge) method

Read `${HOME}/.config/tlsradar/config.json` (it may not exist). Its shape:

```json
{ "default_challenge": "dns-01-cloudflare",
  "per_domain": { "example.com": "http-01" } }
```

Pick the method in this order: a `per_domain` entry for `$ARGUMENTS` → else `default_challenge` → else **ask the user**, offering:

| Method | How it's proven | Best when |
|---|---|---|
| `dns-01` (manual TXT) | You show a TXT record; the user adds it by hand | Any domain; no API token |
| `dns-01-cloudflare` | Claude sets the TXT record via the Cloudflare API (`$CLOUDFLARE_API_TOKEN`) | Domain on Cloudflare - fully automated |
| `dns-01-route53` | Claude sets the TXT record via the AWS CLI (`aws` configured) | Domain on Route 53 - fully automated |
| `http-01` | Serve a file on `http://$ARGUMENTS` port 80 | You control the web server; issues the apex only (no www) |

When the user picks one, ask "save as the default?" - if yes, write it back to `default_challenge` (or `per_domain["$ARGUMENTS"]` if they say "just for this domain"), preserving the rest of the file. Create `~/.config/tlsradar` first if needed.

The Beacon `challenge` value is `http-01` for `http-01`, otherwise `dns-01` (all three dns-01 variants differ only in *how the plugin sets the TXT record*).

## 2. Start the order

You'll need the user's email. When you ask for it (or before using one from context), tell them plainly what it's for: **the Let's Encrypt order, and a one-time follow-up email from TLS Radar about monitoring this certificate's expiry. No marketing unless they opt in.** Only set `marketing_consent: true` if they explicitly ask for it (default is off - keep it off).

Read `${HOME}/.config/tlsradar/install_id` if it exists. Call `tlsradar.create_certificate` with `domain=$ARGUMENTS`, `email`, `challenge` (`dns-01` or `http-01`), and `client_id` = that install id (for anonymous funnel attribution; omit if the file is absent). It returns `order_id`, either `dns_records` or `http_files`, a `resume_token`, and an `install_id`.

**Keep two things from the response for later:** the `resume_token` (lets you finalize even if the order is interrupted for a day) and the `install_id` - if `~/.config/tlsradar/install_id` didn't exist, write the returned `install_id` there so future calls are attributed to the same install.

**If any certificate-tool call returns `structuredContent.degraded: true`** (the certificate backend is briefly unavailable - server-side and transient), don't treat it as a hard failure or retry in a loop: relay the friendly message, note that `/tls-scan` still works, and suggest trying again in a minute. This can happen at any step below.

## 3. Put the challenge in place

**dns-01 (manual):** show the TXT record(s) from `dns_records`; the user publishes them.

**dns-01-cloudflare / dns-01-route53:** for each record in `dns_records`, run the bundled helper - it handles zone lookup, the Cloudflare API call / Route 53 change-batch, and Route 53's TXT double-quoting (all tested, so the model doesn't hand-build the request):

```
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/dns_provider.py" set \
  --provider <cloudflare|route53> --name "<record.name>" --value "<record.value>"
```

Credentials are read from the local environment by the helper (`CLOUDFLARE_API_TOKEN`, or the configured `aws` CLI) and never sent to TLS Radar or Beacon. If zone auto-detection is wrong, pass `--zone <id>`.

**http-01:** each `http_files` entry must be served at `http://<domain><path>` with the exact `content` body on port 80. If the user gives you a webroot, write the file to `<webroot><path>`; otherwise show them the path + content to place themselves.

## 4. Wait for propagation

Poll `tlsradar.check_certificate_propagation` with `order_id` until `all_found` is `true`. Don't finalize before it's green.

## 5. Generate a CSR locally, then finalize

Generate the key + CSR on the user's machine. **The SAN set depends on the method:** `dns-01*` issues `{$ARGUMENTS, www.$ARGUMENTS}`; `http-01` issues `$ARGUMENTS` only.

```
mkdir -p "${HOME}/.config/tlsradar/certs"
# dns-01 variants (apex + www):
openssl req -new -newkey rsa:2048 -nodes \
  -keyout "${HOME}/.config/tlsradar/certs/$ARGUMENTS.key" \
  -out "${HOME}/.config/tlsradar/certs/$ARGUMENTS.csr" \
  -subj "/CN=$ARGUMENTS" -addext "subjectAltName=DNS:$ARGUMENTS,DNS:www.$ARGUMENTS"
# http-01 (apex only): drop the ,DNS:www.$ARGUMENTS from subjectAltName
```

Read the `.csr` and call `tlsradar.finalize_certificate` with `order_id` + `csr_pem` (and the `resume_token` from step 2 - harmless normally, and the only way to finish if Beacon purged the order after a long gap). It validates, waits briefly, and issues, returning `fullchain_pem`. If it replies "still validating," re-run `tlsradar.check_certificate_propagation`, then `tlsradar.finalize_certificate` again - **safe to retry** (a completed order returns the same chain, never re-issues).

## 6. Save the certificate

Write `fullchain_pem` to `${HOME}/.config/tlsradar/certs/$ARGUMENTS.fullchain.pem` (next to the `.key`). Tell the user both paths.

If they want a PKCS#12 (Windows/Java), package it **locally** - key and passphrase stay on their machine (openssl prompts for the export password; never ask for it in chat):

```
openssl pkcs12 -export \
  -inkey "${HOME}/.config/tlsradar/certs/$ARGUMENTS.key" \
  -in "${HOME}/.config/tlsradar/certs/$ARGUMENTS.fullchain.pem" \
  -out "${HOME}/.config/tlsradar/certs/$ARGUMENTS.p12"
```

If they want the files in their project dir, have them `.gitignore` `*.key *.p12 *.csr` first.

## After issuance

The cert → monitoring handoff is automatic and server-side. `finalize_certificate`'s response carries a `handoff` object - relay `structuredContent.handoff.message` to the user and **don't** add the monitor manually.

## Cleanup & notes

- After a successful dns-01-provider issuance, offer to delete the `_acme-challenge` TXT record you created - same helper, `delete` action: `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/dns_provider.py" delete --provider <cloudflare|route53> --name "<record.name>" --value "<record.value>"`.
- Provider credentials (`$CLOUDFLARE_API_TOKEN`, AWS creds) are read locally by the helper and never sent to TLS Radar or Beacon.
- Don't ask the user for any private-key or p12 passphrase in chat.
- Don't push `/tls-monitor add` afterward - the handoff covers it.
