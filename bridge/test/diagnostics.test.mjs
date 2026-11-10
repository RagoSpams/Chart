import assert from 'node:assert/strict';
import { test } from 'node:test';
import { instrumentProvider } from '../src/diagnostics.ts';

test('transaction diagnostics preserve results and omit private arguments and errors', async () => {
  const events = [];
  const secret = 'synthetic-private-witness-do-not-log';
  const failure = new Error(secret);
  const provider = instrumentProvider({ async proveTx(value) { assert.equal(value, secret); return 42; }, async balanceTx() { throw failure; } }, 'test', { enabled: true, sink: e => events.push(e) });
  assert.equal(await provider.proveTx(secret), 42);
  await assert.rejects(provider.balanceTx(secret), e => e === failure);
  assert.deepEqual(events.map(e => e.state), ['started', 'completed', 'started', 'failed']);
  assert.equal(JSON.stringify(events).includes(secret), false);
});

test('pending finalization is observable and never retried or converted to success', async () => {
  const events = [];
  let finish, pending, calls = 0;
  const heartbeatSeen = new Promise(resolve => { pending = resolve; });
  const provider = instrumentProvider({ async watchForTxData() { calls++; return new Promise(resolve => { finish = resolve; }); } }, 'indexer', { enabled: true, heartbeatMs: 5, sink: e => { events.push(e); if (e.state === 'pending') pending(); } });
  const waiting = provider.watchForTxData('ab'.repeat(32));
  // Keep an ordinary test deadline alive while the diagnostic timer is unref'd.
  const deadline = setTimeout(() => pending(), 1000);
  await heartbeatSeen;
  clearTimeout(deadline);
  assert.ok(events.some(e => e.state === 'pending'));
  assert.equal(events.some(e => e.state === 'completed'), false);
  assert.equal(calls, 1);
  finish('finalized');
  assert.equal(await waiting, 'finalized');
  assert.equal(events.at(-1).txId, 'ab'.repeat(32));
});

test('diagnostic sink failures do not alter transaction results', async () => {
  const provider = instrumentProvider({ async submitTx() { return 'ok'; } }, 'test', { enabled: true, sink() { throw new Error('unavailable logging'); } });
  assert.equal(await provider.submitTx({ identifiers: () => [] }), 'ok');
});

test('diagnostics retain actual ledger-8 33-byte public transaction identifiers', async () => {
  const events = [];
  const txId = '01' + 'ab'.repeat(32);
  const provider = instrumentProvider({ async submitTx() { return txId; } }, 'wallet', { enabled: true, sink: event => events.push(event) });
  assert.equal(await provider.submitTx({ identifiers: () => [txId], privateWitness: 'must-not-log' }), txId);
  assert.ok(events.every(event => event.txId === txId));
  assert.equal(JSON.stringify(events).includes('must-not-log'), false);
});
