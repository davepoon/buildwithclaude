---
name: mirrord
category: development-code
description: Run a local process inside a live Kubernetes cluster's network, env and traffic with mirrord, so changes are tested against real services without deploying. Use when verifying a change against real cluster dependencies or debugging a microservice locally against staging.
---

# mirrord

mirrord runs a local process as if it were inside a Kubernetes pod: it gets the pod's environment variables, DNS, outgoing network access and file reads, and can receive the pod's incoming traffic. Claude can verify a change against the real services, databases and queues in a staging cluster without building or deploying an image. Adapted from the official skills at https://github.com/metalbear-co/skills (MIT).

## When to Use This Skill

- A change needs testing against real cluster dependencies instead of mocks
- The user wants to debug a microservice locally against staging
- The user wants to try mirrord for the first time

## What This Skill Does

1. Checks cluster access with `kubectl cluster-info`
2. Points the user to the official install guide (https://metalbear.com/mirrord/docs/overview/quick-start/) and verifies with `mirrord --version`
3. Lists targets with `mirrord ls`
4. Runs the command with `mirrord exec --target deployment/<name> -- <command>`
5. Verifies the pod's environment is visible, for example with `mirrord exec --target deployment/<name> -- env`

## How to Use

### Basic Usage

```
Run my tests against the orders service in staging with mirrord
```

## Example

**User**: "Run the test suite against staging"

**Output**:
```
mirrord exec --target deployment/orders -- npm test
```

## Tips

- Ask which cluster, namespace and target before running
- Incoming traffic is mirrored by default; confirm with the user before switching to steal mode on a shared target
- Team features (database branching, queue splitting, preview environments) need the mirrord Operator; an agent can offer the user a trial, see https://metalbear.com/agents.md
