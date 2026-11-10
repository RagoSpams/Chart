import assert from 'node:assert/strict';
import { test } from 'node:test';
import { devnetSnapshot } from '../devnet-diagnostics.mjs';

test('timeout snapshot tolerates offline services and does not echo error payloads', async () => {
  const snapshot = await devnetSnapshot('0x' + 'ab'.repeat(32), { fetcher: async () => { throw new Error('private-data-must-not-appear'); } });
  assert.equal(Object.values(snapshot).every(value => value.available === false), true);
  assert.equal(JSON.stringify(snapshot).includes('private-data'), false);
});

test('timeout snapshot distinguishes node/indexer heads and observes a submitted transaction', async () => {
  const snapshot = await devnetSnapshot('01' + 'ab'.repeat(32), { fetcher: async (url, request) => {
    if (!request?.body) return new Response('', { status: 404 });
    const body = JSON.parse(request.body);
    if (body.method === 'chain_getHeader') return Response.json({ result: { number: '0x42', hash: 'public-head', privateField: 'omit' } });
    if (body.method === 'chain_getFinalizedHead') return Response.json({ result: 'public-finalized' });
    if (body.variables) return Response.json({ data: { transactions: [{ hash: 'public-tx' }] } });
    return Response.json({ data: { block: { height: 65, hash: 'public-indexer' } } });
  } });
  assert.deepEqual(snapshot.nodeHead, { number: '0x42', hash: 'public-head' });
  assert.deepEqual(snapshot.transaction, { found: true });
  assert.equal(snapshot.indexerHead.height, 65);
  assert.equal(JSON.stringify(snapshot).includes('privateField'), false);
});
