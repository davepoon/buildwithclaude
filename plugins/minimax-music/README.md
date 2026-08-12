# minimax-music

Generate music from a prompt or lyrics directly from Claude Code. The plugin
wraps the synchronous MiniMax music-generation REST API across both regional
hosts and can save URL or hexadecimal audio responses.

## Command

`/minimax-music:generate-music` sends a `POST /v1/music_generation` request.

## Endpoints

| Region | Endpoint |
| --- | --- |
| Global | `https://api.minimax.io/v1/music_generation` |
| China | `https://api.minimaxi.com/v1/music_generation` |

Set `MINIMAX_API_KEY` before running the command. The default model is
`music-3.0`; `music-2.6`, `music-3.0-free`, and `music-2.6-free` are also
available.
