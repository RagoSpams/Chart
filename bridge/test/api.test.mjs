import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.ts';

const key = 'synthetic-test-authentication-key-123456';
const hex = 'ab'.repeat(32);
async function withApp(fn, options = {}) {
  let calls = 0;
  const app = createApp({ apiKey: key, deploy: async () => { calls++; throw new Error('Wallet must not initialize'); }, ...options });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try { await fn(url, () => calls); } finally { await new Promise(resolve => server.close(resolve)); }
}
const post = (url, path, body, auth = key) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` }, body: JSON.stringify(body) });

test('bridge rejects unauthorized submit, issue, verify, revoke, withdraw and export before wallet initialization', () => withApp(async (url, calls) => {
  for (const route of ['/record-bundle','/disclosure-token','/verify','/revoke-token','/withdraw-record']) {
    assert.equal((await post(url, route, {}, 'wrong')).status, 401);
  }
  assert.equal((await fetch(url + '/record-bundle/' + hex)).status, 401);
  assert.equal((await fetch(url + '/health')).status, 200);
  assert.equal(calls(), 0);
}));

test('bridge fails closed without authentication configuration', () => withApp(async url => {
  assert.equal((await post(url, '/record-bundle', {})).status, 503);
}, { apiKey: '' }));

test('raw export is denied even for authenticated users unless explicitly enabled', () => withApp(async url => {
  const r = await fetch(url + '/record-bundle/' + hex, { headers: { Authorization: `Bearer ${key}` } });
  assert.equal(r.status, 403);
}));

test('bridge rejects malformed nested values, identifiers, flags, dates and grants without wallet initialization', () => withApp(async (url, calls) => {
  const cases = [
    ['/record-bundle', null], ['/record-bundle', []],
    ...[{ vaccination: [] }, { vaccination: false }, { vaccination: { dose: -1 } }, { vaccination: { completed: 'false' } },
      { vaccination: { dose: 65536 } }, { vaccination: { vaccineId: 12 } }, { recordId: false },
      { criticalFlags: { critAllergic: null } }, { labResult: { rangeLow: 20, rangeHigh: 10 } },
      { labResult: { resultValue: 2 ** 32 } }, { labResult: { resultValue: 1.1 } }, { labResult: { analysisDate: '18446744073709551616' } },
      { labResult: { unknown: true } }].map(b => ['/record-bundle', b]),
    ['/disclosure-token', { recordId: hex, recipientPubKey: hex, expiryTime: 0 }],
    ['/disclosure-token', { recordId: hex, recipientPubKey: hex, grantVaccination: 'false' }],
    ['/disclosure-token', { recordId: hex }],
    ['/verify', { tokenId: hex, recordId: hex, category: 'other' }],
    ...[-1,9,true,{},'1e0'].map(requestedFlag => ['/verify', { tokenId: hex, recordId: hex, category: 'criticalFlags', requestedFlag }]),
    ['/revoke-token', { tokenId: 'abc' }], ['/withdraw-record', {}],
  ];
  for (const [route, body] of cases) assert.equal((await post(url, route, body)).status, 400, JSON.stringify(body));
  assert.equal(calls(), 0);
}));

test('malformed JSON and oversized bodies produce bounded JSON errors', () => withApp(async url => {
  for (const [body, expected] of [['{',400], [JSON.stringify({ data: 'a'.repeat(70000) }),413]]) {
    const r = await fetch(url + '/record-bundle', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body });
    assert.equal(r.status, expected); assert.equal(typeof (await r.json()).error, 'string');
  }
}));
