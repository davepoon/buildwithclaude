---
name: gitlawb-sidecar
category: development
description: >
  Add a signed GitLawb mirror next to the existing GitHub remote. Use when the
  user wants to publish, backup, prove authorship, put work on GitLawb, or
  attach a verifiable certificate to a commit or pull request. Do NOT use for
  replacing GitHub, deleting origin, or pushing private/secret files.
---

# GitLawb sidecar

GitHub stays `origin`. This tool adds a second remote named `gitlawb` and
pushes a **public** signed copy to `https://node.gitlawb.com`.

## Commands

```sh
npx gitlawb-sidecar@latest init      # first time in a repo
npx gitlawb-sidecar@latest sync      # push HEAD and fetch the cert
npx gitlawb-sidecar@latest verify    # check HEAD has a matching cert
npx gitlawb-sidecar@latest status
npx gitlawb-sidecar@latest doctor    # exits 1 if anything is wrong
```

## Rules

- Never run a command named `gl`. oh-my-zsh aliases `gl` to `git pull`.
- Never change, rename, or delete the `origin` remote.
- Never push `.env`, `identity.pem`, private keys, or anything the user
  would not put on a public GitHub repo. GitLawb copies are public.
- After `init` or `sync`, paste the explorer URL and cert id in your reply.
- If `gitlawb-sidecar` is not installed, use `npx gitlawb-sidecar@latest`.
- If `doctor` fails, fix what it prints. Do not invent `gitlawb://` URLs.

## First-time flow

```sh
npx gitlawb-sidecar@latest init
```

This creates a DID if needed, registers on the public node, adds the
`gitlawb` remote, pushes HEAD, and writes:

- `.gitlawb-sidecar.json`
- `.github/workflows/gitlawb-sidecar.yml`
- this skill under `.claude/skills`, `.agents/skills`, and `.cursor/skills`

Tell the user to add repo secret `GITLAWB_IDENTITY_PEM` (contents of
`identity.pem`) so GitHub Actions can sign. Point them at
`npx gitlawb-sidecar status --show-pem-hint`.
