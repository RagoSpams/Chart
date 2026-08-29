import { beforeEach, describe, expect, it } from 'vitest';
import { bytes32, deployForTest, otherParty, witnessesAsInstitution, DEFAULT_BLOCK_TIME, type TestEnv } from './harness.js';
import { defaultBundleArgs, issueDisclosureToken, submitRecordBundle } from './fixtures.js';

const RECORD_ID = bytes32('RECORD-1');
const TOKEN_ID = bytes32('TOKEN-1');
const RECIPIENT_PUB_KEY = bytes32('RECIPIENT-1');
const EXPIRY_TIME = DEFAULT_BLOCK_TIME + 500_000n;

const institutionA = witnessesAsInstitution(bytes32('INSTITUTION-A'));
const institutionB = witnessesAsInstitution(bytes32('INSTITUTION-B'));

function issueToken(env: TestEnv) {
  issueDisclosureToken(env, {
    tokenId: TOKEN_ID,
    recordId: RECORD_ID,
    expiryTime: EXPIRY_TIME,
    recipientPubKey: RECIPIENT_PUB_KEY,
  });
}

function revoke(env: TestEnv, contract = env.contract, tokenId: Uint8Array = TOKEN_ID) {
  const { result, context } = contract.circuits.revokeToken(env.context, tokenId);
  env.context = context;
  return result;
}

describe('revokeToken', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = deployForTest(institutionA);
    submitRecordBundle(env, RECORD_ID, defaultBundleArgs());
    issueToken(env);
  });

  it('succeeds for the record\'s institution and marks the token revoked', () => {
    expect(env.getLedger().tokenRegistry.lookup(TOKEN_ID).revoked).toBe(false);

    revoke(env);

    expect(env.getLedger().tokenRegistry.lookup(TOKEN_ID).revoked).toBe(true);
  });

  it('leaves the rest of the token record untouched', () => {
    revoke(env);
    const token = env.getLedger().tokenRegistry.lookup(TOKEN_ID);
    expect(token.recordId).toEqual(RECORD_ID);
    expect(token.grantVaccination).toBe(true);
    expect(token.grantLabResult).toBe(true);
    expect(token.grantCriticalFlags).toBe(true);
    expect(token.expiryTime).toBe(EXPIRY_TIME);
    expect(token.recipientPubKey).toEqual(RECIPIENT_PUB_KEY);
  });

  it('fails when the token does not exist', () => {
    expect(() => revoke(env, env.contract, bytes32('NO-SUCH-TOKEN'))).toThrow();
  });

  it('fails when called by anyone other than the record\'s institution', () => {
    const impostor = otherParty(env, institutionB);
    expect(() => revoke(env, impostor)).toThrow();
    expect(env.getLedger().tokenRegistry.lookup(TOKEN_ID).revoked).toBe(false);
  });
});
