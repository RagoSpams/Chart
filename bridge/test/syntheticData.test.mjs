import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromHex, randomBytes32, rememberRecordBundle, getRecordBundle, syntheticRecordBundle } from '../src/syntheticData.ts';

test('random IDs and salts use 32 bytes of randomness', () => {
  const a = randomBytes32();
  const b = randomBytes32();
  assert.equal(a.length, 32);
  assert.notDeepEqual(a, b);
});

test('hex decoding accepts valid 32-byte strings and rejects malformed input', () => {
  assert.equal(fromHex('0x' + 'ab'.repeat(32)).length, 32);
  for (const invalid of ['', 'ab', 'xx'.repeat(32), 'ab'.repeat(31) + 'z0', 'ab'.repeat(33), 'a'.repeat(63)]) {
    assert.throws(() => fromHex(invalid), /exactly 32 bytes/);
  }
});

test('record IDs normalize case and optional 0x prefix for lookup', () => {
  const bundle = syntheticRecordBundle();
  rememberRecordBundle('AB'.repeat(32), bundle);
  assert.equal(getRecordBundle('0x' + 'ab'.repeat(32)), bundle);
});
