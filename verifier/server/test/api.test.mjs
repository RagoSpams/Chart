import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.ts';
const hex = 'cd'.repeat(32);

test('verifier rejects malformed inputs before calling any Midnight operation', async () => {
  let calls = 0;
  const fail = () => { calls++; throw new Error('Backend must not run'); };
  const app = createApp({ deriveRecipientPubKeyLocally: fail, getRecordStatus: fail, verifyVaccinationBundle: fail, verifyLabResultBundle: fail, verifyCriticalFlagsBundle: fail });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const base = { contractAddress: hex, recipientSecret: hex, tokenId: hex, recordId: hex, category: 'labResult', labResult: { testTypeId: hex, resultValue: '1', rangeLow: '0', rangeHigh: '2', analysisDate: '1' }, labResultSalt: hex };
    const cases = [null, [], {}, { ...base, contractAddress: 'xyz' }, { ...base, labResult: null }, { ...base, labResult: [] }, { ...base, labResult: { ...base.labResult, resultValue: -1 } }, { ...base, labResultSalt: hex + 'a' }, { ...base, recipientSecret: 1 }, { ...base, category: 'unknown' }];
    for (const body of cases) {
      const r = await fetch(url + '/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(r.headers.get('cache-control'), 'no-store');
    }
    for (const body of [{}, { recipientSecret: 'zz'.repeat(32) }]) assert.equal((await fetch(url + '/derive-pubkey', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })).status, 400);
    assert.equal((await fetch(url + '/record-status?contractAddress=x&recordId=x')).status, 400);
    assert.equal(calls, 0);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
