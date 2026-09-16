---
description: Send a work request to a Claude session running in another repo
argument-hint: <what you need from the other repo>
allowed-tools: ListAgents, SendMessage, AskUserQuestion, Read, Grep, Glob
---

Use the `cross-repo-request` skill for this.

The user needs: $ARGUMENTS

1. Run `ListAgents` to see which sessions are reachable. If more than one could
   own this work, ask the user which, showing the names. If none is a plausible
   owner, say so and stop.
2. Gather the contract from THIS side before drafting: read the calling file,
   the existing client/types, and any adjacent route that sets the convention.
   The request is only useful if it is specific.
3. Show the user the full drafted message and the recipient, and ask "send
   this?". Do not send until they say yes. Apply any edits they give.
4. Send with `notify_when_idle: true`. First line states the ask on its own.
5. Continue with the parts of the task that do not depend on the reply.
