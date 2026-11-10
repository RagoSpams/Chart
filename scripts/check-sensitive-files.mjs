/** Block accidental committing of common secret and patient-data artifacts.
 * This is a guardrail, not a substitute for secret scanning or PHI review.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
const git = spawnSync('git', ['ls-files', '-z'], {encoding:'utf8'});
const ignored = new Set(['node_modules', '.git', '.validation', 'managed', 'dist', 'build', '__pycache__', 'bridge-state', 'verifier-state', 'midnight-level-db']);
function walk(dir = '.') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (ignored.has(entry.name) || entry.name.endsWith('.egg-info')) return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file.replaceAll('\\', '/')];
  });
}
const paths = git.status === 0 ? git.stdout.split('\0').filter(Boolean) : walk();
console.log(git.status === 0 ? 'Checking tracked filenames.' : 'No Git metadata: checking source filenames, excluding generated/local state.');
const forbidden = [
  /(^|\/)\.env(?:\..+)?$/i,
  /(^|\/)(?:id_rsa|id_ed25519)(?:\.pub)?$/i,
  /(^|\/).*\.(?:pem|p12|pfx|key)$/i,
  /(^|\/)patient[-_]?exports?\//i,
  /(^|\/)real[-_]?patient[-_]?data\//i,
  /(^|\/)\.validation\//i,
  /(^|\/)\.midnight-state\.json$/i,
  /(^|\/)deployed-contract\.json$/i,
];
const allowed = /(^|\/)\.env\.(?:example|sample|template)$/i;
const flagged = paths.filter(p=>!allowed.test(p)&&forbidden.some(rx=>rx.test(p)));
if(flagged.length){
 console.error('Potentially sensitive tracked paths:\n'+flagged.map(p=>' - '+p).join('\n'));
 process.exitCode=1;
} else console.log('No common tracked secret-file patterns found.');
