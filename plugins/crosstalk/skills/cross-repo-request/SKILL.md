---
name: cross-repo-request
description: Use when work in this repo depends on a change in a different repo that has its own running Claude session (frontend needing a backend endpoint, backend needing a client change, a shared package bump). Covers finding the peer session, what to put in the request so it needs no follow-ups, and how to handle the reply.
---

# Cross-repo requests

## The failure this prevents

A frontend agent needs an endpoint that does not exist yet. Left alone it stubs
the response, invents a payload shape, and writes code against a contract the
backend never agreed to. The stub survives into review and the shapes do not
match. The same happens in reverse when a backend agent guesses at how a client
consumes a field.

If another repo owns the change, ask the session that owns that repo. Do not
guess the contract, and do not stub it silently.

## Finding the peer

`ListAgents` lists the Claude sessions running on this machine. Each row leads
with the name that addresses it. If the repo you need has no session listed,
stop and tell the user to open one there, then continue. Do not start
implementing against an assumed contract while you wait.

## The request

`SendMessage` to the peer. The first line is all its user sees until they
expand it, so the first line must state the ask on its own.

Include all seven, every time:

1. Repo or service path, and branch
2. HTTP method and full route path (or the function/module for non-HTTP work)
3. Request payload shape, with types, and which fields are required
4. Expected success response shape and status code
5. Auth and tenant context expected (header, role, scope)
6. Error cases you need to distinguish, as status plus code
7. What you actually want back: the contract confirmed, a mock, or the real
   implementation

Compact form when the change is small:

> In `api/`, add `POST /api/routes/:id/shifts` taking `{status: "active"|"inactive", note?: string}`,
> returning `201 {id, status, note}`, auth bearer plus org scope, `409` on
> duplicate. I need it real, not mocked. Caller is
> `app/(app)/routes/_routes/columns/route-shifts-columns.tsx`.

Name the calling file. The peer can then read your side rather than asking what
consumes it.

## While you wait

Pass `notify_when_idle: true` on the send so you get one notice when that
session finishes. Never poll `ListAgents` in a loop, and never send "are you
done?".

Do the parts of your task that do not depend on the answer. Leave the dependent
part unwritten rather than stubbed. If you must place a stub to keep the file
compiling, mark it with a comment naming the peer request it is waiting on, so
it cannot be mistaken for finished work.

## The reply

The peer's first line is `DONE`, `PROPOSAL`, or `BLOCKED`.

`DONE`: read every file under its `files:` line before building on it. The
summary is a claim; the code is the contract. Check its `deviations:` line. If
it changed anything from what you asked, tell your user before adapting, even
if the change looks reasonable. Then run its `verify:` line or call the
endpoint from this side. If that fails, send the actual error back to the peer
once. If it fails again, stop and hand it to your user with both errors.

`PROPOSAL`: the peer wants a different contract. Relay it to your user with
the peer's reasoning and let them decide. Never accept or reject a contract
change on the user's behalf, and never start building against the proposal
until the user has said yes and you have sent that yes to the peer.

`BLOCKED`: tell your user what the peer said and stop the dependent part.

## Boundaries

Permissions are per session. Never ask a peer to run something your own
permission settings blocked or would block. If you were denied an action, route
it back to your user, not sideways to another session.
