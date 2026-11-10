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
import { defaultBundleArgs, issueDisclosureToken, labResultData, submitRecordBundle } from './fixtures.js';

const RECORD_ID = bytes32('RECORD-1');
const TOKEN_ID = bytes32('TOKEN-1');
const TEST_TYPE_ID = bytes32('TEST-LIVER-FUNCTION');
const RECIPIENT_SECRET = bytes32('INSURER-A');
const OTHER_RECIPIENT_SECRET = bytes32('INSURER-B');

const institution = witnessesAsInstitution(bytes32('INSTITUTION-A'));
const recipient = witnessesAsRecipient(RECIPIENT_SECRET);

function verifyLabResult(
  env: TestEnv,
  contract = env.contract,
  args: {
    labResult?: ReturnType<typeof labResultData>;
    labResultSalt?: Uint8Array;
    tokenId?: Uint8Array;
    recordId?: Uint8Array;
    requiredTestTypeId?: Uint8Array;
  } = {},
) {
  const bundle = defaultBundleArgs();
  const { result, context } = contract.circuits.verifyLabResultBundle(
    env.context,
    args.tokenId ?? TOKEN_ID,
    args.recordId ?? RECORD_ID,
    args.requiredTestTypeId ?? TEST_TYPE_ID,
    args.labResult ?? bundle.labResult,
    args.labResultSalt ?? bundle.labResultSalt,
  );
  env.context = context;
  return result;
}

describe('verifyLabResultBundle', () => {
  let env: TestEnv;
  let insurerPubKey: Uint8Array;

  beforeEach(() => {
    env = deployForTest(institution);
    insurerPubKey = otherParty(env, witnessesAsRecipient(RECIPIENT_SECRET)).circuits.deriveRecipientPubKey(env.context).result;
    submitRecordBundle(env, RECORD_ID, defaultBundleArgs());
    issueDisclosureToken(env, {
      tokenId: TOKEN_ID,
      recordId: RECORD_ID,
      grantVaccination: false,
      grantLabResult: true,
      grantCriticalFlags: false,
      recipientPubKey: insurerPubKey,
    });
  });

  it('discloses true when the result is within the reference range', () => {
    const bundle = defaultBundleArgs(); // resultValue 25 within [10, 40]
    const asRecipient = otherParty(env, recipient);
    const pass = verifyLabResult(env, asRecipient, { labResult: bundle.labResult, labResultSalt: bundle.labResultSalt });
    expect(pass).toBe(true);
  });

  it('discloses false (does not throw) when the result is outside the reference range', () => {
    const outOfRange = labResultData({ resultValue: 999n });
    const freshRecordId = bytes32('RECORD-ABNORMAL');
    const bundle = { ...defaultBundleArgs(), labResult: outOfRange };
    submitRecordBundle(env, freshRecordId, bundle);
    const freshTokenId = bytes32('TOKEN-2');
    issueDisclosureToken(env, { tokenId: freshTokenId, recordId: freshRecordId, recipientPubKey: insurerPubKey });

    const asRecipient = otherParty(env, recipient);
    const pass = verifyLabResult(env, asRecipient, {
      tokenId: freshTokenId,
      recordId: freshRecordId,
      labResult: outOfRange,
      labResultSalt: bundle.labResultSalt,
    });
    expect(pass).toBe(false);
  });

  it('fails (throws) on an expired token', () => {
    setBlockTime(env, DEFAULT_BLOCK_TIME + 10_000_000n); // well past the token's default expiry
    const asRecipient = otherParty(env, recipient);
    expect(() => verifyLabResult(env, asRecipient)).toThrow();
  });

  it('rejects previously issued tokens after the source record is withdrawn', () => {
    const { context } = env.contract.circuits.withdrawRecordBundle(env.context, RECORD_ID);
    env.context = context;
    const asRecipient = otherParty(env, recipient);
    expect(() => verifyLabResult(env, asRecipient)).toThrow();
  });

  it('rejects a token at its exact expiry boundary', () => {
    setBlockTime(env, DEFAULT_BLOCK_TIME + 500_000n);
    expect(() => verifyLabResult(env, otherParty(env, recipient))).toThrow();
  });

  it('returns false for a missing laboratory observation placeholder', () => {
    const recordId = bytes32('NO-LAB');
    const bundle = { ...defaultBundleArgs(), labResult: labResultData({ resultValue: 0n, rangeLow: 0n, rangeHigh: 0n, analysisDate: 0n }) };
    submitRecordBundle(env, recordId, bundle);
    const tokenId = bytes32('NO-LAB-TOKEN');
    issueDisclosureToken(env, { tokenId, recordId, recipientPubKey: insurerPubKey });
    expect(verifyLabResult(env, otherParty(env, recipient), { recordId, tokenId, labResult: bundle.labResult })).toBe(false);
  });

  it('fails (throws) on a revoked token', () => {
    const { context } = env.contract.circuits.revokeToken(env.context, TOKEN_ID);
    env.context = context;

    const asRecipient = otherParty(env, recipient);
    expect(() => verifyLabResult(env, asRecipient)).toThrow();
  });

  it('fails (throws) when the token does not grant access to the LabResult bundle', () => {
    const scopedOut = bytes32('TOKEN-NO-LABRESULT');
    issueDisclosureToken(env, {
      tokenId: scopedOut,
      recordId: RECORD_ID,
      grantVaccination: true,
      grantLabResult: false,
      recipientPubKey: insurerPubKey,
    });

    const asRecipient = otherParty(env, recipient);
    expect(() => verifyLabResult(env, asRecipient, { tokenId: scopedOut })).toThrow();
  });

  it('fails (throws) for the wrong recipientSecret', () => {
    const impostor = otherParty(env, witnessesAsRecipient(OTHER_RECIPIENT_SECRET));
    expect(() => verifyLabResult(env, impostor)).toThrow();
  });

  it('fails (throws) when the supplied lab result data does not match the committed record (tampered data)', () => {
    const asRecipient = otherParty(env, recipient);
    const tampered = labResultData({ resultValue: 26n });
    expect(() => verifyLabResult(env, asRecipient, { labResult: tampered })).toThrow();
  });

  it('fails (throws) when the supplied salt does not match (tampered salt)', () => {
    const asRecipient = otherParty(env, recipient);
    expect(() => verifyLabResult(env, asRecipient, { labResultSalt: bytes32('WRONG-SALT') })).toThrow();
  });

  it('fails (throws) when the requested test type does not match the committed bundle\'s test type', () => {
    const asRecipient = otherParty(env, recipient);
    expect(() => verifyLabResult(env, asRecipient, { requiredTestTypeId: bytes32('TEST-STOOL-EXAM') })).toThrow();
  });
});
