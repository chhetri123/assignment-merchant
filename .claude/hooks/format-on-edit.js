#!/usr/bin/env node
// PostToolUse hook for Edit|Write. Formats the edited file with the project's Prettier.
// Never blocks; if Prettier is not installed it does nothing.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const file = JSON.parse(raw).tool_input?.file_path ?? '';
    if (
      !/\.(ts|js|json|md|yml|yaml)$/.test(file) ||
      file.includes(`${path.sep}.claude${path.sep}`)
    ) {
      process.exit(0);
    }

    const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const prettier = path.join(root, 'node_modules', '.bin', 'prettier');
    if (!fs.existsSync(prettier) || !fs.existsSync(file)) process.exit(0);

    execFileSync(prettier, ['--write', '--log-level', 'warn', file], {
      cwd: root,
      stdio: 'ignore',
      timeout: 20000,
    });
  } catch {
    // formatting is best effort
  }
  process.exit(0);
});
