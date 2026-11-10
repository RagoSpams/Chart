// Public metadata only: no proof preimages, witnesses, wallet balances or secrets.
export async function devnetSnapshot(txId, { fetcher = fetch, node = 'http://127.0.0.1:9945', indexer = 'http://127.0.0.1:8089/api/v4/graphql', proof = 'http://127.0.0.1:6301' } = {}) {
  async function rpc(method) {
    const response = await fetcher(node, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params: [] }), signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    if (!response.ok || data.error || !data.result) throw new Error('RPC unavailable');
    return data.result;
  }
  const entries = await Promise.allSettled([
    rpc('chain_getHeader'), rpc('chain_getFinalizedHead'),
    (async () => {
      const response = await fetcher(indexer, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query { block { height hash } }' }), signal: AbortSignal.timeout(5000) });
      const data = await response.json();
      if (!response.ok || data.errors || !data.data?.block) throw new Error('Indexer head unavailable');
      return { height: data.data.block.height, hash: data.data.block.hash };
    })(),
    (async () => (await fetcher(proof, { signal: AbortSignal.timeout(5000) })).status)(),
    (async () => {
      if (!/^(?:[a-f0-9]{64}|[a-f0-9]{66}|0x[a-f0-9]{64})$/i.test(txId || '')) return null;
      const response = await fetcher(indexer, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query($offset: TransactionOffset!) { transactions(offset: $offset) { hash block { height } } }', variables: { offset: { identifier: txId } } }), signal: AbortSignal.timeout(5000) });
      const data = await response.json();
      if (!response.ok || data.errors) throw new Error('Transaction query unavailable');
      return { found: (data.data?.transactions?.length ?? 0) > 0 };
    })(),
  ]);
  return Object.fromEntries(entries.map((entry, index) => {
    const key = ['nodeHead', 'nodeFinalizedHash', 'indexerHead', 'proofHttpStatus', 'transaction'][index];
    if (entry.status === 'rejected') return [key, { available: false }];
    const value = index === 0 ? { number: entry.value.number, hash: entry.value.hash } : entry.value;
    return [key, value];
  }));
}
