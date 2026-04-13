#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distEntry = join(__dirname, "..", "dist", "index.js");
const args = process.argv.slice(2);

try {
  execFileSync(process.execPath, [distEntry, ...args], {
    stdio: "inherit",
    env: process.env,
  });
} catch (err) {
  process.exit(err.status ?? 1);
}
