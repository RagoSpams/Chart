// Real chain integration: never replace the backend with a mock here.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { devnetSnapshot } from './devnet-diagnostics.mjs';
import { validatePassword } from '@midnight-ntwrk/midnight-js-utils';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const state = path.join(root, '.validation', 'e2e-' + Date.now());
mkdirSync(state, { recursive: true, mode: 0o700 });
const random = () => randomBytes(32).toString('hex');
const key = random();
let password;
for (;;) { password = 'Aa!' + randomBytes(36).toString('base64url'); try { validatePassword(password); break; } catch {} }
const env = { ...process.env, CHART_DEBUG_SYNTHETIC: 'false', CHART_DIAGNOSTICS: 'true', CHART_BRIDGE_API_KEY: key, CHART_INSTITUTION_SECRET: random(), CHART_PRIVATE_STATE_PASSWORD: password, CHART_DEPLOYMENT_FILE: path.join(state, 'deployment.json') };
const children = [];
let activeRequest = null;
const events = [];
const started = Date.now();
const results = [];
const timeout = setTimeout(async () => {
  console.error('Integration deadline exceeded; transaction outcome may be unknown');
  await failureEvidence('Integration deadline exceeded');
  cleanup(); process.exit(1);
}, 20 * 60 * 1000);
async function failureEvidence(error) {
  const txId = events.findLast(e => e.stage === 'submitTx' || e.stage === 'watchForTxData')?.txId;
  const snapshot = await devnetSnapshot(txId);
  writeFileSync(path.join(state, 'results.json'), JSON.stringify({ status: 'FAIL', results, error, activeRequest, elapsedMs: Date.now() - started, snapshot }, null, 2), { mode: 0o600 });
}
function cleanup() { for (const child of children) child.kill(); clearTimeout(timeout); }
function service(file, port, store) {
  const child = spawn(process.execPath, ['--import', 'tsx', path.join(root, file)], { cwd: root, env: { ...env, PORT: String(port), CHART_PRIVATE_STATE_DIR: path.join(state, store) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let buffered = '';
  child.stdout.on('data', d => {
    process.stdout.write(d);
    buffered += d.toString();
    let end;
    while ((end = buffered.indexOf('\n')) >= 0) {
      const line = buffered.slice(0, end); buffered = buffered.slice(end + 1);
      try {
        const event = JSON.parse(line).chartDiagnostic;
        if (event) { events.push(event); appendFileSync(path.join(state, 'diagnostics.jsonl'), JSON.stringify(event) + '\n', { mode: 0o600 }); }
      } catch { /* Non-diagnostic SDK output is not copied to structured evidence. */ }
    }
  });
  child.stderr.on('data', d => process.stderr.write(d));
  children.push(child);
}
const bridge = 'http://127.0.0.1:14000';
const verifier = 'http://127.0.0.1:14200';
async function request(base, route, body, expected = 200) {
  activeRequest = { service: base === bridge ? 'bridge' : 'verifier', route, startedAt: new Date().toISOString() };
  const requestStarted = Date.now();
  console.log(`${base === bridge ? 'bridge' : 'verifier'} ${route}: starting`);
  const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(base === bridge ? { Authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(600_000) });
  const result = await response.json();
  assert.equal(response.status, expected, `${route}: ${result.error || 'unexpected status'}`);
  console.log(`${route}: HTTP ${response.status}`);
  appendFileSync(path.join(state, 'requests.jsonl'), JSON.stringify({ ...activeRequest, status: response.status, elapsedMs: Date.now() - requestStarted }) + '\n', { mode: 0o600 });
  activeRequest = null;
  return result;
}
async function ready(base) {
  for (let n = 0; n < 60; n++) {
    try { if ((await fetch(base + '/health')).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Service failed to start: ' + base);
}
try {
  service('bridge/src/index.ts', 14000, 'bridge');
  service('verifier/server/src/index.ts', 14200, 'verifier');
  await Promise.all([ready(bridge), ready(verifier)]);
  const recipientSecret = random();
  const { recipientPubKey } = await request(verifier, '/derive-pubkey', { recipientSecret });
  let submitted;
  if (process.env.CHART_GNUHEALTH_PYTHON) {
    // The Python helper creates a fictional patient in a dedicated database,
    // invokes the real wizard and submits its actual GNU Health model values.
    const child = spawn(process.env.CHART_GNUHEALTH_PYTHON, [path.join(root, 'scripts/gnuhealth-synthetic.py')], { cwd: root, env: { ...env, CHART_BRIDGE_URL: bridge, CHART_SYNTHETIC_ONLY: 'true', CHART_SYNTHETIC_OUTPUT: path.join(state, 'submission.json') }, stdio: 'inherit' });
    children.push(child);
    activeRequest = { service: 'gnuhealth', route: '/record-bundle', startedAt: new Date().toISOString() };
    assert.equal(await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); }), 0, 'GNU Health integration failed');
    activeRequest = null;
    const { readFileSync } = await import('node:fs');
    submitted = JSON.parse(readFileSync(path.join(state, 'submission.json'), 'utf8'));
    results.push('GNU Health persisted synthetic patient -> real wizard -> bridge -> contract');
  } else {
    submitted = await request(bridge, '/record-bundle', {});
    results.push('Synthetic bridge submission -> real contract (GNU Health was not enabled)');
  }
  const { recordId, contractAddress, bundle } = submitted;
  const { tokenId } = await request(bridge, '/disclosure-token', { recordId, recipientPubKey });
  // Only send the chosen category, not unrelated witness categories.
  const args = category => ({ recordId, contractAddress, tokenId, recipientSecret, category, [category]: bundle[category], [category + 'Salt']: bundle[category + 'Salt'], ...(category === 'criticalFlags' ? { requestedFlag: 2 } : {}) });
  for (const category of ['vaccination', 'labResult', 'criticalFlags']) {
    assert.equal((await request(verifier, '/verify', args(category))).pass, true, category);
    results.push(`Real ${category} proof generated, submitted and finalized`);
  }
  assert.equal((await request(verifier, '/verify', { ...args('labResult'), recipientSecret: random() }, 403)).code, 'RECIPIENT_MISMATCH');
  results.push('Wrong recipient rejected by real contract');
  const expiryTime = Math.floor(Date.now()/1000) + 5;
  const expiring = await request(bridge, '/disclosure-token', { recordId, recipientPubKey, expiryTime });
  while (Date.now()/1000 <= expiryTime + 2) await new Promise(r => setTimeout(r, 1000));
  assert.equal((await request(verifier, '/verify', { ...args('labResult'), tokenId: expiring.tokenId }, 403)).code, 'TOKEN_EXPIRED');
  results.push('Expired token rejected by real contract');
  await request(bridge, '/revoke-token', { tokenId });
  assert.equal((await request(verifier, '/verify', args('labResult'), 403)).code, 'TOKEN_REVOKED');
  results.push('Revoked token rejected by real contract');
  const fresh = await request(bridge, '/disclosure-token', { recordId, recipientPubKey });
  await request(bridge, '/withdraw-record', { recordId });
  assert.equal((await request(verifier, '/verify', { ...args('labResult'), tokenId: fresh.tokenId }, 403)).code, 'RECORD_WITHDRAWN');
  results.push('Withdrawn record rejected with a previously issued, unrevoked token');
  const response = await fetch(verifier + `/record-status?contractAddress=${contractAddress}&recordId=${recordId}`);
  assert.deepEqual(await response.json(), { exists: true, withdrawn: true });
  results.push('Independent public indexer read confirms withdrawal');
  writeFileSync(path.join(state, 'results.json'), JSON.stringify({ status: 'PASS', results, elapsedMs: Date.now() - started }, null, 2));
  console.log(JSON.stringify({ status: 'PASS', results, elapsedMs: Date.now() - started }, null, 2));
} catch (error) {
  await failureEvidence(error.message);
  console.error(error.message); process.exitCode = 1;
} finally { cleanup(); }
