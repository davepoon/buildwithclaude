#!/usr/bin/env bash
# Analyzes a project directory and outputs a JSON report of detected tech stack.
# Usage: analyze-project.sh [project_dir]

set -uo pipefail

DIR="${1:-.}"
cd "$DIR"

# --- Helpers ---
has_file() { [ -f "$1" ] && echo "true" || echo "false"; }
has_dir() { [ -d "$1" ] && echo "true" || echo "false"; }
count_files() { find . -maxdepth 5 -name "$1" -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/vendor/*' -not -path '*/venv/*' -not -path '*/__pycache__/*' -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/target/*' -not -path '*/.next/*' -not -path '*/.nuxt/*' 2>/dev/null | wc -l | tr -d ' '; }

# --- Language Detection ---
langs=()
ts_count=$(count_files "*.ts")
tsx_count=$(count_files "*.tsx")
js_count=$(count_files "*.js")
jsx_count=$(count_files "*.jsx")
py_count=$(count_files "*.py")
go_count=$(count_files "*.go")
rs_count=$(count_files "*.rs")
java_count=$(count_files "*.java")
kt_count=$(count_files "*.kt")
swift_count=$(count_files "*.swift")
rb_count=$(count_files "*.rb")
php_count=$(count_files "*.php")
cs_count=$(count_files "*.cs")
dart_count=$(count_files "*.dart")
vue_count=$(count_files "*.vue")
svelte_count=$(count_files "*.svelte")
c_count=$(count_files "*.c")
cpp_count=$(count_files "*.cpp")
h_count=$(count_files "*.h")
hpp_count=$(count_files "*.hpp")
scala_count=$(count_files "*.scala")
clj_count=$(count_files "*.clj")
ex_count=$(count_files "*.ex")
exs_count=$(count_files "*.exs")
zig_count=$(count_files "*.zig")
nim_count=$(count_files "*.nim")
lua_count=$(count_files "*.lua")
r_count=$(count_files "*.R")
pl_count=$(count_files "*.pl")
hs_count=$(count_files "*.hs")
ml_count=$(count_files "*.ml")
sql_count=$(count_files "*.sql")
proto_count=$(count_files "*.proto")
graphql_count=$(count_files "*.graphql")
gql_count=$(count_files "*.gql")
tf_count=$(count_files "*.tf")
sol_count=$(count_files "*.sol")
move_count=$(count_files "*.move")
cairo_count=$(count_files "*.cairo")
wasm_count=$(count_files "*.wasm")
astro_count=$(count_files "*.astro")
mdx_count=$(count_files "*.mdx")
ipynb_count=$(count_files "*.ipynb")

[ "$ts_count" -gt 0 ] || [ "$tsx_count" -gt 0 ] && langs+=("typescript")
[ "$js_count" -gt 0 ] || [ "$jsx_count" -gt 0 ] && langs+=("javascript")
[ "$py_count" -gt 0 ] && langs+=("python")
[ "$go_count" -gt 0 ] && langs+=("go")
[ "$rs_count" -gt 0 ] && langs+=("rust")
[ "$java_count" -gt 0 ] && langs+=("java")
[ "$kt_count" -gt 0 ] && langs+=("kotlin")
[ "$swift_count" -gt 0 ] && langs+=("swift")
[ "$rb_count" -gt 0 ] && langs+=("ruby")
[ "$php_count" -gt 0 ] && langs+=("php")
[ "$cs_count" -gt 0 ] && langs+=("csharp")
[ "$dart_count" -gt 0 ] && langs+=("dart")
[ "$vue_count" -gt 0 ] && langs+=("vue")
[ "$svelte_count" -gt 0 ] && langs+=("svelte")
[ "$c_count" -gt 0 ] || [ "$h_count" -gt 0 ] && langs+=("c")
[ "$cpp_count" -gt 0 ] || [ "$hpp_count" -gt 0 ] && langs+=("cpp")
[ "$scala_count" -gt 0 ] && langs+=("scala")
[ "$clj_count" -gt 0 ] && langs+=("clojure")
[ "$ex_count" -gt 0 ] || [ "$exs_count" -gt 0 ] && langs+=("elixir")
[ "$zig_count" -gt 0 ] && langs+=("zig")
[ "$nim_count" -gt 0 ] && langs+=("nim")
[ "$lua_count" -gt 0 ] && langs+=("lua")
[ "$r_count" -gt 0 ] && langs+=("r")
[ "$pl_count" -gt 0 ] && langs+=("perl")
[ "$hs_count" -gt 0 ] && langs+=("haskell")
[ "$ml_count" -gt 0 ] && langs+=("ocaml")
[ "$sql_count" -gt 0 ] && langs+=("sql")
[ "$proto_count" -gt 0 ] && langs+=("protobuf")
[ "$graphql_count" -gt 0 ] || [ "$gql_count" -gt 0 ] && langs+=("graphql")
[ "$tf_count" -gt 0 ] && langs+=("terraform-hcl")
[ "$sol_count" -gt 0 ] && langs+=("solidity")
[ "$move_count" -gt 0 ] && langs+=("move")
[ "$cairo_count" -gt 0 ] && langs+=("cairo")
[ "$astro_count" -gt 0 ] && langs+=("astro")
[ "$mdx_count" -gt 0 ] && langs+=("mdx")
[ "$ipynb_count" -gt 0 ] && langs+=("jupyter")

# --- Package Manager ---
pkg_manager="unknown"
[ -f "pnpm-lock.yaml" ] && pkg_manager="pnpm"
[ -f "yarn.lock" ] && pkg_manager="yarn"
[ -f "package-lock.json" ] && pkg_manager="npm"
[ -f "bun.lockb" ] || [ -f "bun.lock" ] && pkg_manager="bun"
[ -f "deno.lock" ] && pkg_manager="deno"
[ -f "Pipfile.lock" ] && pkg_manager="pipenv"
[ -f "poetry.lock" ] && pkg_manager="poetry"
[ -f "uv.lock" ] && pkg_manager="uv"
[ -f "pdm.lock" ] && pkg_manager="pdm"
[ -f "Cargo.lock" ] && pkg_manager="cargo"
[ -f "go.sum" ] && pkg_manager="go-modules"
[ -f "Gemfile.lock" ] && pkg_manager="bundler"
[ -f "composer.lock" ] && pkg_manager="composer"
[ -f "pubspec.lock" ] && pkg_manager="pub"
[ -f "Package.resolved" ] && pkg_manager="swift-pm"
[ -f "mix.lock" ] && pkg_manager="mix"
[ -f "project.clj" ] && pkg_manager="lein"
[ -f "build.sbt" ] && pkg_manager="sbt"
[ -f "stack.yaml.lock" ] && pkg_manager="stack"
[ -f "flake.lock" ] && pkg_manager="nix"

# --- Monorepo Detection ---
is_monorepo="false"
monorepo_tool="none"
if [ -f "pnpm-workspace.yaml" ]; then
  is_monorepo="true"; monorepo_tool="pnpm-workspaces"
elif [ -f "lerna.json" ]; then
  is_monorepo="true"; monorepo_tool="lerna"
elif [ -f "nx.json" ]; then
  is_monorepo="true"; monorepo_tool="nx"
elif [ -f "turbo.json" ]; then
  is_monorepo="true"; monorepo_tool="turborepo"
elif [ -f "rush.json" ]; then
  is_monorepo="true"; monorepo_tool="rush"
elif [ -f "moon.yml" ]; then
  is_monorepo="true"; monorepo_tool="moon"
elif [ -f "pants.toml" ]; then
  is_monorepo="true"; monorepo_tool="pants"
elif [ -f "BUILD" ] || [ -f "WORKSPACE" ]; then
  is_monorepo="true"; monorepo_tool="bazel"
fi
# Check package.json workspaces
if [ "$is_monorepo" = "false" ] && [ -f "package.json" ]; then
  if grep -q '"workspaces"' package.json 2>/dev/null; then
    is_monorepo="true"; monorepo_tool="npm-workspaces"
  fi
fi

# --- Framework Detection ---
frameworks=()

detect_from_deps() {
  local file="$1"
  [ ! -f "$file" ] && return 0

  # --- Frontend Frameworks ---
  grep -q '"next"' "$file" 2>/dev/null && frameworks+=("nextjs") || true
  grep -q '"nuxt"' "$file" 2>/dev/null && frameworks+=("nuxt") || true
  grep -q '"react"' "$file" 2>/dev/null && frameworks+=("react") || true
  grep -q '"vue"' "$file" 2>/dev/null && frameworks+=("vue") || true
  grep -q '"svelte"' "$file" 2>/dev/null && frameworks+=("svelte") || true
  grep -q '"@angular/core"' "$file" 2>/dev/null && frameworks+=("angular") || true
  grep -q '"solid-js"' "$file" 2>/dev/null && frameworks+=("solid") || true
  grep -q '"astro"' "$file" 2>/dev/null && frameworks+=("astro") || true
  grep -q '"gatsby"' "$file" 2>/dev/null && frameworks+=("gatsby") || true
  grep -q '"remix"' "$file" 2>/dev/null && frameworks+=("remix") || true
  grep -q '"@remix-run/' "$file" 2>/dev/null && frameworks+=("remix") || true
  grep -q '"vite"' "$file" 2>/dev/null && frameworks+=("vite") || true
  grep -q '"@tanstack/start"' "$file" 2>/dev/null && frameworks+=("tanstack-start") || true
  grep -q '"@builder.io/qwik"' "$file" 2>/dev/null && frameworks+=("qwik") || true
  grep -q '"preact"' "$file" 2>/dev/null && frameworks+=("preact") || true
  grep -q '"htmx.org"' "$file" 2>/dev/null && frameworks+=("htmx") || true
  grep -q '"alpinejs"' "$file" 2>/dev/null && frameworks+=("alpine") || true
  grep -q '"lit"' "$file" 2>/dev/null && frameworks+=("lit") || true
  grep -q '"@stencil/core"' "$file" 2>/dev/null && frameworks+=("stencil") || true
  grep -q '"ember-source"' "$file" 2>/dev/null && frameworks+=("ember") || true

  # --- Backend Frameworks (Node) ---
  grep -q '"express"' "$file" 2>/dev/null && frameworks+=("express") || true
  grep -q '"koa"' "$file" 2>/dev/null && frameworks+=("koa") || true
  grep -q '"fastify"' "$file" 2>/dev/null && frameworks+=("fastify") || true
  grep -q '"hono"' "$file" 2>/dev/null && frameworks+=("hono") || true
  grep -q '"@nestjs/core"' "$file" 2>/dev/null && frameworks+=("nestjs") || true
  grep -q '"@adonisjs/core"' "$file" 2>/dev/null && frameworks+=("adonisjs") || true
  grep -q '"@trpc/server"' "$file" 2>/dev/null && frameworks+=("trpc") || true
  grep -q '"@elysiajs/core"\|"elysia"' "$file" 2>/dev/null && frameworks+=("elysia") || true
  grep -q '"@hapi/hapi"' "$file" 2>/dev/null && frameworks+=("hapi") || true
  grep -q '"socket.io"' "$file" 2>/dev/null && frameworks+=("socketio") || true

  # --- Meta-frameworks / Full-stack ---
  grep -q '"@redwoodjs/core"' "$file" 2>/dev/null && frameworks+=("redwood") || true
  grep -q '"blitz"' "$file" 2>/dev/null && frameworks+=("blitz") || true
  grep -q '"@t3-oss/env' "$file" 2>/dev/null && frameworks+=("t3-stack") || true
  grep -q '"payload"' "$file" 2>/dev/null && frameworks+=("payload") || true
  grep -q '"strapi"' "$file" 2>/dev/null && frameworks+=("strapi") || true
  grep -q '"directus"' "$file" 2>/dev/null && frameworks+=("directus") || true
  grep -q '"@sanity/' "$file" 2>/dev/null && frameworks+=("sanity") || true
  grep -q '"contentful"' "$file" 2>/dev/null && frameworks+=("contentful") || true
  grep -q '"keystonejs"' "$file" 2>/dev/null && frameworks+=("keystone") || true
  grep -q '"@medusajs/' "$file" 2>/dev/null && frameworks+=("medusa") || true

  # --- CSS / UI Libraries ---
  grep -q '"tailwindcss"' "$file" 2>/dev/null && frameworks+=("tailwind") || true
  grep -q '"@shadcn"' "$file" 2>/dev/null && frameworks+=("shadcn") || true
  grep -q '"@chakra-ui/' "$file" 2>/dev/null && frameworks+=("chakra-ui") || true
  grep -q '"@mantine/' "$file" 2>/dev/null && frameworks+=("mantine") || true
  grep -q '"@mui/' "$file" 2>/dev/null && frameworks+=("material-ui") || true
  grep -q '"antd"' "$file" 2>/dev/null && frameworks+=("antd") || true
  grep -q '"@radix-ui/' "$file" 2>/dev/null && frameworks+=("radix") || true
  grep -q '"styled-components"' "$file" 2>/dev/null && frameworks+=("styled-components") || true
  grep -q '"@emotion/' "$file" 2>/dev/null && frameworks+=("emotion") || true
  grep -q '"sass"' "$file" 2>/dev/null && frameworks+=("sass") || true
  grep -q '"less"' "$file" 2>/dev/null && frameworks+=("less") || true
  grep -q '"bootstrap"' "$file" 2>/dev/null && frameworks+=("bootstrap") || true
  grep -q '"@headlessui/' "$file" 2>/dev/null && frameworks+=("headless-ui") || true
  grep -q '"daisyui"' "$file" 2>/dev/null && frameworks+=("daisyui") || true
  grep -q '"@ark-ui/' "$file" 2>/dev/null && frameworks+=("ark-ui") || true
  grep -q '"framer-motion"' "$file" 2>/dev/null && frameworks+=("framer-motion") || true

  # --- State Management ---
  grep -q '"zustand"' "$file" 2>/dev/null && frameworks+=("zustand") || true
  grep -q '"@reduxjs/toolkit"\|"redux"' "$file" 2>/dev/null && frameworks+=("redux") || true
  grep -q '"jotai"' "$file" 2>/dev/null && frameworks+=("jotai") || true
  grep -q '"recoil"' "$file" 2>/dev/null && frameworks+=("recoil") || true
  grep -q '"mobx"' "$file" 2>/dev/null && frameworks+=("mobx") || true
  grep -q '"@tanstack/react-query"\|"@tanstack/query"' "$file" 2>/dev/null && frameworks+=("tanstack-query") || true
  grep -q '"swr"' "$file" 2>/dev/null && frameworks+=("swr") || true
  grep -q '"pinia"' "$file" 2>/dev/null && frameworks+=("pinia") || true
  grep -q '"vuex"' "$file" 2>/dev/null && frameworks+=("vuex") || true
  grep -q '"@ngrx/store"' "$file" 2>/dev/null && frameworks+=("ngrx") || true
  grep -q '"xstate"' "$file" 2>/dev/null && frameworks+=("xstate") || true
  grep -q '"nanostores"' "$file" 2>/dev/null && frameworks+=("nanostores") || true

  # --- Databases / ORMs ---
  grep -q '"prisma"' "$file" 2>/dev/null && frameworks+=("prisma") || true
  grep -q '"drizzle-orm"' "$file" 2>/dev/null && frameworks+=("drizzle") || true
  grep -q '"mongoose"' "$file" 2>/dev/null && frameworks+=("mongoose") || true
  grep -q '"@paralect/node-mongo"' "$file" 2>/dev/null && frameworks+=("node-mongo") || true
  grep -q '"typeorm"' "$file" 2>/dev/null && frameworks+=("typeorm") || true
  grep -q '"sequelize"' "$file" 2>/dev/null && frameworks+=("sequelize") || true
  grep -q '"knex"' "$file" 2>/dev/null && frameworks+=("knex") || true
  grep -q '"@supabase/supabase-js"' "$file" 2>/dev/null && frameworks+=("supabase") || true
  grep -q '"firebase"' "$file" 2>/dev/null && frameworks+=("firebase") || true
  grep -q '"@firebase/' "$file" 2>/dev/null && frameworks+=("firebase") || true
  grep -q '"@planetscale/' "$file" 2>/dev/null && frameworks+=("planetscale") || true
  grep -q '"@neondatabase/' "$file" 2>/dev/null && frameworks+=("neon") || true
  grep -q '"@upstash/' "$file" 2>/dev/null && frameworks+=("upstash") || true
  grep -q '"ioredis"\|"redis"' "$file" 2>/dev/null && frameworks+=("redis") || true
  grep -q '"@elastic/elasticsearch"' "$file" 2>/dev/null && frameworks+=("elasticsearch") || true
  grep -q '"mongodb"' "$file" 2>/dev/null && frameworks+=("mongodb") || true
  grep -q '"pg"\|"postgres"' "$file" 2>/dev/null && frameworks+=("postgres") || true
  grep -q '"mysql2"\|"mysql"' "$file" 2>/dev/null && frameworks+=("mysql") || true
  grep -q '"better-sqlite3"\|"sql.js"' "$file" 2>/dev/null && frameworks+=("sqlite") || true
  grep -q '"@libsql/' "$file" 2>/dev/null && frameworks+=("turso") || true
  grep -q '"dynamodb"\|"@aws-sdk/client-dynamodb"' "$file" 2>/dev/null && frameworks+=("dynamodb") || true

  # --- Auth ---
  grep -q '"next-auth"\|"@auth/' "$file" 2>/dev/null && frameworks+=("nextauth") || true
  grep -q '"@clerk/' "$file" 2>/dev/null && frameworks+=("clerk") || true
  grep -q '"@lucia-auth/' "$file" 2>/dev/null && frameworks+=("lucia") || true
  grep -q '"passport"' "$file" 2>/dev/null && frameworks+=("passport") || true
  grep -q '"@supabase/auth' "$file" 2>/dev/null && frameworks+=("supabase-auth") || true
  grep -q '"@auth0/' "$file" 2>/dev/null && frameworks+=("auth0") || true
  grep -q '"jsonwebtoken"\|"jose"' "$file" 2>/dev/null && frameworks+=("jwt") || true
  grep -q '"bcrypt"\|"argon2"' "$file" 2>/dev/null && frameworks+=("password-hashing") || true
  grep -q '"better-auth"' "$file" 2>/dev/null && frameworks+=("better-auth") || true

  # --- Payments ---
  grep -q '"stripe"' "$file" 2>/dev/null && frameworks+=("stripe") || true
  grep -q '"@lemonsqueezy/' "$file" 2>/dev/null && frameworks+=("lemonsqueezy") || true
  grep -q '"@paddle/' "$file" 2>/dev/null && frameworks+=("paddle") || true

  # --- Email ---
  grep -q '"resend"' "$file" 2>/dev/null && frameworks+=("resend") || true
  grep -q '"@sendgrid/' "$file" 2>/dev/null && frameworks+=("sendgrid") || true
  grep -q '"nodemailer"' "$file" 2>/dev/null && frameworks+=("nodemailer") || true
  grep -q '"postmark"' "$file" 2>/dev/null && frameworks+=("postmark") || true
  grep -q '"@react-email/' "$file" 2>/dev/null && frameworks+=("react-email") || true

  # --- File Storage / CDN ---
  grep -q '"@aws-sdk/client-s3"' "$file" 2>/dev/null && frameworks+=("aws-s3") || true
  grep -q '"@google-cloud/storage"' "$file" 2>/dev/null && frameworks+=("gcs") || true
  grep -q '"@vercel/blob"' "$file" 2>/dev/null && frameworks+=("vercel-blob") || true
  grep -q '"cloudinary"' "$file" 2>/dev/null && frameworks+=("cloudinary") || true
  grep -q '"uploadthing"' "$file" 2>/dev/null && frameworks+=("uploadthing") || true

  # --- Testing ---
  grep -q '"jest"' "$file" 2>/dev/null && frameworks+=("jest") || true
  grep -q '"vitest"' "$file" 2>/dev/null && frameworks+=("vitest") || true
  grep -q '"playwright"' "$file" 2>/dev/null && frameworks+=("playwright") || true
  grep -q '"@playwright/test"' "$file" 2>/dev/null && frameworks+=("playwright") || true
  grep -q '"cypress"' "$file" 2>/dev/null && frameworks+=("cypress") || true
  grep -q '"@testing-library/' "$file" 2>/dev/null && frameworks+=("testing-library") || true
  grep -q '"mocha"' "$file" 2>/dev/null && frameworks+=("mocha") || true
  grep -q '"ava"' "$file" 2>/dev/null && frameworks+=("ava") || true
  grep -q '"supertest"' "$file" 2>/dev/null && frameworks+=("supertest") || true
  grep -q '"msw"' "$file" 2>/dev/null && frameworks+=("msw") || true
  grep -q '"storybook"' "$file" 2>/dev/null && frameworks+=("storybook") || true
  grep -q '"@storybook/' "$file" 2>/dev/null && frameworks+=("storybook") || true
  grep -q '"chromatic"' "$file" 2>/dev/null && frameworks+=("chromatic") || true

  # --- Linters / Formatters ---
  grep -q '"eslint"' "$file" 2>/dev/null && frameworks+=("eslint") || true
  grep -q '"prettier"' "$file" 2>/dev/null && frameworks+=("prettier") || true
  grep -q '"@biomejs/biome"' "$file" 2>/dev/null && frameworks+=("biome") || true
  grep -q '"oxlint"' "$file" 2>/dev/null && frameworks+=("oxlint") || true
  grep -q '"stylelint"' "$file" 2>/dev/null && frameworks+=("stylelint") || true

  # --- Bundlers / Build Tools ---
  grep -q '"webpack"' "$file" 2>/dev/null && frameworks+=("webpack") || true
  grep -q '"esbuild"' "$file" 2>/dev/null && frameworks+=("esbuild") || true
  grep -q '"rollup"' "$file" 2>/dev/null && frameworks+=("rollup") || true
  grep -q '"parcel"' "$file" 2>/dev/null && frameworks+=("parcel") || true
  grep -q '"tsup"' "$file" 2>/dev/null && frameworks+=("tsup") || true
  grep -q '"turbopack"' "$file" 2>/dev/null && frameworks+=("turbopack") || true
  grep -q '"@swc/' "$file" 2>/dev/null && frameworks+=("swc") || true

  # --- API / GraphQL ---
  grep -q '"graphql"' "$file" 2>/dev/null && frameworks+=("graphql") || true
  grep -q '"@apollo/' "$file" 2>/dev/null && frameworks+=("apollo") || true
  grep -q '"urql"' "$file" 2>/dev/null && frameworks+=("urql") || true
  grep -q '"type-graphql"' "$file" 2>/dev/null && frameworks+=("type-graphql") || true
  grep -q '"graphql-yoga"' "$file" 2>/dev/null && frameworks+=("graphql-yoga") || true
  grep -q '"@connectrpc/' "$file" 2>/dev/null && frameworks+=("connectrpc") || true
  grep -q '"@grpc/' "$file" 2>/dev/null && frameworks+=("grpc") || true
  grep -q '"swagger-ui'\|'"@nestjs/swagger"' "$file" 2>/dev/null && frameworks+=("swagger") || true
  grep -q '"openapi"' "$file" 2>/dev/null && frameworks+=("openapi") || true
  grep -q '"zod"' "$file" 2>/dev/null && frameworks+=("zod") || true
  grep -q '"yup"' "$file" 2>/dev/null && frameworks+=("yup") || true
  grep -q '"@sinclair/typebox"' "$file" 2>/dev/null && frameworks+=("typebox") || true
  grep -q '"valibot"' "$file" 2>/dev/null && frameworks+=("valibot") || true
  grep -q '"axios"' "$file" 2>/dev/null && frameworks+=("axios") || true
  grep -q '"ky"' "$file" 2>/dev/null && frameworks+=("ky") || true
  grep -q '"ofetch"' "$file" 2>/dev/null && frameworks+=("ofetch") || true

  # --- AI / ML / LLM ---
  grep -q '"openai"' "$file" 2>/dev/null && frameworks+=("openai") || true
  grep -q '"@anthropic-ai/' "$file" 2>/dev/null && frameworks+=("anthropic") || true
  grep -q '"langchain"\|"@langchain/' "$file" 2>/dev/null && frameworks+=("langchain") || true
  grep -q '"@langchain/langgraph"\|"langgraph"' "$file" 2>/dev/null && frameworks+=("langgraph") || true
  grep -q '"llamaindex"' "$file" 2>/dev/null && frameworks+=("llamaindex") || true
  grep -q '"ai"\|"@ai-sdk/' "$file" 2>/dev/null && frameworks+=("vercel-ai") || true
  grep -q '"@huggingface/' "$file" 2>/dev/null && frameworks+=("huggingface") || true
  grep -q '"replicate"' "$file" 2>/dev/null && frameworks+=("replicate") || true
  grep -q '"@google/generative-ai"\|"@google-ai/' "$file" 2>/dev/null && frameworks+=("google-ai") || true
  grep -q '"@mistralai/' "$file" 2>/dev/null && frameworks+=("mistral") || true
  grep -q '"cohere-ai"\|"cohere"' "$file" 2>/dev/null && frameworks+=("cohere") || true
  grep -q '"@aws-sdk/client-bedrock' "$file" 2>/dev/null && frameworks+=("bedrock") || true
  grep -q '"together-ai"\|"@together/' "$file" 2>/dev/null && frameworks+=("together") || true
  grep -q '"groq-sdk"\|"@groq/' "$file" 2>/dev/null && frameworks+=("groq") || true
  grep -q '"@perplexity-ai/' "$file" 2>/dev/null && frameworks+=("perplexity") || true
  grep -q '"fireworks-ai"\|"@fireworks/' "$file" 2>/dev/null && frameworks+=("fireworks") || true
  grep -q '"ollama' "$file" 2>/dev/null && frameworks+=("ollama") || true
  grep -q '"@mlc-ai/' "$file" 2>/dev/null && frameworks+=("mlc") || true
  grep -q '"modelfusion"' "$file" 2>/dev/null && frameworks+=("modelfusion") || true
  grep -q '"@instructor-ai/' "$file" 2>/dev/null && frameworks+=("instructor") || true
  grep -q '"mastra"\|"@mastra/' "$file" 2>/dev/null && frameworks+=("mastra") || true
  grep -q '"@copilotkit/' "$file" 2>/dev/null && frameworks+=("copilotkit") || true
  grep -q '"@mendable/' "$file" 2>/dev/null && frameworks+=("mendable") || true
  grep -q '"promptfoo"' "$file" 2>/dev/null && frameworks+=("promptfoo") || true
  grep -q '"@traceloop/' "$file" 2>/dev/null && frameworks+=("traceloop") || true
  grep -q '"@smithery/' "$file" 2>/dev/null && frameworks+=("smithery") || true
  grep -q '"@modelcontextprotocol/' "$file" 2>/dev/null && frameworks+=("mcp-sdk") || true
  grep -q '"semantic-kernel"' "$file" 2>/dev/null && frameworks+=("semantic-kernel") || true
  grep -q '"autogen"\|"@autogen/' "$file" 2>/dev/null && frameworks+=("autogen") || true

  # --- Monitoring / Observability ---
  grep -q '"@sentry/' "$file" 2>/dev/null && frameworks+=("sentry") || true
  grep -q '"@datadog/' "$file" 2>/dev/null && frameworks+=("datadog") || true
  grep -q '"@opentelemetry/' "$file" 2>/dev/null && frameworks+=("opentelemetry") || true
  grep -q '"pino"\|"winston"' "$file" 2>/dev/null && frameworks+=("logging") || true
  grep -q '"posthog' "$file" 2>/dev/null && frameworks+=("posthog") || true
  grep -q '"@amplitude/' "$file" 2>/dev/null && frameworks+=("amplitude") || true
  grep -q '"mixpanel"' "$file" 2>/dev/null && frameworks+=("mixpanel") || true

  # --- Queue / Workers ---
  grep -q '"bullmq"\|"bull"' "$file" 2>/dev/null && frameworks+=("bull") || true
  grep -q '"@temporalio/' "$file" 2>/dev/null && frameworks+=("temporal") || true
  grep -q '"@trigger.dev/' "$file" 2>/dev/null && frameworks+=("trigger-dev") || true
  grep -q '"inngest"' "$file" 2>/dev/null && frameworks+=("inngest") || true

  # --- Mobile ---
  grep -q '"react-native"' "$file" 2>/dev/null && frameworks+=("react-native") || true
  grep -q '"expo"' "$file" 2>/dev/null && frameworks+=("expo") || true
  grep -q '"@capacitor/core"' "$file" 2>/dev/null && frameworks+=("capacitor") || true
  grep -q '"@ionic/core"\|"@ionic/react"\|"@ionic/vue"' "$file" 2>/dev/null && frameworks+=("ionic") || true
  grep -q '"@nativescript/' "$file" 2>/dev/null && frameworks+=("nativescript") || true
  grep -q '"tauri"' "$file" 2>/dev/null && frameworks+=("tauri") || true
  grep -q '"electron"' "$file" 2>/dev/null && frameworks+=("electron") || true

  # --- Blockchain / Web3 ---
  grep -q '"ethers"' "$file" 2>/dev/null && frameworks+=("ethers") || true
  grep -q '"viem"' "$file" 2>/dev/null && frameworks+=("viem") || true
  grep -q '"wagmi"' "$file" 2>/dev/null && frameworks+=("wagmi") || true
  grep -q '"web3"' "$file" 2>/dev/null && frameworks+=("web3js") || true
  grep -q '"hardhat"' "$file" 2>/dev/null && frameworks+=("hardhat") || true
  grep -q '"foundry"' "$file" 2>/dev/null && frameworks+=("foundry") || true

  # --- i18n ---
  grep -q '"next-intl"' "$file" 2>/dev/null && frameworks+=("next-intl") || true
  grep -q '"i18next"\|"react-i18next"' "$file" 2>/dev/null && frameworks+=("i18next") || true
  grep -q '"@formatjs/' "$file" 2>/dev/null && frameworks+=("formatjs") || true

  # --- Forms ---
  grep -q '"react-hook-form"' "$file" 2>/dev/null && frameworks+=("react-hook-form") || true
  grep -q '"formik"' "$file" 2>/dev/null && frameworks+=("formik") || true
  grep -q '"@conform-to/' "$file" 2>/dev/null && frameworks+=("conform") || true
  grep -q '"@tanstack/react-form"' "$file" 2>/dev/null && frameworks+=("tanstack-form") || true

  # --- Realtime ---
  grep -q '"pusher"' "$file" 2>/dev/null && frameworks+=("pusher") || true
  grep -q '"@ably/' "$file" 2>/dev/null && frameworks+=("ably") || true
  grep -q '"@liveblocks/' "$file" 2>/dev/null && frameworks+=("liveblocks") || true
  grep -q '"partykit"\|"partysocket"' "$file" 2>/dev/null && frameworks+=("partykit") || true
  grep -q '"@supabase/realtime' "$file" 2>/dev/null && frameworks+=("supabase-realtime") || true

  # --- Search ---
  grep -q '"meilisearch"' "$file" 2>/dev/null && frameworks+=("meilisearch") || true
  grep -q '"typesense"' "$file" 2>/dev/null && frameworks+=("typesense") || true
  grep -q '"algoliasearch"' "$file" 2>/dev/null && frameworks+=("algolia") || true
  grep -q '"fuse.js"' "$file" 2>/dev/null && frameworks+=("fusejs") || true
  grep -q '"minisearch"' "$file" 2>/dev/null && frameworks+=("minisearch") || true

  # --- Feature Flags ---
  grep -q '"launchdarkly' "$file" 2>/dev/null && frameworks+=("launchdarkly") || true
  grep -q '"@growthbook/' "$file" 2>/dev/null && frameworks+=("growthbook") || true
  grep -q '"@unleash/' "$file" 2>/dev/null && frameworks+=("unleash") || true
  grep -q '"flagsmith"' "$file" 2>/dev/null && frameworks+=("flagsmith") || true
  grep -q '"@vercel/flags"' "$file" 2>/dev/null && frameworks+=("vercel-flags") || true
  grep -q '"@happykit/' "$file" 2>/dev/null && frameworks+=("happykit") || true

  # --- Charts / Visualization ---
  grep -q '"d3"' "$file" 2>/dev/null && frameworks+=("d3") || true
  grep -q '"chart.js"' "$file" 2>/dev/null && frameworks+=("chartjs") || true
  grep -q '"recharts"' "$file" 2>/dev/null && frameworks+=("recharts") || true
  grep -q '"@visx/' "$file" 2>/dev/null && frameworks+=("visx") || true
  grep -q '"echarts"' "$file" 2>/dev/null && frameworks+=("echarts") || true
  grep -q '"@nivo/' "$file" 2>/dev/null && frameworks+=("nivo") || true
  grep -q '"plotly"' "$file" 2>/dev/null && frameworks+=("plotly") || true
  grep -q '"victory"' "$file" 2>/dev/null && frameworks+=("victory") || true
  grep -q '"@tremor/' "$file" 2>/dev/null && frameworks+=("tremor") || true

  # --- 3D / Animation ---
  grep -q '"three"' "$file" 2>/dev/null && frameworks+=("threejs") || true
  grep -q '"@react-three/fiber"' "$file" 2>/dev/null && frameworks+=("r3f") || true
  grep -q '"gsap"' "$file" 2>/dev/null && frameworks+=("gsap") || true
  grep -q '"lottie' "$file" 2>/dev/null && frameworks+=("lottie") || true
  grep -q '"@splinetool/' "$file" 2>/dev/null && frameworks+=("spline") || true
  grep -q '"motion"' "$file" 2>/dev/null && frameworks+=("motion") || true
  grep -q '"@react-spring/' "$file" 2>/dev/null && frameworks+=("react-spring") || true
  grep -q '"pixi.js"\|"@pixi/' "$file" 2>/dev/null && frameworks+=("pixijs") || true

  # --- Documentation ---
  grep -q '"@docusaurus/' "$file" 2>/dev/null && frameworks+=("docusaurus") || true
  grep -q '"vitepress"' "$file" 2>/dev/null && frameworks+=("vitepress") || true
  grep -q '"nextra"' "$file" 2>/dev/null && frameworks+=("nextra") || true
  grep -q '"@mintlify/' "$file" 2>/dev/null && frameworks+=("mintlify") || true
  grep -q '"starlight"\|"@astrojs/starlight"' "$file" 2>/dev/null && frameworks+=("starlight") || true
  grep -q '"fumadocs' "$file" 2>/dev/null && frameworks+=("fumadocs") || true
  grep -q '"typedoc"' "$file" 2>/dev/null && frameworks+=("typedoc") || true

  # --- CLI Tools ---
  grep -q '"commander"' "$file" 2>/dev/null && frameworks+=("commander") || true
  grep -q '"ink"' "$file" 2>/dev/null && frameworks+=("ink") || true
  grep -q '"@oclif/' "$file" 2>/dev/null && frameworks+=("oclif") || true
  grep -q '"yargs"' "$file" 2>/dev/null && frameworks+=("yargs") || true
  grep -q '"citty"\|"consola"' "$file" 2>/dev/null && frameworks+=("unjs-cli") || true
  grep -q '"prompts"\|"inquirer"\|"@clack/' "$file" 2>/dev/null && frameworks+=("cli-prompts") || true

  # --- Date / Time ---
  grep -q '"date-fns"' "$file" 2>/dev/null && frameworks+=("date-fns") || true
  grep -q '"dayjs"' "$file" 2>/dev/null && frameworks+=("dayjs") || true
  grep -q '"luxon"' "$file" 2>/dev/null && frameworks+=("luxon") || true
  grep -q '"@js-temporal/' "$file" 2>/dev/null && frameworks+=("temporal-api") || true

  # --- Image / Media ---
  grep -q '"sharp"' "$file" 2>/dev/null && frameworks+=("sharp") || true
  grep -q '"puppeteer"' "$file" 2>/dev/null && frameworks+=("puppeteer") || true
  grep -q '"@ffmpeg' "$file" 2>/dev/null && frameworks+=("ffmpeg") || true
  grep -q '"jimp"' "$file" 2>/dev/null && frameworks+=("jimp") || true

  # --- PDF ---
  grep -q '"jspdf"\|"@react-pdf/' "$file" 2>/dev/null && frameworks+=("pdf") || true

  # --- Caching ---
  grep -q '"lru-cache"' "$file" 2>/dev/null && frameworks+=("lru-cache") || true
  grep -q '"keyv"' "$file" 2>/dev/null && frameworks+=("keyv") || true
  grep -q '"cacheable"' "$file" 2>/dev/null && frameworks+=("cacheable") || true

  # --- Scheduling ---
  grep -q '"node-cron"\|"cron"' "$file" 2>/dev/null && frameworks+=("node-cron") || true
  grep -q '"agenda"' "$file" 2>/dev/null && frameworks+=("agenda") || true
  grep -q '"bree"' "$file" 2>/dev/null && frameworks+=("bree") || true

  # --- Message Brokers (Node) ---
  grep -q '"amqplib"\|"@golevelup/nestjs-rabbitmq"' "$file" 2>/dev/null && frameworks+=("rabbitmq") || true
  grep -q '"kafkajs"\|"@nestjs/microservices"' "$file" 2>/dev/null && frameworks+=("kafka") || true
  grep -q '"nats"' "$file" 2>/dev/null && frameworks+=("nats") || true
  grep -q '"mqtt"' "$file" 2>/dev/null && frameworks+=("mqtt") || true

  # --- Vector DBs (Node) ---
  grep -q '"@pinecone-database/' "$file" 2>/dev/null && frameworks+=("pinecone") || true
  grep -q '"chromadb"' "$file" 2>/dev/null && frameworks+=("chromadb") || true
  grep -q '"@qdrant/' "$file" 2>/dev/null && frameworks+=("qdrant") || true
  grep -q '"weaviate-ts-client"\|"weaviate-client"' "$file" 2>/dev/null && frameworks+=("weaviate") || true

  # --- Desktop ---
  grep -q '"neutralinojs"' "$file" 2>/dev/null && frameworks+=("neutralino") || true
  grep -q '"@aspect-build/rules_esbuild"\|"wails"' "$file" 2>/dev/null && frameworks+=("wails") || true

  # --- Deployment ---
  grep -q '"@sst/' "$file" 2>/dev/null && frameworks+=("sst") || true
  grep -q '"wrangler"\|"@cloudflare/workers-types"' "$file" 2>/dev/null && frameworks+=("cloudflare-workers") || true
  grep -q '"@deno/' "$file" 2>/dev/null && frameworks+=("deno") || true

  # --- Security ---
  grep -q '"helmet"' "$file" 2>/dev/null && frameworks+=("helmet") || true
  grep -q '"cors"' "$file" 2>/dev/null && frameworks+=("cors") || true
  grep -q '"csurf"\|"csrf"' "$file" 2>/dev/null && frameworks+=("csrf") || true
  grep -q '"rate-limiter' "$file" 2>/dev/null && frameworks+=("rate-limiter") || true

  # --- CMS Headless ---
  grep -q '"@prismic/' "$file" 2>/dev/null && frameworks+=("prismic") || true
  grep -q '"@storyblok/' "$file" 2>/dev/null && frameworks+=("storyblok") || true
  grep -q '"@hygraph/' "$file" 2>/dev/null && frameworks+=("hygraph") || true
  grep -q '"@keystatic/' "$file" 2>/dev/null && frameworks+=("keystatic") || true
  grep -q '"@tina/' "$file" 2>/dev/null && frameworks+=("tinacms") || true

  # --- Notifications ---
  grep -q '"@novu/' "$file" 2>/dev/null && frameworks+=("novu") || true
  grep -q '"web-push"\|"@pushover/' "$file" 2>/dev/null && frameworks+=("push-notifications") || true
  grep -q '"twilio"' "$file" 2>/dev/null && frameworks+=("twilio") || true

  # --- Tables / Data Grid ---
  grep -q '"@tanstack/react-table"' "$file" 2>/dev/null && frameworks+=("tanstack-table") || true
  grep -q '"@ag-grid' "$file" 2>/dev/null && frameworks+=("ag-grid") || true

  # --- Maps ---
  grep -q '"mapbox-gl"\|"@mapbox/' "$file" 2>/dev/null && frameworks+=("mapbox") || true
  grep -q '"leaflet"\|"react-leaflet"' "$file" 2>/dev/null && frameworks+=("leaflet") || true
  grep -q '"@react-google-maps/' "$file" 2>/dev/null && frameworks+=("google-maps") || true

  # --- Rich Text / Editors ---
  grep -q '"@tiptap/' "$file" 2>/dev/null && frameworks+=("tiptap") || true
  grep -q '"slate"' "$file" 2>/dev/null && frameworks+=("slate") || true
  grep -q '"@lexical/' "$file" 2>/dev/null && frameworks+=("lexical") || true
  grep -q '"prosemirror' "$file" 2>/dev/null && frameworks+=("prosemirror") || true
  grep -q '"@uiw/react-md-editor"\|"@mdxeditor/' "$file" 2>/dev/null && frameworks+=("md-editor") || true
  grep -q '"monaco-editor"\|"@monaco-editor/' "$file" 2>/dev/null && frameworks+=("monaco") || true
  grep -q '"codemirror"\|"@codemirror/' "$file" 2>/dev/null && frameworks+=("codemirror") || true

  # --- Drag & Drop ---
  grep -q '"@dnd-kit/' "$file" 2>/dev/null && frameworks+=("dnd-kit") || true
  grep -q '"react-beautiful-dnd"\|"@hello-pangea/dnd"' "$file" 2>/dev/null && frameworks+=("react-dnd") || true

  # --- Virtual Lists ---
  grep -q '"@tanstack/react-virtual"' "$file" 2>/dev/null && frameworks+=("tanstack-virtual") || true
  grep -q '"react-virtuoso"' "$file" 2>/dev/null && frameworks+=("virtuoso") || true

  # --- Type-safe env ---
  grep -q '"@t3-oss/env' "$file" 2>/dev/null && frameworks+=("t3-env") || true
  grep -q '"envalid"' "$file" 2>/dev/null && frameworks+=("envalid") || true

  # --- Monorepo tools (if in deps) ---
  grep -q '"changesets"\|"@changesets/' "$file" 2>/dev/null && frameworks+=("changesets") || true
  grep -q '"syncpack"' "$file" 2>/dev/null && frameworks+=("syncpack") || true
}

# Check root and workspace package.jsons
detect_from_deps "package.json"
for f in apps/*/package.json packages/*/package.json */package.json */*/package.json; do
  detect_from_deps "$f"
done

# --- Python frameworks ---
if [ "$py_count" -gt 0 ]; then
  for req in requirements.txt requirements-dev.txt requirements/*.txt pyproject.toml setup.py setup.cfg; do
    if [ -f "$req" ]; then
      grep -qi "django" "$req" 2>/dev/null && frameworks+=("django") || true
      grep -qi "flask" "$req" 2>/dev/null && frameworks+=("flask") || true
      grep -qi "fastapi" "$req" 2>/dev/null && frameworks+=("fastapi") || true
      grep -qi "starlette" "$req" 2>/dev/null && frameworks+=("starlette") || true
      grep -qi "celery" "$req" 2>/dev/null && frameworks+=("celery") || true
      grep -qi "sqlalchemy" "$req" 2>/dev/null && frameworks+=("sqlalchemy") || true
      grep -qi "tortoise-orm" "$req" 2>/dev/null && frameworks+=("tortoise") || true
      grep -qi "pydantic" "$req" 2>/dev/null && frameworks+=("pydantic") || true
      grep -qi "alembic" "$req" 2>/dev/null && frameworks+=("alembic") || true
      grep -qi "pytest" "$req" 2>/dev/null && frameworks+=("pytest") || true
      grep -qi "ruff" "$req" 2>/dev/null && frameworks+=("ruff") || true
      grep -qi "black" "$req" 2>/dev/null && frameworks+=("black") || true
      grep -qi "mypy" "$req" 2>/dev/null && frameworks+=("mypy") || true
      grep -qi "uvicorn" "$req" 2>/dev/null && frameworks+=("uvicorn") || true
      grep -qi "gunicorn" "$req" 2>/dev/null && frameworks+=("gunicorn") || true
      grep -qi "scrapy" "$req" 2>/dev/null && frameworks+=("scrapy") || true
      grep -qi "beautifulsoup" "$req" 2>/dev/null && frameworks+=("beautifulsoup") || true
      grep -qi "pandas" "$req" 2>/dev/null && frameworks+=("pandas") || true
      grep -qi "numpy" "$req" 2>/dev/null && frameworks+=("numpy") || true
      grep -qi "scikit-learn" "$req" 2>/dev/null && frameworks+=("scikit-learn") || true
      grep -qi "tensorflow" "$req" 2>/dev/null && frameworks+=("tensorflow") || true
      grep -qi "torch\|pytorch" "$req" 2>/dev/null && frameworks+=("pytorch") || true
      grep -qi "transformers" "$req" 2>/dev/null && frameworks+=("huggingface") || true
      grep -qi "langchain" "$req" 2>/dev/null && frameworks+=("langchain") || true
      grep -qi "langgraph" "$req" 2>/dev/null && frameworks+=("langgraph") || true
      grep -qi "openai" "$req" 2>/dev/null && frameworks+=("openai") || true
      grep -qi "anthropic" "$req" 2>/dev/null && frameworks+=("anthropic") || true
      grep -qi "sentry" "$req" 2>/dev/null && frameworks+=("sentry") || true
      grep -qi "dramatiq\|huey\|rq" "$req" 2>/dev/null && frameworks+=("python-worker") || true
      grep -qi "strawberry\|ariadne\|graphene" "$req" 2>/dev/null && frameworks+=("graphql") || true
      grep -qi "httpx\|aiohttp\|requests" "$req" 2>/dev/null && frameworks+=("python-http") || true
      grep -qi "redis" "$req" 2>/dev/null && frameworks+=("redis") || true
      grep -qi "psycopg\|asyncpg" "$req" 2>/dev/null && frameworks+=("postgres") || true
      grep -qi "motor\|pymongo" "$req" 2>/dev/null && frameworks+=("mongodb") || true
      grep -qi "boto3\|botocore" "$req" 2>/dev/null && frameworks+=("aws-sdk") || true
      # Python extras
      grep -qi "litestar" "$req" 2>/dev/null && frameworks+=("litestar") || true
      grep -qi "sanic" "$req" 2>/dev/null && frameworks+=("sanic") || true
      grep -qi "falcon" "$req" 2>/dev/null && frameworks+=("falcon") || true
      grep -qi "robyn" "$req" 2>/dev/null && frameworks+=("robyn") || true
      grep -qi "polars" "$req" 2>/dev/null && frameworks+=("polars") || true
      grep -qi "dask" "$req" 2>/dev/null && frameworks+=("dask") || true
      grep -qi "pyspark\|spark" "$req" 2>/dev/null && frameworks+=("spark") || true
      grep -qi "ray" "$req" 2>/dev/null && frameworks+=("ray") || true
      grep -qi "streamlit" "$req" 2>/dev/null && frameworks+=("streamlit") || true
      grep -qi "gradio" "$req" 2>/dev/null && frameworks+=("gradio") || true
      grep -qi "dash" "$req" 2>/dev/null && frameworks+=("plotly-dash") || true
      grep -qi "panel\|holoviews" "$req" 2>/dev/null && frameworks+=("panel") || true
      grep -qi "matplotlib" "$req" 2>/dev/null && frameworks+=("matplotlib") || true
      grep -qi "seaborn" "$req" 2>/dev/null && frameworks+=("seaborn") || true
      grep -qi "plotly" "$req" 2>/dev/null && frameworks+=("plotly") || true
      grep -qi "click" "$req" 2>/dev/null && frameworks+=("click") || true
      grep -qi "typer" "$req" 2>/dev/null && frameworks+=("typer") || true
      grep -qi "rich" "$req" 2>/dev/null && frameworks+=("rich") || true
      grep -qi "textual" "$req" 2>/dev/null && frameworks+=("textual") || true
      grep -qi "opencv\|cv2" "$req" 2>/dev/null && frameworks+=("opencv") || true
      grep -qi "pillow\|PIL" "$req" 2>/dev/null && frameworks+=("pillow") || true
      grep -qi "jax" "$req" 2>/dev/null && frameworks+=("jax") || true
      grep -qi "keras" "$req" 2>/dev/null && frameworks+=("keras") || true
      grep -qi "onnx" "$req" 2>/dev/null && frameworks+=("onnx") || true
      grep -qi "mlflow" "$req" 2>/dev/null && frameworks+=("mlflow") || true
      grep -qi "wandb" "$req" 2>/dev/null && frameworks+=("wandb") || true
      grep -qi "prefect" "$req" 2>/dev/null && frameworks+=("prefect") || true
      grep -qi "dagster" "$req" 2>/dev/null && frameworks+=("dagster") || true
      grep -qi "airflow" "$req" 2>/dev/null && frameworks+=("airflow") || true
      grep -qi "dbt" "$req" 2>/dev/null && frameworks+=("dbt") || true
      grep -qi "pinecone" "$req" 2>/dev/null && frameworks+=("pinecone") || true
      grep -qi "chromadb\|chroma" "$req" 2>/dev/null && frameworks+=("chromadb") || true
      grep -qi "qdrant" "$req" 2>/dev/null && frameworks+=("qdrant") || true
      grep -qi "weaviate" "$req" 2>/dev/null && frameworks+=("weaviate") || true
      grep -qi "milvus\|pymilvus" "$req" 2>/dev/null && frameworks+=("milvus") || true
      grep -qi "faiss" "$req" 2>/dev/null && frameworks+=("faiss") || true
      grep -qi "crewai" "$req" 2>/dev/null && frameworks+=("crewai") || true
      grep -qi "autogen\|pyautogen" "$req" 2>/dev/null && frameworks+=("autogen") || true
      grep -qi "llama.index\|llama-index\|llamaindex" "$req" 2>/dev/null && frameworks+=("llamaindex") || true
      grep -qi "google.generativeai\|google-generativeai" "$req" 2>/dev/null && frameworks+=("google-ai") || true
      grep -qi "mistralai" "$req" 2>/dev/null && frameworks+=("mistral") || true
      grep -qi "cohere" "$req" 2>/dev/null && frameworks+=("cohere") || true
      grep -qi "groq" "$req" 2>/dev/null && frameworks+=("groq") || true
      grep -qi "together" "$req" 2>/dev/null && frameworks+=("together") || true
      grep -qi "fireworks" "$req" 2>/dev/null && frameworks+=("fireworks") || true
      grep -qi "ollama" "$req" 2>/dev/null && frameworks+=("ollama") || true
      grep -qi "vllm" "$req" 2>/dev/null && frameworks+=("vllm") || true
      grep -qi "instructor" "$req" 2>/dev/null && frameworks+=("instructor") || true
      grep -qi "guidance" "$req" 2>/dev/null && frameworks+=("guidance") || true
      grep -qi "dspy" "$req" 2>/dev/null && frameworks+=("dspy") || true
      grep -qi "semantic.kernel\|semantic-kernel" "$req" 2>/dev/null && frameworks+=("semantic-kernel") || true
      grep -qi "promptflow\|promptfoo" "$req" 2>/dev/null && frameworks+=("promptfoo") || true
      grep -qi "haystack" "$req" 2>/dev/null && frameworks+=("haystack") || true
      grep -qi "litellm" "$req" 2>/dev/null && frameworks+=("litellm") || true
      grep -qi "magentic" "$req" 2>/dev/null && frameworks+=("magentic") || true
      grep -qi "marvin" "$req" 2>/dev/null && frameworks+=("marvin") || true
      grep -qi "outlines" "$req" 2>/dev/null && frameworks+=("outlines") || true
      grep -qi "lmql" "$req" 2>/dev/null && frameworks+=("lmql") || true
      grep -qi "txtai" "$req" 2>/dev/null && frameworks+=("txtai") || true
      grep -qi "embedchain\|mem0" "$req" 2>/dev/null && frameworks+=("mem0") || true
      grep -qi "unstructured" "$req" 2>/dev/null && frameworks+=("unstructured") || true
      grep -qi "docling" "$req" 2>/dev/null && frameworks+=("docling") || true
      grep -qi "pydantic-ai\|pydantic_ai" "$req" 2>/dev/null && frameworks+=("pydantic-ai") || true
      grep -qi "smolagents\|agents" "$req" 2>/dev/null && frameworks+=("smolagents") || true
      grep -qi "agno\|phidata" "$req" 2>/dev/null && frameworks+=("agno") || true
      grep -qi "pika\|kombu" "$req" 2>/dev/null && frameworks+=("rabbitmq") || true
      grep -qi "confluent.kafka\|aiokafka" "$req" 2>/dev/null && frameworks+=("kafka") || true
      grep -qi "nats" "$req" 2>/dev/null && frameworks+=("nats") || true
      grep -qi "grpc\|grpcio" "$req" 2>/dev/null && frameworks+=("grpc") || true
      grep -qi "elasticsearch" "$req" 2>/dev/null && frameworks+=("elasticsearch") || true
      grep -qi "meilisearch" "$req" 2>/dev/null && frameworks+=("meilisearch") || true
      grep -qi "stripe" "$req" 2>/dev/null && frameworks+=("stripe") || true
      grep -qi "twilio" "$req" 2>/dev/null && frameworks+=("twilio") || true
      grep -qi "sendgrid" "$req" 2>/dev/null && frameworks+=("sendgrid") || true
      grep -qi "docker" "$req" 2>/dev/null && frameworks+=("docker-py") || true
      grep -qi "kubernetes" "$req" 2>/dev/null && frameworks+=("k8s-py") || true
      grep -qi "terraform" "$req" 2>/dev/null && frameworks+=("terraform-py") || true
      grep -qi "paramiko\|fabric" "$req" 2>/dev/null && frameworks+=("ssh") || true
      grep -qi "spacy" "$req" 2>/dev/null && frameworks+=("spacy") || true
      grep -qi "nltk" "$req" 2>/dev/null && frameworks+=("nltk") || true
      grep -qi "sympy" "$req" 2>/dev/null && frameworks+=("sympy") || true
      grep -qi "scipy" "$req" 2>/dev/null && frameworks+=("scipy") || true
      grep -qi "networkx" "$req" 2>/dev/null && frameworks+=("networkx") || true
    fi
  done
  # Check for subdirectory python projects
  for req in */requirements.txt */pyproject.toml; do
    if [ -f "$req" ]; then
      grep -qi "django" "$req" 2>/dev/null && frameworks+=("django") || true
      grep -qi "flask" "$req" 2>/dev/null && frameworks+=("flask") || true
      grep -qi "fastapi" "$req" 2>/dev/null && frameworks+=("fastapi") || true
    fi
  done
fi

# --- PHP frameworks ---
if [ "$php_count" -gt 0 ]; then
  for cj in composer.json */composer.json; do
    if [ -f "$cj" ]; then
      grep -q '"laravel/framework"' "$cj" 2>/dev/null && frameworks+=("laravel") || true
      grep -q '"symfony/' "$cj" 2>/dev/null && frameworks+=("symfony") || true
      grep -q '"cakephp/' "$cj" 2>/dev/null && frameworks+=("cakephp") || true
      grep -q '"slim/slim"' "$cj" 2>/dev/null && frameworks+=("slim") || true
      grep -q '"yiisoft/' "$cj" 2>/dev/null && frameworks+=("yii") || true
      grep -q '"codeigniter' "$cj" 2>/dev/null && frameworks+=("codeigniter") || true
      grep -q '"livewire/' "$cj" 2>/dev/null && frameworks+=("livewire") || true
      grep -q '"filament/' "$cj" 2>/dev/null && frameworks+=("filament") || true
      grep -q '"inertiajs/' "$cj" 2>/dev/null && frameworks+=("inertia") || true
      grep -q '"phpunit/' "$cj" 2>/dev/null && frameworks+=("phpunit") || true
      grep -q '"pestphp/' "$cj" 2>/dev/null && frameworks+=("pest") || true
      grep -q '"phpstan/' "$cj" 2>/dev/null && frameworks+=("phpstan") || true
      grep -q '"larastan/' "$cj" 2>/dev/null && frameworks+=("larastan") || true
      grep -q '"spatie/' "$cj" 2>/dev/null && frameworks+=("spatie") || true
      grep -q '"barryvdh/laravel-debugbar"' "$cj" 2>/dev/null && frameworks+=("debugbar") || true
      grep -q '"laravel/sanctum"' "$cj" 2>/dev/null && frameworks+=("sanctum") || true
      grep -q '"laravel/passport"' "$cj" 2>/dev/null && frameworks+=("passport") || true
      grep -q '"laravel/horizon"' "$cj" 2>/dev/null && frameworks+=("horizon") || true
      grep -q '"laravel/scout"' "$cj" 2>/dev/null && frameworks+=("laravel-scout") || true
      grep -q '"laravel/cashier"' "$cj" 2>/dev/null && frameworks+=("laravel-cashier") || true
      grep -q '"laravel/socialite"' "$cj" 2>/dev/null && frameworks+=("socialite") || true
      grep -q '"predis/predis"\|"phpredis"' "$cj" 2>/dev/null && frameworks+=("redis") || true
      grep -q '"doctrine/' "$cj" 2>/dev/null && frameworks+=("doctrine") || true
      grep -q '"nuwave/lighthouse"' "$cj" 2>/dev/null && frameworks+=("graphql") || true
      grep -q '"laravel/octane"' "$cj" 2>/dev/null && frameworks+=("octane") || true
      grep -q '"rector/' "$cj" 2>/dev/null && frameworks+=("rector") || true
      grep -q '"laravel/dusk"' "$cj" 2>/dev/null && frameworks+=("dusk") || true
      grep -q '"twilio/' "$cj" 2>/dev/null && frameworks+=("twilio") || true
      grep -q '"stripe/' "$cj" 2>/dev/null && frameworks+=("stripe") || true
      grep -q '"aws/' "$cj" 2>/dev/null && frameworks+=("aws-sdk") || true
    fi
  done
fi

# --- Ruby frameworks ---
if [ "$rb_count" -gt 0 ]; then
  for gf in Gemfile */Gemfile; do
    if [ -f "$gf" ]; then
      grep -qi "rails" "$gf" 2>/dev/null && frameworks+=("rails") || true
      grep -qi "sinatra" "$gf" 2>/dev/null && frameworks+=("sinatra") || true
      grep -qi "hanami" "$gf" 2>/dev/null && frameworks+=("hanami") || true
      grep -qi "rspec" "$gf" 2>/dev/null && frameworks+=("rspec") || true
      grep -qi "minitest" "$gf" 2>/dev/null && frameworks+=("minitest") || true
      grep -qi "sidekiq" "$gf" 2>/dev/null && frameworks+=("sidekiq") || true
      grep -qi "rubocop" "$gf" 2>/dev/null && frameworks+=("rubocop") || true
      grep -qi "stimulus\|turbo\|hotwire" "$gf" 2>/dev/null && frameworks+=("hotwire") || true
      grep -qi "devise" "$gf" 2>/dev/null && frameworks+=("devise") || true
      grep -qi "pundit\|cancancan" "$gf" 2>/dev/null && frameworks+=("ruby-auth") || true
      grep -qi "active_admin\|administrate" "$gf" 2>/dev/null && frameworks+=("ruby-admin") || true
      grep -qi "stripe" "$gf" 2>/dev/null && frameworks+=("stripe") || true
      grep -qi "redis\|connection_pool" "$gf" 2>/dev/null && frameworks+=("redis") || true
      grep -qi "capybara\|selenium" "$gf" 2>/dev/null && frameworks+=("capybara") || true
      grep -qi "factory_bot\|faker" "$gf" 2>/dev/null && frameworks+=("ruby-fixtures") || true
      grep -qi "grape\|jsonapi" "$gf" 2>/dev/null && frameworks+=("ruby-api") || true
      grep -qi "graphql-ruby" "$gf" 2>/dev/null && frameworks+=("graphql") || true
      grep -qi "good_job\|delayed_job\|resque" "$gf" 2>/dev/null && frameworks+=("ruby-worker") || true
      grep -qi "kamal\|capistrano" "$gf" 2>/dev/null && frameworks+=("ruby-deploy") || true
      grep -qi "sorbet\|tapioca" "$gf" 2>/dev/null && frameworks+=("sorbet") || true
      grep -qi "dry-" "$gf" 2>/dev/null && frameworks+=("dry-rb") || true
      grep -qi "view_component" "$gf" 2>/dev/null && frameworks+=("view-component") || true
      grep -qi "tailwindcss-rails" "$gf" 2>/dev/null && frameworks+=("tailwind") || true
    fi
  done
fi

# --- Go frameworks ---
if [ "$go_count" -gt 0 ]; then
  for gomod in go.mod */go.mod; do
    if [ -f "$gomod" ]; then
      grep -q "gin-gonic" "$gomod" 2>/dev/null && frameworks+=("gin") || true
      grep -q "go-chi" "$gomod" 2>/dev/null && frameworks+=("chi") || true
      grep -q "gofiber" "$gomod" 2>/dev/null && frameworks+=("fiber") || true
      grep -q "labstack/echo" "$gomod" 2>/dev/null && frameworks+=("echo") || true
      grep -q "gorilla/mux" "$gomod" 2>/dev/null && frameworks+=("gorilla") || true
      grep -q "go-kit" "$gomod" 2>/dev/null && frameworks+=("go-kit") || true
      grep -q "grpc" "$gomod" 2>/dev/null && frameworks+=("grpc") || true
      grep -q "gorm.io" "$gomod" 2>/dev/null && frameworks+=("gorm") || true
      grep -q "ent/" "$gomod" 2>/dev/null && frameworks+=("ent") || true
      grep -q "sqlx" "$gomod" 2>/dev/null && frameworks+=("sqlx") || true
      grep -q "sqlc" "$gomod" 2>/dev/null && frameworks+=("sqlc") || true
      grep -q "testify" "$gomod" 2>/dev/null && frameworks+=("testify") || true
      grep -q "cobra" "$gomod" 2>/dev/null && frameworks+=("cobra") || true
      grep -q "viper" "$gomod" 2>/dev/null && frameworks+=("viper") || true
      grep -q "zap\|zerolog\|logrus" "$gomod" 2>/dev/null && frameworks+=("go-logging") || true
      grep -q "redis" "$gomod" 2>/dev/null && frameworks+=("redis") || true
      grep -q "pgx\|pq" "$gomod" 2>/dev/null && frameworks+=("postgres") || true
      grep -q "mongo-driver" "$gomod" 2>/dev/null && frameworks+=("mongodb") || true
      grep -q "templ" "$gomod" 2>/dev/null && frameworks+=("templ") || true
      grep -q "htmx" "$gomod" 2>/dev/null && frameworks+=("htmx") || true
      grep -q "buf.build\|connectrpc" "$gomod" 2>/dev/null && frameworks+=("connectrpc") || true
      grep -q "nats" "$gomod" 2>/dev/null && frameworks+=("nats") || true
      grep -q "rabbitmq\|amqp" "$gomod" 2>/dev/null && frameworks+=("rabbitmq") || true
      grep -q "confluent\|kafka" "$gomod" 2>/dev/null && frameworks+=("kafka") || true
      grep -q "otel\|opentelemetry" "$gomod" 2>/dev/null && frameworks+=("opentelemetry") || true
      grep -q "sentry" "$gomod" 2>/dev/null && frameworks+=("sentry") || true
      grep -q "stripe" "$gomod" 2>/dev/null && frameworks+=("stripe") || true
      grep -q "aws-sdk-go" "$gomod" 2>/dev/null && frameworks+=("aws-sdk") || true
      grep -q "google.golang.org/api\|cloud.google.com" "$gomod" 2>/dev/null && frameworks+=("gcp-sdk") || true
      grep -q "meilisearch" "$gomod" 2>/dev/null && frameworks+=("meilisearch") || true
      grep -q "elastic" "$gomod" 2>/dev/null && frameworks+=("elasticsearch") || true
      grep -q "chromem\|qdrant\|pinecone\|weaviate" "$gomod" 2>/dev/null && frameworks+=("go-vectordb") || true
      grep -q "fx\|wire" "$gomod" 2>/dev/null && frameworks+=("go-di") || true
      grep -q "watermill" "$gomod" 2>/dev/null && frameworks+=("watermill") || true
      grep -q "golangci-lint" "$gomod" 2>/dev/null && frameworks+=("golangci-lint") || true
      grep -q "gomock\|mockery" "$gomod" 2>/dev/null && frameworks+=("go-mock") || true
      grep -q "swag" "$gomod" 2>/dev/null && frameworks+=("swagger") || true
      grep -q "air" "$gomod" 2>/dev/null && frameworks+=("air") || true
    fi
  done
fi

# --- Rust frameworks ---
if [ "$rs_count" -gt 0 ]; then
  for cargo in Cargo.toml */Cargo.toml; do
    if [ -f "$cargo" ]; then
      grep -q "actix-web" "$cargo" 2>/dev/null && frameworks+=("actix") || true
      grep -q "axum" "$cargo" 2>/dev/null && frameworks+=("axum") || true
      grep -q "rocket" "$cargo" 2>/dev/null && frameworks+=("rocket") || true
      grep -q "warp" "$cargo" 2>/dev/null && frameworks+=("warp") || true
      grep -q "tokio" "$cargo" 2>/dev/null && frameworks+=("tokio") || true
      grep -q "diesel" "$cargo" 2>/dev/null && frameworks+=("diesel") || true
      grep -q "sea-orm\|seaorm" "$cargo" 2>/dev/null && frameworks+=("sea-orm") || true
      grep -q "sqlx" "$cargo" 2>/dev/null && frameworks+=("sqlx") || true
      grep -q "serde" "$cargo" 2>/dev/null && frameworks+=("serde") || true
      grep -q "leptos" "$cargo" 2>/dev/null && frameworks+=("leptos") || true
      grep -q "yew" "$cargo" 2>/dev/null && frameworks+=("yew") || true
      grep -q "dioxus" "$cargo" 2>/dev/null && frameworks+=("dioxus") || true
      grep -q "tauri" "$cargo" 2>/dev/null && frameworks+=("tauri") || true
      grep -q "wasm-bindgen" "$cargo" 2>/dev/null && frameworks+=("wasm") || true
      grep -q "clap" "$cargo" 2>/dev/null && frameworks+=("clap") || true
      grep -q "tracing" "$cargo" 2>/dev/null && frameworks+=("tracing") || true
      grep -q "tonic" "$cargo" 2>/dev/null && frameworks+=("tonic-grpc") || true
      grep -q "poem" "$cargo" 2>/dev/null && frameworks+=("poem") || true
      grep -q "tide" "$cargo" 2>/dev/null && frameworks+=("tide") || true
      grep -q "tower" "$cargo" 2>/dev/null && frameworks+=("tower") || true
      grep -q "hyper" "$cargo" 2>/dev/null && frameworks+=("hyper") || true
      grep -q "reqwest" "$cargo" 2>/dev/null && frameworks+=("reqwest") || true
      grep -q "anyhow\|thiserror" "$cargo" 2>/dev/null && frameworks+=("rust-error") || true
      grep -q "async-std" "$cargo" 2>/dev/null && frameworks+=("async-std") || true
      grep -q "bevy" "$cargo" 2>/dev/null && frameworks+=("bevy") || true
      grep -q "iced" "$cargo" 2>/dev/null && frameworks+=("iced") || true
      grep -q "egui" "$cargo" 2>/dev/null && frameworks+=("egui") || true
      grep -q "criterion" "$cargo" 2>/dev/null && frameworks+=("criterion") || true
      grep -q "proptest" "$cargo" 2>/dev/null && frameworks+=("proptest") || true
      grep -q "opentelemetry" "$cargo" 2>/dev/null && frameworks+=("opentelemetry") || true
      grep -q "redis" "$cargo" 2>/dev/null && frameworks+=("redis") || true
      grep -q "lapin\|amqp" "$cargo" 2>/dev/null && frameworks+=("rabbitmq") || true
      grep -q "rdkafka" "$cargo" 2>/dev/null && frameworks+=("kafka") || true
      grep -q "nats" "$cargo" 2>/dev/null && frameworks+=("nats") || true
    fi
  done
fi

# --- Flutter/Dart ---
if [ "$dart_count" -gt 0 ]; then
  for ps in pubspec.yaml */pubspec.yaml; do
    if [ -f "$ps" ]; then
      grep -q "flutter:" "$ps" 2>/dev/null && frameworks+=("flutter") || true
      grep -q "riverpod" "$ps" 2>/dev/null && frameworks+=("riverpod") || true
      grep -q "bloc\|flutter_bloc" "$ps" 2>/dev/null && frameworks+=("bloc") || true
      grep -q "get:" "$ps" 2>/dev/null && frameworks+=("getx") || true
      grep -q "dio:" "$ps" 2>/dev/null && frameworks+=("dio") || true
      grep -q "drift\|moor" "$ps" 2>/dev/null && frameworks+=("drift") || true
      grep -q "freezed" "$ps" 2>/dev/null && frameworks+=("freezed") || true
      grep -q "serverpod" "$ps" 2>/dev/null && frameworks+=("serverpod") || true
    fi
  done
fi

# --- Swift ---
if [ "$swift_count" -gt 0 ]; then
  [ -f "Package.swift" ] && grep -q "vapor" Package.swift 2>/dev/null && frameworks+=("vapor") || true
  [ -f "Package.swift" ] && grep -q "hummingbird" Package.swift 2>/dev/null && frameworks+=("hummingbird") || true
  find . -maxdepth 2 -name "*.xcodeproj" 2>/dev/null | head -1 | grep -q . && frameworks+=("xcode") || true
  find . -maxdepth 2 -name "*.xcworkspace" 2>/dev/null | head -1 | grep -q . && frameworks+=("xcode") || true
  [ -f "Podfile" ] && frameworks+=("cocoapods") || true
fi

# --- Kotlin/Java/Android ---
if [ "$kt_count" -gt 0 ] || [ "$java_count" -gt 0 ]; then
  for bg in build.gradle.kts build.gradle */build.gradle.kts */build.gradle; do
    if [ -f "$bg" ]; then
      grep -q "android" "$bg" 2>/dev/null && frameworks+=("android") || true
      grep -q "ktor" "$bg" 2>/dev/null && frameworks+=("ktor") || true
      grep -q "spring" "$bg" 2>/dev/null && frameworks+=("spring") || true
      grep -q "compose" "$bg" 2>/dev/null && frameworks+=("jetpack-compose") || true
      grep -q "junit" "$bg" 2>/dev/null && frameworks+=("junit") || true
    fi
  done
  # Maven
  for pom in pom.xml */pom.xml; do
    if [ -f "$pom" ]; then
      grep -q "spring-boot" "$pom" 2>/dev/null && frameworks+=("spring-boot") || true
      grep -q "spring-cloud" "$pom" 2>/dev/null && frameworks+=("spring-cloud") || true
      grep -q "quarkus" "$pom" 2>/dev/null && frameworks+=("quarkus") || true
      grep -q "micronaut" "$pom" 2>/dev/null && frameworks+=("micronaut") || true
      grep -q "junit" "$pom" 2>/dev/null && frameworks+=("junit") || true
    fi
  done
fi

# --- Scala ---
if [ "$scala_count" -gt 0 ]; then
  for sbt in build.sbt */build.sbt; do
    if [ -f "$sbt" ]; then
      grep -q "akka" "$sbt" 2>/dev/null && frameworks+=("akka") || true
      grep -q "play" "$sbt" 2>/dev/null && frameworks+=("play") || true
      grep -q "http4s" "$sbt" 2>/dev/null && frameworks+=("http4s") || true
      grep -q "zio" "$sbt" 2>/dev/null && frameworks+=("zio") || true
      grep -q "cats" "$sbt" 2>/dev/null && frameworks+=("cats") || true
    fi
  done
fi

# --- Elixir ---
if [ "$ex_count" -gt 0 ] || [ "$exs_count" -gt 0 ]; then
  if [ -f "mix.exs" ]; then
    grep -q "phoenix" mix.exs 2>/dev/null && frameworks+=("phoenix") || true
    grep -q "ecto" mix.exs 2>/dev/null && frameworks+=("ecto") || true
    grep -q "live_view\|liveview" mix.exs 2>/dev/null && frameworks+=("liveview") || true
    grep -q "absinthe" mix.exs 2>/dev/null && frameworks+=("absinthe") || true
    grep -q "oban" mix.exs 2>/dev/null && frameworks+=("oban") || true
  fi
fi

# --- Clojure ---
if [ "$clj_count" -gt 0 ]; then
  for pclj in project.clj deps.edn; do
    if [ -f "$pclj" ]; then
      grep -q "ring" "$pclj" 2>/dev/null && frameworks+=("ring") || true
      grep -q "compojure" "$pclj" 2>/dev/null && frameworks+=("compojure") || true
      grep -q "reitit" "$pclj" 2>/dev/null && frameworks+=("reitit") || true
      grep -q "re-frame" "$pclj" 2>/dev/null && frameworks+=("re-frame") || true
    fi
  done
fi

# --- Data / dbt ---
[ -f "dbt_project.yml" ] && frameworks+=("dbt") || true
[ -f "profiles.yml" ] && [ -f "dbt_project.yml" ] && frameworks+=("dbt") || true
[ -f "dagster.yaml" ] || [ -d "dagster_home" ] && frameworks+=("dagster") || true
[ -f "airflow.cfg" ] || [ -d "dags" ] && frameworks+=("airflow") || true
[ -f "prefect.yaml" ] && frameworks+=("prefect") || true

# --- C# / .NET ---
if [ "$cs_count" -gt 0 ]; then
  for csproj in *.csproj */*.csproj; do
    if [ -f "$csproj" ]; then
      grep -qi "Microsoft.AspNetCore" "$csproj" 2>/dev/null && frameworks+=("aspnet") || true
      grep -qi "Blazor" "$csproj" 2>/dev/null && frameworks+=("blazor") || true
      grep -qi "Microsoft.Maui\|Xamarin" "$csproj" 2>/dev/null && frameworks+=("maui") || true
      grep -qi "EntityFramework\|Microsoft.EntityFrameworkCore" "$csproj" 2>/dev/null && frameworks+=("ef-core") || true
      grep -qi "xunit\|NUnit\|MSTest" "$csproj" 2>/dev/null && frameworks+=("dotnet-test") || true
      grep -qi "MediatR" "$csproj" 2>/dev/null && frameworks+=("mediatr") || true
      grep -qi "FluentValidation" "$csproj" 2>/dev/null && frameworks+=("fluent-validation") || true
      grep -qi "Serilog" "$csproj" 2>/dev/null && frameworks+=("serilog") || true
      grep -qi "AutoMapper" "$csproj" 2>/dev/null && frameworks+=("automapper") || true
      grep -qi "SignalR" "$csproj" 2>/dev/null && frameworks+=("signalr") || true
      grep -qi "Hangfire" "$csproj" 2>/dev/null && frameworks+=("hangfire") || true
      grep -qi "MassTransit" "$csproj" 2>/dev/null && frameworks+=("masstransit") || true
      grep -qi "Dapper" "$csproj" 2>/dev/null && frameworks+=("dapper") || true
      grep -qi "gRPC\|Grpc" "$csproj" 2>/dev/null && frameworks+=("grpc") || true
    fi
  done
  [ -f "global.json" ] && frameworks+=("dotnet") || true
  [ -f "*.sln" ] 2>/dev/null && frameworks+=("dotnet") || true
fi

# --- C / C++ ---
if [ "$c_count" -gt 0 ] || [ "$cpp_count" -gt 0 ]; then
  [ -f "CMakeLists.txt" ] && frameworks+=("cmake") || true
  [ -f "meson.build" ] && frameworks+=("meson") || true
  [ -f "Makefile" ] || [ -f "makefile" ] && frameworks+=("make") || true
  [ -f "conanfile.txt" ] || [ -f "conanfile.py" ] && frameworks+=("conan") || true
  [ -f "vcpkg.json" ] && frameworks+=("vcpkg") || true
  [ -f "xmake.lua" ] && frameworks+=("xmake") || true
  for cm in CMakeLists.txt */CMakeLists.txt; do
    if [ -f "$cm" ]; then
      grep -qi "Qt5\|Qt6\|find_package(Qt" "$cm" 2>/dev/null && frameworks+=("qt") || true
      grep -qi "SDL2\|SDL3" "$cm" 2>/dev/null && frameworks+=("sdl") || true
      grep -qi "OpenGL\|GLFW\|glad" "$cm" 2>/dev/null && frameworks+=("opengl") || true
      grep -qi "Vulkan" "$cm" 2>/dev/null && frameworks+=("vulkan") || true
      grep -qi "Boost" "$cm" 2>/dev/null && frameworks+=("boost") || true
      grep -qi "GTest\|gtest\|Google" "$cm" 2>/dev/null && frameworks+=("gtest") || true
      grep -qi "Catch2" "$cm" 2>/dev/null && frameworks+=("catch2") || true
      grep -qi "imgui" "$cm" 2>/dev/null && frameworks+=("imgui") || true
      grep -qi "protobuf\|grpc" "$cm" 2>/dev/null && frameworks+=("grpc") || true
      grep -qi "CUDA\|cuda" "$cm" 2>/dev/null && frameworks+=("cuda") || true
      grep -qi "OpenCV" "$cm" 2>/dev/null && frameworks+=("opencv") || true
      grep -qi "Raylib\|raylib" "$cm" 2>/dev/null && frameworks+=("raylib") || true
    fi
  done
fi

# --- Lua ---
if [ "$lua_count" -gt 0 ]; then
  [ -f "conf.lua" ] && frameworks+=("love2d") || true
  [ -f ".luacheckrc" ] && frameworks+=("luacheck") || true
  for rf in *.rockspec; do
    [ -f "$rf" ] && frameworks+=("luarocks") || true
  done
  # Neovim plugin
  find . -maxdepth 2 -name "plugin" -type d 2>/dev/null | head -1 | grep -q . && [ -d "lua" ] && frameworks+=("neovim-plugin") || true
fi

# --- Haskell ---
if [ "$hs_count" -gt 0 ]; then
  [ -f "stack.yaml" ] && frameworks+=("stack") || true
  [ -f "cabal.project" ] || find . -maxdepth 1 -name "*.cabal" 2>/dev/null | head -1 | grep -q . && frameworks+=("cabal") || true
  for cab in *.cabal; do
    if [ -f "$cab" ]; then
      grep -qi "servant" "$cab" 2>/dev/null && frameworks+=("servant") || true
      grep -qi "scotty" "$cab" 2>/dev/null && frameworks+=("scotty") || true
      grep -qi "yesod" "$cab" 2>/dev/null && frameworks+=("yesod") || true
      grep -qi "persistent" "$cab" 2>/dev/null && frameworks+=("persistent") || true
    fi
  done
fi

# --- Zig ---
if [ "$zig_count" -gt 0 ]; then
  [ -f "build.zig" ] && frameworks+=("zig-build") || true
  [ -f "build.zig.zon" ] && frameworks+=("zig-zon") || true
fi

# --- Nim ---
if [ "$nim_count" -gt 0 ]; then
  for nimble in *.nimble; do
    if [ -f "$nimble" ]; then
      grep -qi "jester" "$nimble" 2>/dev/null && frameworks+=("jester") || true
      grep -qi "prologue" "$nimble" 2>/dev/null && frameworks+=("prologue") || true
      grep -qi "karax" "$nimble" 2>/dev/null && frameworks+=("karax") || true
    fi
  done
fi

# --- Game Engines ---
[ -f "project.godot" ] && frameworks+=("godot") || true
find . -maxdepth 2 -name "*.unity" -o -name "ProjectSettings" -type d 2>/dev/null | head -1 | grep -q . && frameworks+=("unity") || true
[ -f "*.uproject" ] 2>/dev/null || find . -maxdepth 1 -name "*.uproject" 2>/dev/null | head -1 | grep -q . && frameworks+=("unreal") || true
[ -f "Cargo.toml" ] && grep -q "bevy" Cargo.toml 2>/dev/null && frameworks+=("bevy") || true
[ -f "requirements.txt" ] && grep -qi "pygame" requirements.txt 2>/dev/null && frameworks+=("pygame") || true

# --- WordPress / Drupal ---
[ -f "wp-config.php" ] || [ -d "wp-content" ] && frameworks+=("wordpress") || true
[ -f "core/modules" ] && [ -f "sites/default/settings.php" ] && frameworks+=("drupal") || true

# --- Deduplicate frameworks ---
if [ ${#frameworks[@]} -gt 0 ]; then
  frameworks=($(echo "${frameworks[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' '))
fi

# --- Infrastructure Detection ---
infra=()
[ -f "Dockerfile" ] || [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ] || [ -f "compose.yml" ] || [ -f "compose.yaml" ] && infra+=("docker")
[ -d ".github/workflows" ] && infra+=("github-actions")
[ -f ".gitlab-ci.yml" ] && infra+=("gitlab-ci")
[ -f "Jenkinsfile" ] && infra+=("jenkins")
[ -f "bitbucket-pipelines.yml" ] && infra+=("bitbucket-pipelines")
[ -f ".circleci/config.yml" ] && infra+=("circleci")
[ -f ".travis.yml" ] && infra+=("travis")
[ -d "terraform" ] || [ -f "main.tf" ] && infra+=("terraform")
[ -f "pulumi.yaml" ] || [ -f "Pulumi.yaml" ] && infra+=("pulumi")
[ -f "serverless.yml" ] || [ -f "serverless.yaml" ] || [ -f "serverless.ts" ] && infra+=("serverless")
[ -f "vercel.json" ] || [ -d ".vercel" ] && infra+=("vercel")
[ -f "netlify.toml" ] && infra+=("netlify")
[ -f "fly.toml" ] && infra+=("fly")
[ -f "render.yaml" ] && infra+=("render")
[ -f "railway.json" ] || [ -f "railway.toml" ] && infra+=("railway")
[ -f "Procfile" ] && infra+=("heroku")
[ -d "cdk.out" ] || [ -f "cdk.json" ] && infra+=("aws-cdk")
[ -f "sam.yaml" ] || [ -f "template.yaml" ] && infra+=("aws-sam")
[ -f "app.yaml" ] && grep -q "runtime:" app.yaml 2>/dev/null && infra+=("gcp-app-engine")
[ -f "cloudbuild.yaml" ] && infra+=("gcp-cloud-build")
[ -f "azure-pipelines.yml" ] && infra+=("azure-devops")
[ -d "kubernetes" ] || [ -d "k8s" ] && infra+=("kubernetes")
find . -maxdepth 2 -name "*.yaml" -exec grep -l "apiVersion" {} + 2>/dev/null | head -1 | grep -q . && infra+=("kubernetes") || true
[ -d "helm" ] || [ -f "Chart.yaml" ] && infra+=("helm")
[ -f "skaffold.yaml" ] && infra+=("skaffold")
[ -f "tilt_config.json" ] || [ -f "Tiltfile" ] && infra+=("tilt")
[ -f "ansible.cfg" ] || [ -d "playbooks" ] && infra+=("ansible")
[ -f "Vagrantfile" ] && infra+=("vagrant")
[ -f "flake.nix" ] && infra+=("nix")
[ -f "devcontainer.json" ] || [ -d ".devcontainer" ] && infra+=("devcontainer")
[ -f ".env.example" ] || [ -f ".env.sample" ] && infra+=("dotenv")
[ -f "lefthook.yml" ] || [ -f ".husky/_/husky.sh" ] || [ -d ".husky" ] && infra+=("git-hooks")
[ -f ".pre-commit-config.yaml" ] && infra+=("pre-commit")
[ -f "renovate.json" ] || [ -f ".renovaterc" ] && infra+=("renovate")
[ -f ".github/dependabot.yml" ] && infra+=("dependabot")
[ -f "CODEOWNERS" ] || [ -f ".github/CODEOWNERS" ] && infra+=("codeowners")

# Deduplicate infra
if [ ${#infra[@]} -gt 0 ]; then
  infra=($(echo "${infra[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' '))
fi

# --- Directory Structure ---
top_dirs=$(ls -d */ 2>/dev/null | head -20 | sed 's/\///' | tr '\n' ',' | sed 's/,$//')

# --- Workspace Packages (monorepo) ---
workspace_dirs=""
if [ "$is_monorepo" = "true" ]; then
  apps_dirs=$(ls -d apps/*/ 2>/dev/null | sed 's/\//,/g' | sed 's/,,/,/g' | sed 's/^,//' | sed 's/,$//' || true)
  pkg_dirs=$(ls -d packages/*/ 2>/dev/null | sed 's/\//,/g' | sed 's/,,/,/g' | sed 's/^,//' | sed 's/,$//' || true)
  workspace_dirs="${apps_dirs}${apps_dirs:+|}${pkg_dirs}"
fi

# --- Git Info ---
git_remote=""
if [ -d ".git" ]; then
  git_remote=$(git remote get-url origin 2>/dev/null || echo "")
fi

# --- Output JSON ---
to_json_array() {
  local arr=("$@")
  if [ ${#arr[@]} -eq 0 ]; then
    echo "[]"
    return
  fi
  local result="["
  for i in "${!arr[@]}"; do
    [ $i -gt 0 ] && result+=","
    result+="\"${arr[$i]}\""
  done
  result+="]"
  echo "$result"
}

cat <<EOJSON
{
  "languages": $(to_json_array "${langs[@]+"${langs[@]}"}"),
  "fileCounts": {
    "typescript": $ts_count,
    "tsx": $tsx_count,
    "javascript": $js_count,
    "jsx": $jsx_count,
    "python": $py_count,
    "go": $go_count,
    "rust": $rs_count,
    "java": $java_count,
    "kotlin": $kt_count,
    "swift": $swift_count,
    "ruby": $rb_count,
    "php": $php_count,
    "csharp": $cs_count,
    "dart": $dart_count,
    "vue": $vue_count,
    "svelte": $svelte_count,
    "c": $c_count,
    "cpp": $cpp_count,
    "scala": $scala_count,
    "clojure": $clj_count,
    "elixir": $(( ex_count + exs_count )),
    "zig": $zig_count,
    "lua": $lua_count,
    "r": $r_count,
    "haskell": $hs_count,
    "ocaml": $ml_count,
    "sql": $sql_count,
    "protobuf": $proto_count,
    "graphql": $(( graphql_count + gql_count )),
    "solidity": $sol_count,
    "astro": $astro_count,
    "jupyter": $ipynb_count
  },
  "packageManager": "$pkg_manager",
  "monorepo": {
    "detected": $is_monorepo,
    "tool": "$monorepo_tool",
    "workspaces": "$workspace_dirs"
  },
  "frameworks": $(to_json_array "${frameworks[@]+"${frameworks[@]}"}"),
  "infrastructure": $(to_json_array "${infra[@]+"${infra[@]}"}"),
  "topLevelDirs": "$top_dirs",
  "gitRemote": "$git_remote"
}
EOJSON
