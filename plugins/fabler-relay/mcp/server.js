#!/usr/bin/env node
// Fabler Relay MCP server — lets any MCP client (Claude Code, Claude Desktop, ...)
// file and poll human-in-the-loop requests on a deployed Fabler Relay.
// Zero dependencies: speaks MCP's stdio transport (newline-delimited JSON-RPC)
// directly. Node 18+ (global fetch).
//
// Tool definitions + JSON-RPC handling live in ./tools.js and are shared with
// the Streamable-HTTP transport (./http-server.js) so both behave identically.
//
// Env:
//   RELAY_URL       https://relay.example.com   (your deployed worker)
//   RELAY_AGENT_KEY the agent bearer key (wrangler secret RELAY_AGENT_KEY)
//
// Hard rule carried over from the relay itself: platform credentials/API keys
// must NEVER enter the relay. The server rejects secret-shaped payloads (422).

const { dispatch } = require("./tools.js");

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function handle(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const res = await dispatch(msg);
  if (res) send(res);
}

let buf = "";
let inflight = 0;
let ended = false;
// don't drop in-flight tool calls when stdin closes (e.g. piped one-shot use)
function maybeExit() {
  if (ended && inflight === 0) process.exit(0);
}
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (line.trim()) {
      inflight++;
      handle(line).finally(() => {
        inflight--;
        maybeExit();
      });
    }
  }
});
process.stdin.on("end", () => {
  ended = true;
  maybeExit();
});
