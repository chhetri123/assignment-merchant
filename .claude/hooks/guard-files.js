#!/usr/bin/env node
// PreToolUse hook for Edit|Write. Keeps real env files and keys out of agent edits,
// and blocks the shortcuts this codebase has banned.
const path = require('path');

function block(reason) {
  process.stderr.write(`Blocked by guard-files: ${reason}\n`);
  process.exit(2);
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw).tool_input ?? {};
  } catch {
    process.exit(0);
  }
  const file = input.file_path ?? '';
  const base = path.basename(file);

  if (/^\.env(\..+)?$/.test(base) && !/^\.env\.example$/.test(base)) {
    block(`${base} holds real config; edit .env.example and let the user fill .env.`);
  }
  if (/\.(pem|key|p12|pfx)$/.test(base)) {
    block('key files must not be created or edited by agents.');
  }
  const text = `${input.content ?? ''}${input.new_string ?? ''}`;
  if (/synchronize\s*:\s*true/.test(text)) {
    block('synchronize: true is not allowed; use migrations.');
  }
  if (/\bas\s+never\b/.test(text) || /\bas\s+unknown\s+as\b/.test(text) || /:\s*any\b/.test(text)) {
    block(
      'no `any`, `as never` or `as unknown as` — find the real type instead of silencing the compiler.',
    );
  }

  process.exit(0);
});
