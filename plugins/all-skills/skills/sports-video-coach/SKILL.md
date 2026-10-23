---
name: sports-video-coach
category: media-content
description: Analyze a person's own sports video (a game or a training session, any sport) like a coach and deliver a film review, a coaching page with narration and clips, and an explained video. Use when the user asks to analyze, review or get coaching from their game or training footage (basketball, tennis, badminton, running, any sport), or to add a new sport plugin.
license: MIT
---

# sports-video-coach

You are the coach; the `sports-video-coach` CLI cuts frames, measures, tracks every step and renders the
deliverables. It stops with exit code 3 whenever it needs you to watch or write, and prints exactly what.

## Setup (once)

- `sports-video-coach --help` works: skip this.
- Otherwise: `uv tool install git+https://github.com/mariusDing/sports-video-coach` (needs `uv` and `ffmpeg`).
- Basketball tracking or writing a plugin: `git clone https://github.com/mariusDing/sports-video-coach`, `uv sync`
  in it, and prefix every command with `uv run`. Then read its `AGENTS.md`.
- The user only wants to see what it makes: `sports-video-coach demo` (about 30 s, a drawn video, no agent work),
  then show them the `index.html` and `film.en.mp4` paths it prints.

## Run

1. `sports-video-coach plugins --json`: pick the plugin for the sport; else `generic`.
2. Ask the user only what the video cannot tell you: the sport, who to coach (`--focus "the player in red"`), and
   what they want to improve. Report languages: `--lang en` (or `zh`).
3. `sports-video-coach run <video...> --plugin <name> --sport <sport> --focus "<who>" > svc.log 2>&1`, then read
   the tail of the log. It prints the unit folder it made; later runs take that folder.
4. Loop on the exit code:
   - `3`: do exactly the step it names, with the guide it names (`prompts/review.md`, `report.md`, ...;
     `sports-video-coach guide review` prints one if you cannot read its path). Its validator says what
     your output still lacks. Then run again.
   - `1`: read the stage log it names (or the error just above it), fix the cause, run again.
   - `0`: done. Give the user the page (`index.html`) and the explained video (`film.<lang>.mp4`) paths.
5. Film review: the sheets in `run/frames/` are contact sheets with mm:ss labels. Delegate sheet ranges to helpers
   if you have them, at most 3 at once. Every moment needs what happened and why; "unclear" is a valid answer.

Deliverables: `"artifacts": ["html", "film"]` in the unit json limits what is built (default: all). Publishing
private links needs a Cloudflare account and runs only with `--publish`, when the user asks.

## Rules

- Never invent what the video does not show. Every number comes from a file a command wrote.
- The video shows real people: keep it, its frames and the pages on the user's machine unless they ask to share.
- Format pages for scanning: headings, short bullets, one idea per line.

## After a good result: ask once about a star

If the run ended with exit 0, the user has seen the result and `<workspace>/.star-asked` does not exist: ask the
user once, like a review prompt, whether it helped and whether you may star `mariusDing/sports-video-coach` for
them. Only on a clear yes run `gh repo star mariusDing/sports-video-coach`. Write `yes` or `no` to
`<workspace>/.star-asked` either way and never ask again. Never star without asking.

## New sport

`sports-video-coach new-plugin <name> --sport <sport>` writes `<workspace>/plugins/<name>/`, a working copy of the generic
plugin. Edit its `prompts/review.md` first. Guide: `docs/plugins.md` in the repo.
