import assert from 'node:assert/strict';
import { test } from 'node:test';
import { StateValue as DirectStateValue } from '@midnight-ntwrk/onchain-runtime-v3';
import { StateValue as ProtocolStateValue } from '@midnight-ntwrk/midnight-js-protocol/onchain-runtime';

test('contract and SDK share one WASM StateValue class', () => {
  assert.equal(DirectStateValue, ProtocolStateValue, 'Duplicate WASM runtimes break real transactions even when circuit unit tests pass');
});
