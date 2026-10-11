#!/usr/bin/env node
// PreToolUse hook for Bash. Exit code 2 blocks the command and shows stderr to Claude.
// Guards the assignment's automatic-fail conditions plus the mistakes this repo has
// actually hit: a hard reset that discarded a commit, and tests pointed at the dev database.
const { execSync } = require('child_process');

function block(reason) {
  process.stderr.write(`Blocked by guard-bash: ${reason}\n`);
  process.exit(2);
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let cmd = '';
  try {
    cmd = JSON.parse(raw).tool_input?.command ?? '';
  } catch {
    process.exit(0);
  }

  if (/\bgit\b[^;&|]*\s--no-verify\b/.test(cmd) || /\bgit\s+commit\b[^;&|]*\s-n\b/.test(cmd)) {
    block('do not skip the husky hooks; fix what they report instead.');
  }
  if (/\bgit\s+push\b[^;&|]*\s(--force\b|-f\b|--force-with-lease\b)/.test(cmd)) {
    block('force push is not allowed.');
  }
  if (/\bgit\s+reset\b[^;&|]*\s--hard\b/.test(cmd)) {
    block(
      'git reset --hard discards committed work and the working tree. ' +
        'Use --soft to drop a commit, or git restore for a single file.',
    );
  }
  if (/\bgit\s+add\b[^;&|]*(\s|\/)\.env(\s|$|\.(?!example))/.test(cmd)) {
    block('.env must never be staged; only .env.example is tracked.');
  }
  if (/\brm\s+-[a-zA-Z]*[rR][a-zA-Z]*\s+(\/|~\/?|\.\/?|\*|\.\.)(\s|$)/.test(cmd)) {
    block('broad recursive delete refused.');
  }

  // The e2e suite must never run against the development database.
  if (/\bDB_DATABASE=(?!merchant_test)/.test(cmd) && /test:e2e|jest-e2e/.test(cmd)) {
    block('e2e runs against merchant_test only; do not override DB_DATABASE.');
  }
  // obliterate() deletes the queue under a running worker and makes the suite hang.
  if (/\.obliterate\s*\(/.test(cmd)) {
    block('do not obliterate the BullMQ queue; drain and clean it instead.');
  }

  if (/\bgit\s+commit\b/.test(cmd)) {
    let staged = '';
    let diff = '';
    try {
      staged = execSync('git diff --cached --name-only', { encoding: 'utf8' });
      diff = execSync('git diff --cached -U0', { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    } catch {
      process.exit(0);
    }

    const badFile = staged
      .split('\n')
      .filter(Boolean)
      .find(
        (f) =>
          (/(^|\/)\.env(\.|$)/.test(f) && !/\.env\.example$/.test(f)) ||
          /\.(pem|key|p12|pfx)$/.test(f) ||
          /(^|\/)(dist|coverage|node_modules|\.claude)\//.test(f),
      );
    if (badFile) block(`staged file should not be committed: ${badFile}`);

    const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
    const patterns = [
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
      /\bAKIA[0-9A-Z]{16}\b/,
      /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
      /\bsk-[A-Za-z0-9]{20,}\b/,
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
      /\b(JWT_ACCESS_SECRET|JWT_REFRESH_SECRET|ENCRYPTION_KEY|DB_PASSWORD|REDIS_PASSWORD)\s*[:=]\s*['"]?(?!change-?me|replace-with|<|\$\{|placeholder|example)[^\s'"]{16,}/i,
      /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/,
    ];
    const hit = added.find((l) => patterns.some((p) => p.test(l)));
    if (hit) {
      block(
        `staged changes look like a secret, token or card number: "${hit.slice(0, 80)}…" ` +
          'Remove it or use a placeholder.',
      );
    }
  }

  process.exit(0);
});
