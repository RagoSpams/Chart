import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const python = process.env.CHART_GNUHEALTH_PYTHON;
if (!python) throw new Error('Set CHART_GNUHEALTH_PYTHON to the integration virtual environment Python executable');
const local = path.join(root, '.validation');
mkdirSync(local, { recursive: true });
mkdirSync(path.join(local, 'tryton-data'), { recursive: true });
function localSecret(name) {
  const file = path.join(local, name);
  if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString('hex'), { mode: 0o600 });
  return readFileSync(file, 'utf8').trim();
}
const password = localSecret('database-password');
localSecret('tryton-admin-password');
const config = path.join(local, 'trytond.conf');
writeFileSync(config, `[database]\nuri = postgresql://chart_synthetic:${password}@127.0.0.1:55432/\npath = ${path.join(local, 'tryton-data')}\n[web]\nlisten = 127.0.0.1:18000\n`, { mode: 0o600 });
const env = { ...process.env, CHART_SYNTHETIC_ONLY: 'true', CHART_SEED_ONLY: 'true', CHART_TEST_DATABASE_PASSWORD: password, TRYTONPASSFILE: path.join(local, 'tryton-admin-password'), TZ: 'UTC' };
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed with status ${result.status}`);
}
run('docker', ['compose', '-f', 'docker-compose.integration.yml', '--profile', 'integration', 'up', '-d', '--wait', '--wait-timeout', '120']);
const admin = execFileSync(python, ['-c', "import sysconfig; from pathlib import Path; print(Path(sysconfig.get_path('scripts')) / 'trytond-admin')"], { encoding: 'utf8' }).trim();
const common = [admin, '-c', config, '-d', 'chart_synthetic', '--activate-dependencies', '--email', 'synthetic@example.invalid'];
run(python, [...common, '--all']);
run(python, [...common, '-u', 'health_midnight_disclosure']);
run(python, [path.join(root, 'scripts/gnuhealth-synthetic.py')]);
console.log('Dedicated synthetic GNU Health database and disclosure wizard are ready.');
