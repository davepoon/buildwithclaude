#!/usr/bin/env node

/**
 * Unified Validation Script
 * Runs all component validators and produces a combined report
 */

const { spawn } = require('child_process');
const path = require('path');

const validators = [
  { name: 'Subagents & Commands', script: 'validate-subagents.js' },
  { name: 'Hooks', script: 'validate-hooks.js' },
  { name: 'Skills', script: 'validate-skills.js' }
];

const results = [];
let hasErrors = false;

console.log('\n\x1b[1m\x1b[34m========================================\x1b[0m');
console.log('\x1b[1m\x1b[34m  BuildWithClaude Validation Suite\x1b[0m');
console.log('\x1b[1m\x1b[34m========================================\x1b[0m\n');

async function runValidator(validator) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, validator.script);
    const startTime = Date.now();

    console.log(`\x1b[36m▶ Running ${validator.name} validation...\x1b[0m\n`);

    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      const success = code === 0;

      results.push({
        name: validator.name,
        script: validator.script,
        success,
        exitCode: code,
        duration
      });

      if (!success) {
        hasErrors = true;
      }

      console.log(''); // Add spacing between validators
      resolve();
    });

    child.on('error', (err) => {
      results.push({
        name: validator.name,
        script: validator.script,
        success: false,
        error: err.message
      });
      hasErrors = true;
      resolve();
    });
  });
}

async function main() {
  const totalStartTime = Date.now();

  // Run validators sequentially
  for (const validator of validators) {
    await runValidator(validator);
  }

  const totalDuration = Date.now() - totalStartTime;

  // Print summary
  console.log('\x1b[1m\x1b[34m========================================\x1b[0m');
  console.log('\x1b[1m\x1b[34m  Validation Summary\x1b[0m');
  console.log('\x1b[1m\x1b[34m========================================\x1b[0m\n');

  results.forEach(result => {
    const icon = result.success ? '\x1b[32m✅\x1b[0m' : '\x1b[31m❌\x1b[0m';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${icon} ${result.name}${duration}`);
    if (result.error) {
      console.log(`   \x1b[31mError: ${result.error}\x1b[0m`);
    }
  });

  console.log(`\n\x1b[90mTotal time: ${totalDuration}ms\x1b[0m`);

  if (hasErrors) {
    console.log('\n\x1b[31m\x1b[1m❌ Validation failed!\x1b[0m');
    console.log('\x1b[31mPlease fix the errors above before committing.\x1b[0m\n');
    process.exit(1);
  } else {
    console.log('\n\x1b[32m\x1b[1m✅ All validations passed!\x1b[0m\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\x1b[31mUnexpected error:\x1b[0m', err);
  process.exit(1);
});
