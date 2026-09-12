---
name: go-table-tests
description: Writes and refactors Go tests as idiomatic table-driven tests (t.Run subtests, clear got/want messages, t.Helper helpers, safe t.Parallel, httptest for handlers, fuzz seeds, benchmarks with b.Loop). Use when the user asks to add, fix, extend or clean up Go tests, when creating or editing a _test.go file, when a Go function or HTTP handler has no tests, when a bug fix needs a regression test, or when several near-identical test functions should become one table.
category: development-code
license: MIT
---

# Go table-driven tests

Goal: tests that are cheap to extend (add a row, not a function), print a failure a stranger can act on, and pass deterministically under `go test -race -count=1 ./...`.

## Before writing

1. Read the function under test and its callers. List behaviours: happy path, every validation branch, every error return, boundaries (0, 1, max, max+1, empty, nil, unicode), and concurrent use if it holds state.
2. Check what the package already uses: stdlib only, `github.com/google/go-cmp/cmp`, or `testify`. Match it. Do not add an assertion library to a project that has none.
3. Check the `go` directive in go.mod; some helpers below need a minimum version.
4. Choose the package: `package foo_test` (black-box, tests the public API, preferred for exported code) or `package foo` (white-box, for unexported helpers or injecting fakes into unexported fields).

## Canonical shape

```go
func TestParseSize(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		want    int64
		wantErr error // matched with errors.Is; nil means success
	}{
		{name: "bytes", in: "512", want: 512},
		{name: "kibibytes", in: "4KiB", want: 4096},
		{name: "surrounding spaces", in: " 1KiB ", want: 1024},
		{name: "empty", in: "", wantErr: ErrEmpty},
		{name: "negative", in: "-1", wantErr: ErrNegative},
		{name: "unknown unit", in: "3XB", wantErr: ErrUnit},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseSize(tt.in)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("ParseSize(%q) error = %v, want %v", tt.in, err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("ParseSize(%q) = %d, want %d", tt.in, got, tt.want)
			}
		})
	}
}
```

`errors.Is(nil, nil)` is true, so one comparison covers "expected success" and "expected this error".

## Rules

- **Names**: short, lowercase, unique, and describing the case, not the expected result ("empty input", not "returns error"). Spaces become underscores, so `go test -run 'TestParseSize/empty'` works.
- **Messages**: `Func(args) = got, want want`. Print the input. Got before want.
- **Fatal vs Error**: `t.Fatalf` when continuing would panic or be meaningless (unexpected error, nil result); `t.Errorf` otherwise so one run reports every mismatch.
- **Comparing structs**: with go-cmp, `if diff := cmp.Diff(tt.want, got); diff != "" { t.Errorf("Func() mismatch (-want +got):\n%s", diff) }`. Stdlib only: compare fields explicitly or use `reflect.DeepEqual` for plain data. Compare `time.Time` with `Equal`, never `==`.
- **Errors**: prefer `wantErr error` + `errors.Is`. For typed errors use `errors.As` and check fields. Substring matching on `err.Error()` is a last resort for errors you do not own.
- **One behaviour per row**. If rows need very different setup or assertions, write a separate test function instead of adding `if tt.special` branches.
- **Table as slice** keeps order stable. A `map[string]struct{...}` is also idiomatic and randomizes order, which surfaces hidden coupling between cases.
- **Loop variables**: since Go 1.22 each iteration has its own `tt`. Delete `tt := tt` when go.mod says `go 1.22` or later.

## Helpers, setup, cleanup

```go
func newTestStore(t *testing.T) *Store {
	t.Helper() // failures point at the caller's line
	dir := t.TempDir() // removed automatically
	s, err := Open(filepath.Join(dir, "db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}
```

- `t.Helper()` is the first line of every helper that can fail.
- Use `t.Cleanup` over `defer` inside helpers; it runs when the test (not the helper) ends.
- `t.Context()` (Go 1.24+) returns a context canceled just before cleanup runs. On older Go: `ctx, cancel := context.WithCancel(context.Background()); t.Cleanup(cancel)`.
- `t.Setenv` and `t.Chdir` (Go 1.24+) restore state automatically but cannot be combined with `t.Parallel()`. Better: make the code take `getenv func(string) string` and pass a map.

## Parallelism

Call `t.Parallel()` in the parent and in each subtest only when rows share no mutable state (no shared fake, no package globals, no `t.Setenv`). Parallel subtests finish before the parent's `t.Cleanup` runs, so shared fixtures created in the parent are safe to read.

## Determinism

- Inject time: `now func() time.Time` field or parameter. Never assert on `time.Now()`.
- Inject randomness and IDs (`newID func() string`).
- Never `time.Sleep` to wait for a goroutine. Synchronize with channels or `sync.WaitGroup`, or use `testing/synctest` (stable in Go 1.25 as `synctest.Test`; experimental in Go 1.24 behind `GOEXPERIMENT=synctest`).
- Run new tests with `-count=10 -race` once to flush out flakiness.

## HTTP handlers

```go
req := httptest.NewRequest(http.MethodPost, "/v1/items", strings.NewReader(`{"name":"x"}`))
req.Header.Set("Content-Type", "application/json")
rec := httptest.NewRecorder()
handler.ServeHTTP(rec, req)
if rec.Code != http.StatusCreated {
	t.Fatalf("status = %d, want %d; body: %s", rec.Code, http.StatusCreated, rec.Body)
}
```

Test through the router (the real `http.Handler`) so path patterns and middleware are exercised. Use `httptest.NewServer` when testing an HTTP client.

## Fakes over mocks

Write small hand-rolled fakes for the interfaces your code consumes. To override one method of a big interface, embed it:

```go
type failingRepo struct {
	Repository // nil: any method you did not override panics, loudly
	err error
}
func (f failingRepo) Save(context.Context, Item) error { return f.err }
```

## Fuzz and golden files

- Turn good table inputs into fuzz seeds: `for _, tt := range tests { f.Add(tt.in) }`, then assert properties (no panic, round-trip `Parse(Format(x)) == x`). Run with `go test -fuzz=FuzzParseSize -fuzztime=30s`.
- Large expected outputs go in `testdata/*.golden` with an `-update` flag: `var update = flag.Bool("update", false, "update golden files")`.

## Benchmarks (Go 1.24+)

```go
func BenchmarkParseSize(b *testing.B) {
	for b.Loop() { // setup before the loop is excluded from timing
		ParseSize("4KiB")
	}
}
```

On older Go use `for i := 0; i < b.N; i++` and `b.ResetTimer()` after setup.

## Checklist before you finish

- [ ] Every error branch in the function has a row.
- [ ] Failure messages include the input and got/want.
- [ ] No sleeps, no real network, no dependence on wall-clock time or map order.
- [ ] `go test -race -count=1 ./<pkg>` passes; `go vet ./<pkg>` is clean.
- [ ] A bug-fix test fails without the fix (say so in your summary).
