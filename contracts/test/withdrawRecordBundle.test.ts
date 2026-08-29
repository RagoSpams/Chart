import { beforeEach, describe, expect, it } from 'vitest';
import { bytes32, deployForTest, otherParty, witnessesAsInstitution, type TestEnv } from './harness.js';
import { defaultBundleArgs, submitRecordBundle } from './fixtures.js';

const RECORD_ID = bytes32('RECORD-1');

const institutionA = witnessesAsInstitution(bytes32('INSTITUTION-A'));
const institutionB = witnessesAsInstitution(bytes32('INSTITUTION-B'));

function withdraw(env: TestEnv, contract = env.contract, recordId: Uint8Array = RECORD_ID) {
  const { result, context } = contract.circuits.withdrawRecordBundle(env.context, recordId);
  env.context = context;
  return result;
}

describe('withdrawRecordBundle', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = deployForTest(institutionA);
    submitRecordBundle(env, RECORD_ID, defaultBundleArgs());
  });

  it('succeeds for the record\'s institution and sets withdrawn = true', () => {
    expect(env.getLedger().recordRegistry.lookup(RECORD_ID).withdrawn).toBe(false);

    withdraw(env);

    expect(env.getLedger().recordRegistry.lookup(RECORD_ID).withdrawn).toBe(true);
  });

  it('leaves the commitments and institutionId untouched', () => {
    const before = env.getLedger().recordRegistry.lookup(RECORD_ID);
    withdraw(env);
    const after = env.getLedger().recordRegistry.lookup(RECORD_ID);

    expect(after.institutionId).toEqual(before.institutionId);
    expect(after.vaccinationCommit).toEqual(before.vaccinationCommit);
    expect(after.labResultCommit).toEqual(before.labResultCommit);
    expect(after.criticalFlagsCommit).toEqual(before.criticalFlagsCommit);
  });

  it('fails when the record does not exist', () => {
    expect(() => withdraw(env, env.contract, bytes32('NO-SUCH-RECORD'))).toThrow();
  });

  it('fails when called by anyone other than the record\'s institution', () => {
    const impostor = otherParty(env, institutionB);
    expect(() => withdraw(env, impostor)).toThrow();
    expect(env.getLedger().recordRegistry.lookup(RECORD_ID).withdrawn).toBe(false);
  });
});
