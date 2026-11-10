import { rmSync, existsSync, lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const outputs = { contracts: ['contracts/managed'], bridge: ['bridge/dist'], server: ['verifier/server/dist'], web: ['verifier/web/dist'] };
const target = process.argv[2];
if (target && !Object.hasOwn(outputs, target)) throw new Error('Unknown workspace');
for (const relative of target ? outputs[target] : Object.values(outputs).flat()) {
  const output = path.resolve(root, relative);
  if (!output.startsWith(root + path.sep)) throw new Error('Refusing to clean outside the repository');
  if (existsSync(output)) {
    if (lstatSync(output).isSymbolicLink() || !realpathSync(output).startsWith(root + path.sep)) throw new Error('Refusing to follow generated-output symlinks');
    rmSync(output, { recursive: true, force: true });
  }
}
