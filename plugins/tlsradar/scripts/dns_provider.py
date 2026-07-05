#!/usr/bin/env python3
"""Set/delete the dns-01 challenge TXT record via a DNS provider's API.

Why this exists: the provider automation (Cloudflare zone lookup, Route 53's
change-batch with its TXT double-quoting gotcha, extracting the registrable
root) is the most failure-prone part of issuance, and it used to live as shell
snippets inside a prompt - untested. This moves it into one tested place. The
prompt just calls:

    dns_provider.py set    --provider cloudflare --name _acme-challenge.example.com --value <txt>
    dns_provider.py delete --provider route53    --name _acme-challenge.example.com --value <txt>

Credentials stay LOCAL and are read from the environment, never passed as args
and never sent anywhere but the provider:
  - cloudflare: CLOUDFLARE_API_TOKEN
  - route53:    the standard AWS env/profile the `aws` CLI already uses

The risky, gotcha-prone bits (root extraction, payload shapes, TXT quoting) are
pure functions covered by scripts/dns_provider_test.py. The network/CLI calls
are thin wrappers around them.

Exit 0 on success; non-zero with a message on failure.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

CF_API = "https://api.cloudflare.com/client/v4"

# dns-01 challenge values are the base64url (unpadded) SHA-256 of the key
# authorization - always this charset, no dots/spaces/quotes. Anything else in
# a "TXT value" from the server is not a real challenge and we refuse to write it.
_B64URL = re.compile(r"\A[A-Za-z0-9_-]{1,255}\Z")
_LABEL = re.compile(r"\A[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?\Z")


# --- pure helpers (tested) ---------------------------------------------------

def validate_challenge(name: str, domain: str, value: str) -> None:
    """Reject a record that isn't the expected _acme-challenge record for `domain`.

    The record name/value come from the remote MCP response, which we treat as
    untrusted: a buggy or compromised endpoint must not be able to steer a
    provider write into an unrelated zone the user happens to control, or smuggle
    junk into a TXT value. We enforce, purely from the domain the user asked for:

      - name is `_acme-challenge.<domain>` or `_acme-challenge.<sub>.<domain>`
        (the apex and any subdomain of the requested domain, e.g. www),
      - every label is a syntactically valid DNS label,
      - the value is a plausible dns-01 token (base64url, no separators).

    Raises ValueError (with a user-facing reason) on any mismatch.
    """
    dom = domain.rstrip(".").lower()
    nm = name.rstrip(".").lower()
    if not dom or not _all_valid_labels(dom):
        raise ValueError(f"invalid domain {domain!r}")
    prefix = "_acme-challenge."
    if not nm.startswith(prefix):
        raise ValueError(f"record name {name!r} is not an _acme-challenge record")
    host = nm[len(prefix):]  # the identifier being validated, e.g. example.com or www.example.com
    if host != dom and not host.endswith("." + dom):
        raise ValueError(
            f"record name {name!r} is not under the requested domain {domain!r} "
            f"- refusing to write it (a correct dns-01 record is _acme-challenge.{dom})"
        )
    if not _all_valid_labels(nm):
        raise ValueError(f"record name {name!r} has an invalid DNS label")
    if not _B64URL.match(value):
        raise ValueError(f"TXT value {value!r} is not a valid dns-01 token (expected base64url)")


def _all_valid_labels(fqdn: str) -> bool:
    return all(_LABEL.match(lbl) for lbl in fqdn.split("."))

def registrable_root(name: str) -> str:
    """Best-effort registrable domain for a challenge name.

    Challenge names look like `_acme-challenge.sub.example.com`. We want the
    zone to query the provider for. This uses a small public-suffix-aware-ish
    heuristic: two labels normally, three when the second-to-last label is a
    known two-level TLD (co.uk, com.au, ...). Not a full PSL, but covers the
    common cases; callers can override with --zone for anything exotic.
    """
    # DNS is case-insensitive and providers return zone names lowercased, so
    # fold here - otherwise a mixed-case challenge name would never match a zone.
    labels = name.rstrip(".").lower().split(".")
    if len(labels) <= 2:
        return ".".join(labels)
    two_level = {"co.uk", "com.au", "co.nz", "co.jp", "com.br", "co.za", "org.uk", "ac.uk"}
    last_two = ".".join(labels[-2:])
    if last_two in two_level and len(labels) >= 3:
        return ".".join(labels[-3:])
    return last_two


def cloudflare_record_payload(name: str, value: str) -> dict:
    """Body for POST /zones/{id}/dns_records."""
    return {"type": "TXT", "name": name, "content": value, "ttl": 60}


def route53_change_batch(name: str, value: str, action: str) -> dict:
    """Route 53 TXT values MUST be enclosed in double quotes inside the record.

    This quoting is the classic footgun; encode it once, here.
    """
    quoted = '"' + value.replace('"', '\\"') + '"'
    return {
        "Changes": [{
            "Action": action,  # UPSERT or DELETE
            "ResourceRecordSet": {
                "Name": name,
                "Type": "TXT",
                "TTL": 60,
                "ResourceRecords": [{"Value": quoted}],
            },
        }]
    }


# --- provider calls (thin wrappers) -----------------------------------------

def _cf_request(method: str, path: str, token: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(CF_API + path, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def cloudflare(action: str, name: str, value: str, zone: str | None) -> None:
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not token:
        raise SystemExit("CLOUDFLARE_API_TOKEN is not set")
    root = zone or registrable_root(name)
    zones = _cf_request("GET", f"/zones?name={root}", token)
    results = zones.get("result") or []
    if not results:
        raise SystemExit(f"Cloudflare: no zone found for {root} (try --zone)")
    zone_id = results[0]["id"]

    if action == "set":
        out = _cf_request("POST", f"/zones/{zone_id}/dns_records", token, cloudflare_record_payload(name, value))
        if not out.get("success"):
            raise SystemExit(f"Cloudflare set failed: {out.get('errors')}")
    else:  # delete: find the matching record then remove it
        recs = _cf_request("GET", f"/zones/{zone_id}/dns_records?type=TXT&name={name}", token)
        for rec in recs.get("result") or []:
            if rec.get("content") == value:
                _cf_request("DELETE", f"/zones/{zone_id}/dns_records/{rec['id']}", token)


def route53(action: str, name: str, value: str, zone: str | None) -> None:
    zone_id = zone or _route53_zone_id(registrable_root(name))
    batch = route53_change_batch(name, value, "UPSERT" if action == "set" else "DELETE")
    _aws("route53", "change-resource-record-sets",
         "--hosted-zone-id", zone_id, "--change-batch", json.dumps(batch))


def route53_zone_id_from_list(zones: list, root: str) -> str | None:
    """Return the hosted-zone id only if the first zone EXACTLY matches root.

    list-hosted-zones-by-name returns zones lexicographically >= the query, so
    the first result is NOT guaranteed to be `root` - if no exact zone exists
    it's the next one. Picking it blindly would write the challenge record into
    the wrong zone. Returns None when there's no exact match.
    """
    if zones and zones[0].get("Name", "").rstrip(".") == root:
        return zones[0]["Id"].split("/")[-1]
    return None


def _route53_zone_id(root: str) -> str:
    out = _aws("route53", "list-hosted-zones-by-name", "--dns-name", root, "--max-items", "1")
    zone_id = route53_zone_id_from_list(json.loads(out).get("HostedZones") or [], root)
    if zone_id is None:
        raise SystemExit(f"Route 53: no hosted zone exactly matching {root} (pass --zone <id>)")
    return zone_id


def _aws(*args: str) -> str:
    try:
        return subprocess.run(["aws", *args], check=True, capture_output=True, text=True).stdout
    except FileNotFoundError:
        raise SystemExit("the `aws` CLI is not installed")
    except subprocess.CalledProcessError as e:
        raise SystemExit(f"aws {' '.join(args[:2])} failed: {e.stderr.strip()}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("action", choices=["set", "delete"])
    ap.add_argument("--provider", required=True, choices=["cloudflare", "route53"])
    ap.add_argument("--domain", required=True, help="the cert domain the user requested, e.g. example.com - the record is validated against it")
    ap.add_argument("--name", required=True, help="full record name, e.g. _acme-challenge.example.com")
    ap.add_argument("--value", required=True, help="the TXT value from cert_create")
    ap.add_argument("--zone", help="override the zone/hosted-zone id if root detection is wrong")
    args = ap.parse_args()

    # Untrusted-input gate: the name/value came from the remote MCP response.
    # Refuse anything that isn't the expected _acme-challenge record for --domain,
    # for both set and delete (a spoofed name must not drive a delete either).
    try:
        validate_challenge(args.name, args.domain, args.value)
    except ValueError as e:
        print(f"refusing DNS write: {e}", file=sys.stderr)
        return 2

    try:
        (cloudflare if args.provider == "cloudflare" else route53)(args.action, args.name, args.value, args.zone)
    except urllib.error.URLError as e:
        print(f"network error talking to {args.provider}: {e}", file=sys.stderr)
        return 1
    print(f"{args.action} ok ({args.provider}): {args.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
