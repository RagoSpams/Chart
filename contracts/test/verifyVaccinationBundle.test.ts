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
import { defaultBundleArgs, issueDisclosureToken, submitRecordBundle, vaccinationData } from './fixtures.js';

const RECORD_ID = bytes32('RECORD-1');
const TOKEN_ID = bytes32('TOKEN-1');
const VACCINE_ID = bytes32('VACCINE-MMR');
const RECIPIENT_SECRET = bytes32('SPECIALIST-A');
const OTHER_RECIPIENT_SECRET = bytes32('SPECIALIST-B');

const institution = witnessesAsInstitution(bytes32('INSTITUTION-A'));
const recipient = witnessesAsRecipient(RECIPIENT_SECRET);

function verifyVaccination(
  env: TestEnv,
  contract = env.contract,
  args: {
    vaccination?: ReturnType<typeof vaccinationData>;
    vaccinationSalt?: Uint8Array;
    tokenId?: Uint8Array;
    recordId?: Uint8Array;
    requiredVaccineId?: Uint8Array;
  } = {},
) {
  const bundle = defaultBundleArgs();
  const { result, context } = contract.circuits.verifyVaccinationBundle(
    env.context,
    args.tokenId ?? TOKEN_ID,
    args.recordId ?? RECORD_ID,
    args.requiredVaccineId ?? VACCINE_ID,
    args.vaccination ?? bundle.vaccination,
    args.vaccinationSalt ?? bundle.vaccinationSalt,
  );
  env.context = context;
  return result;
}

describe('verifyVaccinationBundle', () => {
  let env: TestEnv;
  let specialistPubKey: Uint8Array;

  beforeEach(() => {
    env = deployForTest(institution);
    specialistPubKey = otherParty(env, witnessesAsRecipient(RECIPIENT_SECRET)).circuits.deriveRecipientPubKey(env.context).result;
    submitRecordBundle(env, RECORD_ID, defaultBundleArgs());
    issueDisclosureToken(env, {
      tokenId: TOKEN_ID,
      recordId: RECORD_ID,
      grantVaccination: true,
      grantLabResult: false,
      grantCriticalFlags: false,
      recipientPubKey: specialistPubKey,
    });
  });

  it('discloses true for a completed, non-overdue vaccination and a valid, in-scope token', () => {
    const asRecipient = otherParty(env, recipient);
    const pass = verifyVaccination(env, asRecipient);
    expect(pass).toBe(true);
  });

  it('discloses false (does not throw) when the vaccination is not marked completed', () => {
    const incomplete = vaccinationData({ completed: false });
    const freshRecordId = bytes32('RECORD-INCOMPLETE');
    const bundle = { ...defaultBundleArgs(), vaccination: incomplete };
    submitRecordBundle(env, freshRecordId, bundle);
    const freshTokenId = bytes32('TOKEN-2');
    issueDisclosureToken(env, { tokenId: freshTokenId, recordId: freshRecordId, recipientPubKey: specialistPubKey });

    const asRecipient = otherParty(env, recipient);
    const pass = verifyVaccination(env, asRecipient, {
      tokenId: freshTokenId,
      recordId: freshRecordId,
      vaccination: incomplete,
      vaccinationSalt: bundle.vaccinationSalt,
    });
    expect(pass).toBe(false);
  });

  it('discloses false (does not throw) when a next dose is already overdue', () => {
    const overdue = vaccinationData({ hasNextDose: true, nextDoseDate: DEFAULT_BLOCK_TIME - 1n });
    const freshRecordId = bytes32('RECORD-OVERDUE');
    const bundle = { ...defaultBundleArgs(), vaccination: overdue };
    submitRecordBundle(env, freshRecordId, bundle);
    const freshTokenId = bytes32('TOKEN-3');
    issueDisclosureToken(env, { tokenId: freshTokenId, recordId: freshRecordId, recipientPubKey: specialistPubKey });

    const asRecipient = otherParty(env, recipient);
    const pass = verifyVaccination(env, asRecipient, {
      tokenId: freshTokenId,
      recordId: freshRecordId,
      vaccination: overdue,
      vaccinationSalt: bundle.vaccinationSalt,
    });
    expect(pass).toBe(false);
  });

  it('fails (throws) on an expired token', () => {
    setBlockTime(env, DEFAULT_BLOCK_TIME + 10_000_000n); // well past the token's default expiry
    const asRecipient = otherParty(env, recipient);
    expect(() => verifyVaccination(env, asRecipient)).toThrow();
  });

  it('fails (throws) on a revoked token', () => {
    const { context } = env.contract.circuits.revokeToken(env.context, TOKEN_ID);
    env.context = context;

    const asRecipient = otherParty(env, recipient);
    expect(() => verifyVaccination(env, asRecipient)).toThrow();
  });

  it('fails (throws) when the token does not grant access to the Vaccination bundle', () => {
    const scopedOut = bytes32('TOKEN-NO-VACCINATION');
    issueDisclosureToken(env, {
      tokenId: scopedOut,
      recordId: RECORD_ID,
      grantVaccination: false,
      grantLabResult: true,
      recipientPubKey: specialistPubKey,
    });

    const asRecipient = otherParty(env, recipient);
    expect(() => verifyVaccination(env, asRecipient, { tokenId: scopedOut })).toThrow();
  });

  it('fails (throws) for the wrong recipientSecret', () => {
    const impostor = otherParty(env, witnessesAsRecipient(OTHER_RECIPIENT_SECRET));
    expect(() => verifyVaccination(env, impostor)).toThrow();
  });

  it('fails (throws) when the supplied vaccination data does not match the committed record (tampered data)', () => {
    const asRecipient = otherParty(env, recipient);
    const tampered = vaccinationData({ dose: 99n });
    expect(() => verifyVaccination(env, asRecipient, { vaccination: tampered })).toThrow();
  });

  it('fails (throws) when the supplied salt does not match (tampered salt)', () => {
    const asRecipient = otherParty(env, recipient);
    expect(() => verifyVaccination(env, asRecipient, { vaccinationSalt: bytes32('WRONG-SALT') })).toThrow();
  });

  it('fails (throws) when the requested vaccine does not match the committed bundle\'s vaccine', () => {
    const asRecipient = otherParty(env, recipient);
    expect(() => verifyVaccination(env, asRecipient, { requiredVaccineId: bytes32('VACCINE-YELLOW-FEVER') })).toThrow();
  });
});
