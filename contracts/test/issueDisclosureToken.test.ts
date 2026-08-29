import { beforeEach, describe, expect, it } from 'vitest';
import { bytes32, deployForTest, otherParty, witnessesAsInstitution, DEFAULT_BLOCK_TIME, type TestEnv } from './harness.js';
import { defaultBundleArgs, submitRecordBundle, type TokenGrant } from './fixtures.js';

const RECORD_ID = bytes32('RECORD-1');
const TOKEN_ID = bytes32('TOKEN-1');
const RECIPIENT_PUB_KEY = bytes32('RECIPIENT-1');
const EXPIRY_TIME = DEFAULT_BLOCK_TIME + 500_000n;

const institutionA = witnessesAsInstitution(bytes32('INSTITUTION-A'));
const institutionB = witnessesAsInstitution(bytes32('INSTITUTION-B'));

function issueToken(env: TestEnv, contract = env.contract, overrides: Partial<TokenGrant> = {}) {
  const { result, context } = contract.circuits.issueDisclosureToken(
    env.context,
    overrides.tokenId ?? TOKEN_ID,
    overrides.recordId ?? RECORD_ID,
    overrides.grantVaccination ?? true,
    overrides.grantLabResult ?? true,
    overrides.grantCriticalFlags ?? false,
    overrides.expiryTime ?? EXPIRY_TIME,
    overrides.recipientPubKey ?? RECIPIENT_PUB_KEY,
  );
  env.context = context;
  return result;
}

describe('issueDisclosureToken', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = deployForTest(institutionA);
    submitRecordBundle(env, RECORD_ID, defaultBundleArgs());
  });

  it('succeeds for the record\'s own institution and stores the token', () => {
    expect(env.getLedger().tokenRegistry.member(TOKEN_ID)).toBe(false);

    issueToken(env);

    expect(env.getLedger().tokenRegistry.member(TOKEN_ID)).toBe(true);
    const token = env.getLedger().tokenRegistry.lookup(TOKEN_ID);
    expect(token.recordId).toEqual(RECORD_ID);
    expect(token.grantVaccination).toBe(true);
    expect(token.grantLabResult).toBe(true);
    expect(token.grantCriticalFlags).toBe(false);
    expect(token.expiryTime).toBe(EXPIRY_TIME);
    expect(token.recipientPubKey).toEqual(RECIPIENT_PUB_KEY);
    expect(token.revoked).toBe(false);
  });

  it('fails when the record does not exist', () => {
    expect(() => issueToken(env, env.contract, { recordId: bytes32('NO-SUCH-RECORD') })).toThrow();
  });

  it('fails when called by anyone other than the record\'s institution', () => {
    const impostor = otherParty(env, institutionB);
    expect(() => issueToken(env, impostor)).toThrow();
    expect(env.getLedger().tokenRegistry.member(TOKEN_ID)).toBe(false);
  });

  it('fails once the record has been withdrawn', () => {
    const { context } = env.contract.circuits.withdrawRecordBundle(env.context, RECORD_ID);
    env.context = context;

    expect(() => issueToken(env)).toThrow();
  });

  it('fails on a duplicate tokenId', () => {
    issueToken(env);
    expect(() => issueToken(env)).toThrow();
  });

  it('fails when no bundle is granted', () => {
    expect(() =>
      issueToken(env, env.contract, { grantVaccination: false, grantLabResult: false, grantCriticalFlags: false }),
    ).toThrow();
  });
});
