# Module Detection

Language-agnostic source-file enumeration. Used for `module_count`, hotspot ranking, and test-LOC companion lookup.

## Source-file extension allowlist

| Language | Extensions |
|---|---|
| TypeScript / JavaScript | `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` |
| Python | `.py` |
| Go | `.go` |
| Rust | `.rs` |
| Java | `.java` |
| Kotlin | `.kt`, `.kts` |
| Ruby | `.rb` |
| PHP | `.php` |
| C# | `.cs` |
| Swift | `.swift` |
| Scala | `.scala` |
| Elixir | `.ex`, `.exs` |

Files with extensions not on this list are ignored for `module_count` and hotspot ranking. JSON, YAML, TOML, Markdown are intentionally excluded.

## Test-file exclusion patterns

A source file is treated as a test (and excluded from `module_count`) if it matches any of these per-language patterns:

| Language | Test patterns |
|---|---|
| TS / JS | `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`, `*.test.js`, `*.spec.js`, `**/__tests__/**` |
| Python | `test_*.py`, `*_test.py`, `**/tests/**`, `**/test/**` |
| Go | `*_test.go` |
| Rust | `**/tests/**` (integration tests); unit tests in `#[cfg(test)]` blocks are not detectable without parsing — accept the undercount |
| Java | `*Test.java`, `*Tests.java`, `**/src/test/**`, `**/src/integrationTest/**` |
| Kotlin | `*Test.kt`, `*Tests.kt`, `*Spec.kt`, `**/src/test/**` |
| Ruby | `*_spec.rb`, `*_test.rb`, `**/spec/**`, `**/test/**` |
| PHP | `*Test.php`, `**/tests/**` |
| C# | `*Tests.cs`, `**/test/**`, `**/tests/**` |

## Generated / vendored / build exclusion

Always exclude files under these paths (regardless of extension):

- `node_modules/`, `vendor/`, `.venv/`, `venv/`, `.pnpm/`
- `dist/`, `build/`, `out/`, `target/`, `.next/`, `.nuxt/`, `.svelte-kit/`
- `coverage/`, `.nyc_output/`
- `generated/`, `__generated__/`, `.generated/`
- Any path segment starting with `.` except the repo root itself (e.g. skip `.git/`, `.cache/`, `.turbo/`)

Extension-based exclusion:

- `*.pb.go`, `*.pb.ts`, `*.pb.js` (protobuf)
- `*.generated.*`, `*.g.{ts,go,dart}`
- `*.min.js`, `*.min.css`

## LOC counting

Count total lines via `wc -l < <file>`. Do not subtract blank or comment lines.

## Test-LOC companion lookup

For each source file, its "companion test LOC" is the sum of LOC of obvious partner test files:

| Source | Companion candidates |
|---|---|
| `src/foo.ts` | `src/foo.test.ts`, `src/foo.spec.ts`, `src/__tests__/foo.test.ts`, `tests/foo.test.ts` |
| `src/foo.py` | `src/test_foo.py`, `tests/test_foo.py`, `tests/foo_test.py` |
| `foo.go` | `foo_test.go` (same package directory) |
| `src/foo.rs` | `tests/foo.rs`, `src/foo.rs` itself (has `#[cfg(test)]` — count LOC if the pattern `#\[cfg\(test\)\]` appears) |
| `src/Foo.java` | `src/test/**/FooTest.java`, `src/test/**/FooTests.java` |
| `src/Foo.kt` | `src/test/**/FooTest.kt`, `src/test/**/FooSpec.kt` |
| `src/foo.rb` | `spec/foo_spec.rb`, `test/foo_test.rb` |

Sum LOC of all matches. If no match: companion test LOC = 0.

## Git-ignored exclusion (optional)

If `git` is available, additionally exclude files that would match `.gitignore`:

```
git check-ignore -q <file>
```

This guards against unexpected build artifacts left in the working tree. Fall back to path-based exclusion when `git` is unavailable.
