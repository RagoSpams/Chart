import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'contracts/src/gnuhealth_disclosure.compact');
const output = path.join(root, 'contracts/managed/gnuhealth_disclosure');
// Pin the compiler that emits compact-runtime 0.16.0, including on Windows,
// where System32/compact.exe is an unrelated file-compression utility.
let command = 'compact';
let args = ['compile', '+0.31.1', source, output];
if (process.platform === 'win32') {
  const linux = p => '/mnt/' + p[0].toLowerCase() + p.slice(2).replaceAll('\\', '/');
  const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
  command = 'wsl.exe';
  args = ['-d', process.env.CHART_WSL_DISTRO || 'Ubuntu', '--', 'bash', '-lc',
    `compact compile +0.31.1 ${quote(linux(source))} ${quote(linux(output))}`];
}
const result = spawnSync(command, args, { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
