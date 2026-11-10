import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBundleJson } from '../src/lib/bundle.ts';
import { hexToBytes } from '../src/lib/hex.ts';

test('UI rejects malformed bundle shapes and identifiers before rendering', () => {
  for (const value of [null, [], { vaccination: 'x' }, { labResult: [] }, { labResult: { testTypeId: 'bad' } }, { criticalFlags: {}, criticalFlagsSalt: 'z' }]) {
    assert.throws(() => parseBundleJson(JSON.stringify(value)));
  }
  const bundle = { labResult: { testTypeId: 'ab'.repeat(32) }, labResultSalt: 'cd'.repeat(32) };
  assert.deepEqual(parseBundleJson(JSON.stringify(bundle)), bundle);
});

test('browser hex decoder rejects truncation and nonhex digits', () => {
  for (const value of ['a','zz','12x4','0x1']) assert.throws(() => hexToBytes(value));
  assert.equal(hexToBytes('0X' + 'ab'.repeat(32)).length, 32);
});
