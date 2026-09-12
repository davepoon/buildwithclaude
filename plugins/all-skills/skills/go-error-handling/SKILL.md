---
name: go-error-handling
description: Applies idiomatic Go error handling (wrapping with %w, sentinel vs typed errors, errors.Is/As/Join, handle-once, translating errors at layer boundaries, safe defer-close, panics only for programmer bugs). Use when writing or reviewing Go code that creates, returns, wraps, logs or checks errors, when designing a package's error API, when mapping domain errors to HTTP/gRPC status codes, or when the user asks why an errors.Is check fails.
category: development-code
license: MIT
---

# Go error handling

## Core rules

1. **Add context when you return**, describing what *this* function was doing, not what failed below it:
   `return fmt.Errorf("load invoice %s: %w", id, err)`. The final message reads like a path: `create order: load invoice 42: query: connection refused`.
2. **Handle once.** Either return the error (wrapped) or handle it (log, fall back, retry, convert to a response). Log-and-return produces duplicate log lines with no extra information.
3. **Match with `errors.Is` / `errors.As`**, never `err == ErrX` on a possibly wrapped error, and never `strings.Contains(err.Error(), ...)` on errors you own.
4. **Error strings** are lowercase, no trailing punctuation, no "failed to"/"error:" prefixes (`open config: permission denied`, not `Failed to open config.`).
5. **Check every error.** `_ =` only with a comment explaining why ignoring is safe.

## Choosing `%w` vs `%v`

`%w` makes the wrapped error part of your API: callers can `errors.Is` it, and you can no longer swap the underlying library without breaking them. Use `%w` for your own sentinels and for errors callers are expected to inspect (e.g. `context.Canceled`, `fs.ErrNotExist`). Use `%v` at a boundary where you deliberately hide the implementation (e.g. do not leak `pgx` errors out of your repository package).

## Designing a package's errors

| Need | Use | Example |
|---|---|---|
| Caller branches on a condition | Sentinel | `var ErrNotFound = errors.New("user not found")` |
| Caller needs data about the failure | Typed error | `type ValidationError struct{ Field, Msg string }` |
| Several independent failures | `errors.Join(errs...)` | config validation reporting every bad field |
| Nobody branches on it | `fmt.Errorf` | most errors |

Typed errors use pointer receivers and are matched with `errors.As`:

```go
type ValidationError struct{ Field, Msg string }

func (e *ValidationError) Error() string { return e.Field + " " + e.Msg }

// Optional: let it match a category sentinel too.
func (e *ValidationError) Is(target error) bool { return target == ErrInvalid }

var ve *ValidationError
if errors.As(err, &ve) {
	log.Printf("bad field %s", ve.Field)
}
```

Never return a typed nil pointer as an `error`; the interface is non-nil:

```go
func validate() error {
	var ve *ValidationError // nil pointer
	return ve               // BUG: err != nil is true for the caller
}
```

## Translating at boundaries

Each layer speaks its own vocabulary:

```go
// repository: storage error -> domain error
if errors.Is(err, pgx.ErrNoRows) { // or sql.ErrNoRows
	return User{}, fmt.Errorf("get user %d: %w", id, domain.ErrNotFound)
}

// transport: domain error -> status code, in ONE function
func statusFor(err error) int {
	var ve *domain.ValidationError
	switch {
	case errors.As(err, &ve):
		return http.StatusUnprocessableEntity
	case errors.Is(err, domain.ErrNotFound):
		return http.StatusNotFound
	case errors.Is(err, domain.ErrConflict):
		return http.StatusConflict
	case errors.Is(err, context.DeadlineExceeded):
		return http.StatusGatewayTimeout
	default:
		return http.StatusInternalServerError // log full err; send a generic message
	}
}
```

Clients get a stable, safe message. Full detail (wrapped chain, IDs) goes to logs only.

## Close and defer

Errors from `Close` on writable resources matter (buffered data may not be flushed). Use a named result and `errors.Join`:

```go
func writeReport(path string, r Report) (err error) {
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create report: %w", err)
	}
	defer func() { err = errors.Join(err, f.Close()) }()

	if err := json.NewEncoder(f).Encode(r); err != nil {
		return fmt.Errorf("encode report: %w", err)
	}
	return nil
}
```

For read-only handles (`resp.Body`, `rows`) a plain `defer x.Close()` is fine, but for `*sql.Rows` always check `rows.Err()` after the loop.

## Context errors

- Check `ctx.Err()` before expensive work in loops.
- `context.Canceled` usually means the caller went away: do not log it at error level, do not retry.
- `context.DeadlineExceeded` is a timeout: map to 504/`codes.DeadlineExceeded`, consider retrying if the operation is idempotent.
- `context.Cause(ctx)` returns the reason given to `context.WithCancelCause`; use it in error messages.

## Panics

- `panic` only for programmer errors that cannot happen in correct code (impossible switch default, violated invariant, `Must*` helpers used at init with constant input).
- Never panic across a package boundary for expected failures (bad input, I/O, not found).
- Recover only at goroutine or request boundaries (HTTP middleware, worker loop), log with stack, and convert to a 500 or a restart. Re-panic `http.ErrAbortHandler`.
- A panic in a goroutine you started crashes the whole process; recovery middleware does not cover it.

## Review checklist

- [ ] No ignored errors (`go vet` does not catch these; look for `x, _ :=` and bare calls like `f.Close()` on writers).
- [ ] No `err` shadowing that drops an error (`err :=` inside an `if` block, then the outer `err` is returned).
- [ ] Wrapping adds context without repeating the callee's words.
- [ ] Sentinels are compared with `errors.Is`, typed errors with `errors.As`.
- [ ] Error-to-status mapping lives in one place and defaults to 500 without leaking detail.
- [ ] No log-and-return.
- [ ] No typed-nil returned as `error`.
