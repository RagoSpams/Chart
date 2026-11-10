// A review guard for the proposed Git index, not a substitute for a full secret scanner.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const git = spawnSync('git', ['ls-files', '--cached', '-z'], { encoding: 'utf8' });
if (git.status !== 0) {
  console.error('Git metadata is required to audit the actual proposed release index. No tracked-file assurance can be given for a source ZIP.');
  process.exit(2);
}
const files = git.stdout.split('\0').filter(Boolean);
const checks = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['populated Chart credential', /^[ \t]*CHART_(?:BRIDGE_API_KEY|INSTITUTION_SECRET|PRIVATE_STATE_PASSWORD|TEST_DATABASE_PASSWORD)[ \t]*=[ \t]*[^\s#]+/m],
  ['developer-specific absolute path', /(?:[A-Z]:[\\/]Users[\\/][^\\/\s]+[\\/]|\/(?:home|Users)\/[^/\s]+\/)/],
];
const findings = [];
for (const file of files) {
  if (/\.(?:png|jpe?g|gif|ico|woff2?|pdf)$/i.test(file)) continue;
  const data = readFileSync(file);
  if (data.includes(0)) { findings.push(`${file}: binary content needs manual review`); continue; }
  const text = data.toString('utf8');
  for (const [label, pattern] of checks) {
    const match = pattern.exec(text);
    if (match) findings.push(`${file}:${text.slice(0, match.index).split('\n').length}: ${label}`);
  }
}
if (findings.length) { console.error(findings.join('\n')); process.exitCode = 1; }
else console.log(`Release content guard: PASS (${files.length} Git-indexed source files; no matched credential or developer-path patterns).`);
