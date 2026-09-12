---
name: go-module-hygiene
description: Keeps Go modules and dependencies healthy (go.mod go/toolchain directives, go mod tidy, go.sum, the Go 1.24 tool directive, replace and go.work pitfalls, major-version import paths, upgrades, govulncheck, private modules). Use when adding, upgrading or removing a Go dependency, when editing go.mod or go.work, when `go build` reports missing or ambiguous modules, when setting up dev tools like staticcheck or mockgen, or when the user asks about Go versions, vulnerabilities or private repos.
category: development-code
license: MIT
---

# Go module hygiene

## Ground rules

- Never hand-edit `go.sum`. Change imports or `go.mod`, then run `go mod tidy`.
- Commit `go.mod` and `go.sum` together. Do not commit `go.work` or `go.work.sum` unless the repo is intentionally a multi-module workspace.
- After any dependency change run: `go mod tidy && go build ./... && go test ./...`.
- Prefer the standard library. Before adding a module, check: is it maintained (recent commits/releases), how many transitive deps does it pull (`go mod graph | wc -l` before/after), is the license compatible.

## `go` and `toolchain` directives

- `go 1.24` is the minimum language version; it also enables version-gated semantics (per-iteration loop vars since 1.22).
- `toolchain go1.24.5` is only a preference for which toolchain to use when the local one is older. Do not add or bump `toolchain` unless asked.
- Raising the `go` line for a library forces it on every consumer. Raise it only when you need a feature; say so in the commit.

## Adding and upgrading

```bash
go get example.com/lib@v1.4.2      # exact version (preferred in reviews)
go get example.com/lib@latest      # newest release
go get -u=patch ./...              # patch upgrades for everything used by the module
go list -m -u all                  # what is outdated
go mod why -m example.com/lib      # who needs this module
go mod graph | grep example.com/lib
```

Avoid `go get -u ./...` in a feature branch: it upgrades every transitive dependency (minor versions included) and turns a small change into a risky one. Do broad upgrades in a dedicated PR.

## Major versions

Modules at v2+ must include the major version in the path: `github.com/jackc/pgx/v5`. Importing `github.com/jackc/pgx` gets v1-era code. When a user says "upgrade to v5", that means changing import paths, not just `go get`.

## Dev tools (Go 1.24 `tool` directive)

Go 1.24 tracks tools in go.mod instead of a `tools.go` file:

```bash
go get -tool honnef.co/go/tools/cmd/staticcheck@latest
go tool staticcheck ./...
go get -tool github.com/sqlc-dev/sqlc/cmd/sqlc@v1.27.0
```

This pins the tool version in go.mod/go.sum for the whole team. Downside: tool dependencies show up in the module graph; for libraries consumed by others you may prefer `go run pkg@version` in the Makefile instead. On Go < 1.24 keep the `//go:build tools` + blank-import `tools.go` pattern.

## `replace` directives

- OK temporarily for local debugging (`replace example.com/lib => ../lib`), never in a commit on main.
- OK permanently in an application (not a library) to pin a fork, with a comment and an issue link.
- `replace` in a dependency's go.mod is ignored by your build, so a library cannot fix its own dependencies that way.
- For local multi-module work use `go work init . ../lib` and keep go.work uncommitted.

## Vulnerabilities

```bash
go run golang.org/x/vuln/cmd/govulncheck@latest ./...
```

govulncheck reports only vulnerabilities in code your program actually calls, which keeps noise low. Fix by upgrading the module to the listed fixed version; for stdlib findings, upgrade the Go toolchain (patch releases).

## Private modules

```bash
go env -w GOPRIVATE='github.com/your-org/*'
git config --global url."git@github.com:".insteadOf "https://github.com/"
```

`GOPRIVATE` skips the public proxy and checksum database for matching paths. In CI, provide a token via `.netrc` or `GOAUTH` (Go 1.24+) instead of rewriting URLs.

## Layout reminders

- Code under `internal/` can only be imported by code rooted at the parent of `internal`. Put everything not meant for other modules there.
- One module per repo is the default. Split into several modules only when parts must be versioned separately; multi-module repos make every change harder.

## Checklist

- [ ] `go mod tidy` leaves no diff.
- [ ] No `replace` pointing at a local path.
- [ ] New dependency justified (what it replaces, why not stdlib).
- [ ] Major-version path correct.
- [ ] `govulncheck ./...` clean or findings explained.
