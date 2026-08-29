import { beforeEach, describe, expect, it } from 'vitest';
import {
  bytes32,
  deployForTest,
  otherParty,
  setBlockTime,
  witnessesAsInstitution,
  witnessesAsRecipient,
  DEFAULT_BLOCK_TIME,
  type TestEnv,
} from './harness.js';
import { criticalFlagsData, defaultBundleArgs, issueDisclosureToken, submitRecordBundle } from './fixtures.js';

const RECORD_ID = bytes32('RECORD-1');
const TOKEN_ID = bytes32('TOKEN-1');
const RECIPIENT_SECRET = bytes32('TRIAL-RECRUITER-A');
const OTHER_RECIPIENT_SECRET = bytes32('TRIAL-RECRUITER-B');

// Index positions matching the contract's if/else-if chain: 0=critDbt,
// 1=critCardio, 2=critAllergic, 3=critCancer, 4=critImmuno, 5=critMental,
// 6=critNutrition, 7=critSocial, 8=critCognitive.
const FLAG_DBT = 0n;
const FLAG_ALLERGIC = 2n;

const institution = witnessesAsInstitution(bytes32('INSTITUTION-A'));
const recipient = witnessesAsRecipient(RECIPIENT_SECRET);

function verifyCriticalFlags(
  env: TestEnv,
  contract = env.contract,
  args: {
    criticalFlags?: ReturnType<typeof criticalFlagsData>;
    criticalFlagsSalt?: Uint8Array;
    tokenId?: Uint8Array;
    recordId?: Uint8Array;
    requestedFlag?: bigint;
  } = {},
) {
  const bundle = defaultBundleArgs();
  const { result, context } = contract.circuits.verifyCriticalFlagsBundle(
    env.context,
    args.tokenId ?? TOKEN_ID,
    args.recordId ?? RECORD_ID,
    args.criticalFlags ?? bundle.criticalFlags,
    args.criticalFlagsSalt ?? bundle.criticalFlagsSalt,
    args.requestedFlag ?? FLAG_ALLERGIC,
  );
  env.context = context;
  return result;
}

describe('verifyCriticalFlagsBundle', () => {
  let env: TestEnv;
  let recruiterPubKey: Uint8Array;

  beforeEach(() => {
    env = deployForTest(institution);
    recruiterPubKey = otherParty(env, witnessesAsRecipient(RECIPIENT_SECRET)).circuits.deriveRecipientPubKey(env.context).result;
    submitRecordBundle(env, RECORD_ID, defaultBundleArgs());
    issueDisclosureToken(env, {
      tokenId: TOKEN_ID,
      recordId: RECORD_ID,
      grantVaccination: false,
      grantLabResult: false,
      grantCriticalFlags: true,
      recipientPubKey: recruiterPubKey,
    });
  });

  it('discloses true for a requested flag that is set (critAllergic, default fixture)', () => {
    const asRecipient = otherParty(env, recipient);
    const pass = verifyCriticalFlags(env, asRecipient, { requestedFlag: FLAG_ALLERGIC });
    expect(pass).toBe(true);
  });

  it('discloses false (does not throw) for a requested flag that is not set (critDbt, default fixture)', () => {
    const asRecipient = otherParty(env, recipient);
    const pass = verifyCriticalFlags(env, asRecipient, { requestedFlag: FLAG_DBT });
    expect(pass).toBe(false);
  });

  it('selects each of the nine flags correctly, independent of the others', () => {
    const flags = criticalFlagsData({
      critDbt: true,
      critCardio: false,
      critAllergic: true,
      critCancer: false,
      critImmuno: true,
      critMental: false,
      critNutrition: true,
      critSocial: false,
      critCognitive: true,
    });
    const freshRecordId = bytes32('RECORD-MIXED-FLAGS');
    const bundle = { ...defaultBundleArgs(), criticalFlags: flags };
    submitRecordBundle(env, freshRecordId, bundle);
    const freshTokenId = bytes32('TOKEN-MIXED');
    issueDisclosureToken(env, {
      tokenId: freshTokenId,
      recordId: freshRecordId,
      grantCriticalFlags: true,
      recipientPubKey: recruiterPubKey,
    });

    const expected = [true, false, true, false, true, false, true, false, true];
    for (let i = 0; i < expected.length; i++) {
      const asRecipient = otherParty(env, recipient);
      const pass = verifyCriticalFlags(env, asRecipient, {
        tokenId: freshTokenId,
        recordId: freshRecordId,
        criticalFlags: flags,
        criticalFlagsSalt: bundle.criticalFlagsSalt,
        requestedFlag: BigInt(i),
      });
      expect(pass).toBe(expected[i]);
    }
  });

  it('fails (throws) when requestedFlag is out of range (9 and above)', () => {
    const asRecipient = otherParty(env, recipient);
    expect(() => verifyCriticalFlags(env, asRecipient, { requestedFlag: 9n })).toThrow();
    expect(() => verifyCriticalFlags(env, otherParty(env, recipient), { requestedFlag: 255n })).toThrow();
  });

  it('fails (throws) on an expired token', () => {
    setBlockTime(env, DEFAULT_BLOCK_TIME + 10_000_000n); // well past the token's default expiry
    const asRecipient = otherParty(env, recipient);
    expect(() => verifyCriticalFlags(env, asRecipient)).toThrow();
  });

  it('fails (throws) on a revoked token', () => {
    const { context } = env.contract.circuits.revokeToken(env.context, TOKEN_ID);
    env.context = context;

    const asRecipient = otherParty(env, recipient);
    expect(() => verifyCriticalFlags(env, asRecipient)).toThrow();
  });

  it('fails (throws) when the token does not grant access to the CriticalFlags bundle', () => {
    const scopedOut = bytes32('TOKEN-NO-CRITICALFLAGS');
    issueDisclosureToken(env, {
      tokenId: scopedOut,
      recordId: RECORD_ID,
      grantVaccination: true,
      grantCriticalFlags: false,
      recipientPubKey: recruiterPubKey,
    });

    const asRecipient = otherParty(env, recipient);
    expect(() => verifyCriticalFlags(env, asRecipient, { tokenId: scopedOut })).toThrow();
  });

  it('fails (throws) for the wrong recipientSecret', () => {
    const impostor = otherParty(env, witnessesAsRecipient(OTHER_RECIPIENT_SECRET));
    expect(() => verifyCriticalFlags(env, impostor)).toThrow();
  });

  it('fails (throws) when the supplied critical-flags data does not match the committed record (tampered data)', () => {
    const asRecipient = otherParty(env, recipient);
    const tampered = criticalFlagsData({ critCancer: true });
    expect(() => verifyCriticalFlags(env, asRecipient, { criticalFlags: tampered })).toThrow();
  });

  it('fails (throws) when the supplied salt does not match (tampered salt)', () => {
    const asRecipient = otherParty(env, recipient);
    expect(() => verifyCriticalFlags(env, asRecipient, { criticalFlagsSalt: bytes32('WRONG-SALT') })).toThrow();
  });
});
