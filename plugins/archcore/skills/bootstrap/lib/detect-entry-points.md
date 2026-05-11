# Entry-Point Detection

Detects where the application enters from: HTTP handlers, CLI binaries, background workers, scheduled jobs. Used for the entry-point inventory `doc` in medium and large modes.

## Language-independent filename patterns

Files with these names/locations are entry-point candidates regardless of language:

| Pattern | Typical role |
|---|---|
| `main.{go,py,rs,kt,java,c,cpp}` | program entry |
| `cmd/*/main.go` | Go-convention binary |
| `bin/*` (executable) | CLI binary |
| `index.{ts,js,mjs,cjs}` at package root | module entry |
| `server.{ts,js,py,go,rs}` | HTTP server entry |
| `worker.{ts,js,py,go,rs}` | background worker entry |
| `cli.{ts,js,py,go,rs}` | CLI entry |
| `app.{ts,js,py,rs}` | application entry |
| `Program.cs` | .NET main |
| `Application.{java,kt}` | Spring / Ktor main |

## HTTP-route markers (grep-based)

Source files containing any of these patterns are classified as HTTP entry points.

### TypeScript / JavaScript

- `app\.(get|post|put|delete|patch|all)\s*\(`
- `router\.(get|post|put|delete|patch|all)\s*\(`
- `createServer\s*\(`
- `serve\s*\(` (Bun/Deno)
- Next.js App Router route handlers: files at `**/route.{ts,js}` under `app/`, plus `export (async )?(function|const) (GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b`
- Next.js Pages Router: files under `pages/api/**`

### Python

- `@app\.(get|post|put|delete|patch|route)`
- `@router\.(get|post|put|delete|patch)`
- `FastAPI\s*\(`
- `Flask\s*\(`
- `path\s*\(` inside `urls.py` (Django)
- `blueprint\.route`

### Go

- `http\.HandleFunc\s*\(`
- `mux\.(HandleFunc|Handle)\s*\(`
- `router\.(GET|POST|PUT|DELETE|PATCH|Handle)\s*\(` (gin, chi, echo)
- `e\.(GET|POST|PUT|DELETE|PATCH)\s*\(` (echo)
- Any file under `cmd/*/` with `func main\s*\(`

### Rust

- `#\[(get|post|put|delete|patch)\s*\(` (actix-web)
- `\.route\s*\(` chained from `Router::new\s*\(` (axum)
- `rocket::routes!`, `#[rocket::main]`

### Java / Kotlin

- `@RestController`, `@Controller`
- `@RequestMapping`, `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`
- Ktor `routing {`, `get("/...")`, `post("/...")`

### Ruby

- `Rails.application.routes.draw` (`config/routes.rb`)
- `get '/...'`, `post '/...'` inside Sinatra apps

## CLI markers

Files are classified as CLI entries when any of:

- File name matches `cli.*`, `bin/*` (executable), or `cmd/*/main.go`.
- File imports a CLI framework:
  - TS/JS: `commander`, `yargs`, `cac`, `citty`, `clipanion`
  - Python: `click`, `typer`, `argparse` (weak signal — require also `if __name__ == "__main__":`)
  - Go: `cobra`, `urfave/cli`, `kingpin`
  - Rust: `clap`, `structopt`
  - Ruby: `thor`, `optparse` + `ARGV`

## Worker / job markers

Files are classified as workers when any of:

- File name matches `worker.*`, `consumer.*`, `processor.*`.
- File imports a queue/job library:
  - TS/JS: `bull`, `bullmq`, `bee-queue`, `agenda`, `kafkajs` with `consumer`
  - Python: `celery` (@task decorators), `rq`, `dramatiq`, `arq`
  - Go: `asynq`, `machinery`, any file importing `github.com/segmentio/kafka-go` with `Reader`
  - Rust: `lapin` (RabbitMQ), `rdkafka` consumer

## Cron / scheduled markers

- `cron\.schedule`, `new CronJob`, `@scheduled`, `@Scheduled`
- Files under `cron/`, `scheduled/`
- `node-cron`, `schedule` (Python), `gocron`

## Classification buckets for inventory doc

Group detected entry points by role:

1. **HTTP** — files with route decorators/handlers.
2. **CLI** — `bin/*`, `cmd/*/main.*`, framework-based CLI entries.
3. **Worker** — queue consumers, job processors.
4. **Cron** — scheduled tasks.
5. **Other** — `main.*` files that don't fit other categories; module root `index.*`.

## One-liner per entry

Template:

```
<relative-path> — <role>. <extracted-signature-or-top-comment>.
```

Signature extraction:

- HTTP: capture the first route + method found. Example: `POST /api/oauth/callback`.
- CLI: capture the first command name. Example: `bootstrap`.
- Worker: capture the queue / topic name. Example: `queue: email-notifications`.
- Cron: capture the schedule expression. Example: `every 5 minutes`.
- Fallback: top-of-file comment, first 80 chars.

## Monorepo grouping (large mode)

Group entries by domain (see `detect-domains.md`). Example output:

```
### domain:apps-billing-api
- apps/billing-api/src/server.ts — HTTP. Exposes /invoices, /payments.
- apps/billing-api/src/worker.ts — Worker. queue: invoice-events.

### domain:apps-notifications
- apps/notifications/src/main.go — Worker. topic: user-events.
```

Each section header matches the domain's slug (per `detect-domains.md` "Domain tags").
