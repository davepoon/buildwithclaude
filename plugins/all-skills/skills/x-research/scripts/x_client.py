#!/usr/bin/env python3
"""AgentBody X/Twitter read client for agent workflows."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
from typing import Any
import urllib.error
import urllib.parse
import urllib.request


BASE_URL = "https://api.agentbody.io"
REQUEST_TIMEOUT = 60
LOGIN_URL = "https://agentbody.io/login"
BILLING_URL = "https://agentbody.io/console/billing"


def _credential_value(path: Path) -> str:
    try:
        lines = path.read_text(encoding="utf-8-sig", errors="replace").splitlines()
    except OSError:
        return ""
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):].lstrip()
        name, separator, value = line.partition("=")
        if not separator or name.strip() != "AGENTBODY_API_KEY":
            continue
        value = value.strip()
        if value[:1] in ("'", '"'):
            end = value.find(value[0], 1)
            value = value[1:end] if end != -1 else value[1:]
        else:
            for marker in (" #", "\t#"):
                value = value.split(marker, 1)[0]
            value = value.strip()
        if value and "�" not in value:
            return value
    return ""


def resolve_api_key() -> str:
    """Resolve the current AgentBody key without reading sibling profiles."""
    home = Path(os.path.expanduser("~"))
    key = _credential_value(home / ".agentbody" / "credentials")
    if key:
        return key

    key = os.environ.get("AGENTBODY_API_KEY", "").strip()
    if key:
        return key

    candidates = []
    hermes_home = Path(os.environ.get("HERMES_HOME") or home / ".hermes")
    profile = os.environ.get("HERMES_PROFILE", "").strip()
    if profile:
        candidates.append(hermes_home / "profiles" / profile / ".env")
    candidates.append(hermes_home / ".env")
    for path in candidates:
        key = _credential_value(path)
        if key:
            return key
    return ""


class AgentBodyXClient:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or resolve_api_key()
        if not self.api_key:
            raise ValueError(
                "AGENTBODY_API_KEY is not configured. Sign in or create an account, "
                f"create a key, and complete one-time setup: {LOGIN_URL}"
            )

    def _request(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        query = urllib.parse.urlencode({key: value for key, value in params.items() if value is not None})
        url = f"{BASE_URL}{path}" + (f"?{query}" if query else "")
        request = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Accept": "application/json",
                "User-Agent": "AgentBody-X-Research/1.0",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                body = response.read().decode("utf-8")
                return json.loads(body) if body else {}
        except urllib.error.HTTPError as error:
            if error.code == 401:
                return {"error": {"code": "UNAUTHORIZED", "message": f"Sign in or create an AgentBody account and configure a key: {LOGIN_URL}"}}
            if error.code == 402:
                return {"error": {"code": "INSUFFICIENT_BALANCE", "message": f"Your AgentBody balance is insufficient. Recharge here: {BILLING_URL}"}}
            return {"error": {"code": f"HTTP_{error.code}", "message": "AgentBody request failed."}}
        except urllib.error.URLError:
            return {"error": {"code": "NETWORK_ERROR", "message": "AgentBody could not be reached."}}

    def search(self, query: str, cursor: str | None = None) -> dict[str, Any]:
        return self._request("/v1/twitter/search", {"query": query, "cursor": cursor})

    def trending(self, country: str | None = None) -> dict[str, Any]:
        return self._request("/v1/twitter/trending", {"country": country})

    def post(self, post_id: str) -> dict[str, Any]:
        return self._request("/v1/twitter/post", {"post_id": post_id})

    def profile(self, username: str) -> dict[str, Any]:
        return self._request("/v1/twitter/profile", {"username": username})

    def profile_posts(self, username: str, cursor: str | None = None) -> dict[str, Any]:
        return self._request("/v1/twitter/profile/posts", {"username": username, "cursor": cursor})

    def profile_media(self, username: str, cursor: str | None = None) -> dict[str, Any]:
        return self._request("/v1/twitter/profile/media", {"username": username, "cursor": cursor})

    def post_comments(self, post_id: str, cursor: str | None = None) -> dict[str, Any]:
        return self._request("/v1/twitter/post/comments", {"post_id": post_id, "cursor": cursor})


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Read current public X/Twitter data through AgentBody.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    command = subparsers.add_parser("search", help="Search public posts.")
    command.add_argument("--query", "-q", required=True)
    command.add_argument("--cursor")

    command = subparsers.add_parser("trending", help="Get trending topics.")
    command.add_argument("--country")

    command = subparsers.add_parser("post", help="Get one public post.")
    command.add_argument("--post-id", required=True)

    command = subparsers.add_parser("profile", help="Get one public profile.")
    command.add_argument("--username", required=True)

    for name, help_text in (("profile-posts", "Get public profile posts."), ("profile-media", "Get public profile media.")):
        command = subparsers.add_parser(name, help=help_text)
        command.add_argument("--username", required=True)
        command.add_argument("--cursor")

    command = subparsers.add_parser("comments", help="Get public post comments.")
    command.add_argument("--post-id", required=True)
    command.add_argument("--cursor")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    try:
        client = AgentBodyXClient()
    except ValueError as error:
        print(json.dumps({"error": {"code": "UNAUTHORIZED", "message": str(error)}}))
        raise SystemExit(1) from error

    handlers = {
        "search": lambda: client.search(args.query, args.cursor),
        "trending": lambda: client.trending(args.country),
        "post": lambda: client.post(args.post_id),
        "profile": lambda: client.profile(args.username),
        "profile-posts": lambda: client.profile_posts(args.username, args.cursor),
        "profile-media": lambda: client.profile_media(args.username, args.cursor),
        "comments": lambda: client.post_comments(args.post_id, args.cursor),
    }
    result = handlers[args.command]()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(1 if "error" in result else 0)


if __name__ == "__main__":
    main()
