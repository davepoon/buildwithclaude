const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const validatorPath = path.join(__dirname, 'validate-subagents.js');

// Builds a throwaway checkout containing only the paths the validator globs,
// so the agent-only checks can be exercised without touching plugins/.
function createFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-subagents-'));
  const agentsDir = path.join(root, 'plugins', 'all-agents', 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.mkdirSync(path.join(root, 'plugins', 'all-commands', 'commands'), { recursive: true });

  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(agentsDir, name), contents);
  }

  return root;
}

function agentFile({ name, statement = 'You are a probe agent used by the validator tests.' }) {
  return [
    '---',
    `name: ${name}`,
    'description: Scratch agent used to exercise the subagent validator in tests.',
    'category: data-ai',
    '---',
    '',
    `# ${name}`,
    '',
    statement,
    ''
  ].join('\n');
}

function runValidator(cwd) {
  const result = spawnSync(process.execPath, [validatorPath], { cwd, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test('accepts an agent whose file name matches its name field', () => {
  const root = createFixture({ 'probe-agent.md': agentFile({ name: 'probe-agent' }) });

  try {
    const { status, output } = runValidator(root);
    assert.equal(status, 0, output);
    assert.match(output, /All validations passed/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('fails when an agent file name does not match the name field', () => {
  const root = createFixture({ 'probe-agent.md': agentFile({ name: 'other-name' }) });

  try {
    const { status, output } = runValidator(root);
    assert.equal(status, 1, output);
    assert.match(output, /doesn't match name field 'other-name'/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('fails when two agent files share the same name', () => {
  const root = createFixture({
    'probe-agent.md': agentFile({ name: 'probe-agent' }),
    'probe-agent-copy.md': agentFile({ name: 'probe-agent' })
  });

  try {
    const { status, output } = runValidator(root);
    assert.equal(status, 1, output);
    assert.match(output, /Duplicate name 'probe-agent'/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('warns but still passes when an agent has no opening statement', () => {
  const root = createFixture({
    'probe-agent.md': agentFile({ name: 'probe-agent', statement: 'This agent has no opening statement.' })
  });

  try {
    const { status, output } = runValidator(root);
    assert.equal(status, 0, output);
    assert.match(output, /Missing opening statement/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
