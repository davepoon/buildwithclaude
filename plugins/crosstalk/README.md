# crosstalk

Two repos, two Claude Code sessions, one change that spans both.

The frontend session needs an endpoint the backend has not built. Left alone it
stubs the response, invents a payload shape, and ships code against a contract
nobody agreed to. crosstalk makes it ask the session that owns the backend
instead, and wait for a real answer, with you approving both ends.

Claude Code already delivers messages between local sessions. crosstalk adds
what's missing: a request specific enough to need no follow-ups, a reply shape
the other side can build on, and the rule not to guess while waiting.

## Install

```
claude plugin marketplace add d7omdev/crosstalk
claude plugin install crosstalk@d7omdev
```

Or inside Claude Code: `/plugin marketplace add d7omdev/crosstalk`, then
`/plugin install crosstalk@d7omdev`.

Install it once per machine. Both sessions need it: one side sends, the other
side answers.

## Use

Start `claude` in each repo. They find each other automatically
(`/list-agents` shows who's reachable).

From the repo that needs something:

```
/ask-peer the shifts endpoint needs to accept a status field
```

The command reads your side of the contract (calling file, existing types,
neighbouring routes), drafts a request, shows it to you, and sends on your yes.

The other session summarizes the ask to its user, waits for a yes, does the
work, and replies:

```
DONE POST /api/routes/:id/shifts
files: src/routes/shifts.ts, src/schemas/shift.ts
contract: {status: "active"|"inactive", note?: string} -> 201 {id, status, note}
errors: 409 SHIFT_DUPLICATE, 404 ROUTE_NOT_FOUND
verify: bun test test/shifts.test.ts
deviations from request: none
```

The requesting side then reads the files it named, runs the verify line, and
only then builds against it. `deviations:` is the line that matters: anything
the implementer changed from the ask is listed there, so nothing drifts
silently.

The skills also trigger on their own. Any time a task in one repo depends on a
change in another, the agent is told to ask rather than assume, with or without
the slash command.

## You stay in the loop

- Sending side shows you the request and waits for a yes.
- Receiving side shows its user the ask and waits for a yes.
- If the two agents disagree on the contract, the implementer replies
  `PROPOSAL` and the requester brings it to you. Neither side settles it alone.
- If verification fails, one error round-trip goes to the peer, then it
  escalates to you.
- Permissions stay per session. A peer cannot ask the other side to do
  something its own settings blocked.

## What's inside

```
skills/cross-repo-request/            asking: what to include, how to handle the reply
skills/answering-cross-repo-request/  answering: user gate, pushback, reply shape
commands/ask-peer.md                  /ask-peer <what you need>
```

No hooks, no MCP server. The transport is Claude Code's own session messaging.
