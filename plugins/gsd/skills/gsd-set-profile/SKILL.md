---
name: gsd-set-profile
description: "Switch model profile for GSD agents (quality/balanced/budget/inherit)"
argument-hint: "<profile (quality|balanced|budget|inherit)>"
allowed-tools:
  - Bash
---


Show the following output to the user verbatim, with no extra commentary:

!`node "$GSD_TOOLS" config-set-model-profile $ARGUMENTS --raw`
