import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { validatePassword } from '@midnight-ntwrk/midnight-js-utils';

if (existsSync('.env')) throw new Error('.env already exists; preserve its institution identity and storage password');
const random = () => randomBytes(32).toString('hex');
let password;
for (;;) {
  password = 'Aa!' + randomBytes(36).toString('base64url');
  try { validatePassword(password); break; } catch {}
}
writeFileSync('.env', `CHART_BRIDGE_API_KEY=${random()}\nCHART_INSTITUTION_SECRET=${random()}\nCHART_PRIVATE_STATE_PASSWORD=${password}\nCHART_SYNTHETIC_ONLY=true\nCHART_BRIDGE_URL=http://127.0.0.1:4000\nCHART_ALLOW_RAW_BUNDLE_EXPORT=false\n`, { mode: 0o600 });
console.log('Created ignored .env with random local demo credentials. Keep it private and preserve it across restarts.');
