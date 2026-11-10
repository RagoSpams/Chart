import { beforeEach, describe, expect, it } from 'vitest';
import { bytes32, deployForTest, witnessesAsInstitution, type TestEnv } from './harness.js';
import { defaultBundleArgs, vaccinationData, submitRecordBundle as submit } from './fixtures.js';

describe('submitRecordBundle', () => {
  let env: TestEnv;
  const institutionA = witnessesAsInstitution(bytes32('INSTITUTION-A'));

  beforeEach(() => {
    env = deployForTest(institutionA);
  });

  it('rejects an inverted laboratory reference range', () => {
    const bundle = defaultBundleArgs();
    bundle.labResult.rangeLow = 50n;
    expect(() => submit(env, bytes32('BAD-RANGE'), bundle)).toThrow(/reference range/);
  });

  it('registers a new record with withdrawn = false', () => {
    const recordId = bytes32('RECORD-1');
    expect(env.getLedger().recordRegistry.member(recordId)).toBe(false);

    submit(env, recordId, defaultBundleArgs());

    expect(env.getLedger().recordRegistry.member(recordId)).toBe(true);
    expect(env.getLedger().recordRegistry.lookup(recordId).withdrawn).toBe(false);
  });

  it('stores non-empty commitments for all three bundles', () => {
    const recordId = bytes32('RECORD-1');
    submit(env, recordId, defaultBundleArgs());

    const record = env.getLedger().recordRegistry.lookup(recordId);
    for (const field of ['vaccinationCommit', 'labResultCommit', 'criticalFlagsCommit'] as const) {
      expect(record[field]).toBeInstanceOf(Uint8Array);
      expect(record[field].length).toBe(32);
      expect(record[field].some((b) => b !== 0)).toBe(true);
    }
  });

  it('rejects a second submission with the same recordId', () => {
    const recordId = bytes32('RECORD-1');
    submit(env, recordId, defaultBundleArgs());

    expect(() => submit(env, recordId, defaultBundleArgs())).toThrow();
  });

  it('allows the same institution to submit multiple distinct records', () => {
    submit(env, bytes32('RECORD-1'), defaultBundleArgs());
    submit(env, bytes32('RECORD-2'), defaultBundleArgs());

    expect(env.getLedger().recordRegistry.member(bytes32('RECORD-1'))).toBe(true);
    expect(env.getLedger().recordRegistry.member(bytes32('RECORD-2'))).toBe(true);
    expect(env.getLedger().recordRegistry.size()).toBe(2n);
  });

  it('derives the same institutionId for the same secret across different records', () => {
    submit(env, bytes32('RECORD-1'), defaultBundleArgs());
    submit(env, bytes32('RECORD-2'), defaultBundleArgs());

    const a = env.getLedger().recordRegistry.lookup(bytes32('RECORD-1'));
    const b = env.getLedger().recordRegistry.lookup(bytes32('RECORD-2'));
    expect(a.institutionId).toEqual(b.institutionId);
  });

  it('derives a different institutionId for a different secret', () => {
    submit(env, bytes32('RECORD-1'), defaultBundleArgs());

    const envB = deployForTest(witnessesAsInstitution(bytes32('INSTITUTION-B')));
    submit(envB, bytes32('RECORD-1'), defaultBundleArgs());

    const a = env.getLedger().recordRegistry.lookup(bytes32('RECORD-1'));
    const b = envB.getLedger().recordRegistry.lookup(bytes32('RECORD-1'));
    expect(a.institutionId).not.toEqual(b.institutionId);
  });

  it('reproduces the same commitment for identical bundle data and salt', () => {
    const args = defaultBundleArgs();
    submit(env, bytes32('RECORD-1'), args);
    submit(env, bytes32('RECORD-2'), args);

    const a = env.getLedger().recordRegistry.lookup(bytes32('RECORD-1'));
    const b = env.getLedger().recordRegistry.lookup(bytes32('RECORD-2'));
    expect(a.vaccinationCommit).toEqual(b.vaccinationCommit);
    expect(a.labResultCommit).toEqual(b.labResultCommit);
    expect(a.criticalFlagsCommit).toEqual(b.criticalFlagsCommit);
  });

  it('changes vaccinationCommit when the vaccination data changes, and nothing else', () => {
    const base = defaultBundleArgs();
    submit(env, bytes32('RECORD-1'), base);

    const changed = defaultBundleArgs();
    changed.vaccination = vaccinationData({ vaccineId: bytes32('VACCINE-DIFFERENT') });
    submit(env, bytes32('RECORD-2'), changed);

    const a = env.getLedger().recordRegistry.lookup(bytes32('RECORD-1'));
    const b = env.getLedger().recordRegistry.lookup(bytes32('RECORD-2'));
    expect(a.vaccinationCommit).not.toEqual(b.vaccinationCommit);
    expect(a.labResultCommit).toEqual(b.labResultCommit);
    expect(a.criticalFlagsCommit).toEqual(b.criticalFlagsCommit);
  });

  it('changes a commitment when only its salt changes (binding property)', () => {
    const base = defaultBundleArgs();
    submit(env, bytes32('RECORD-1'), base);

    const resalted = defaultBundleArgs();
    resalted.labResultSalt = bytes32('DIFFERENT-LABRESULT-SALT');
    submit(env, bytes32('RECORD-2'), resalted);

    const a = env.getLedger().recordRegistry.lookup(bytes32('RECORD-1'));
    const b = env.getLedger().recordRegistry.lookup(bytes32('RECORD-2'));
    expect(a.labResultCommit).not.toEqual(b.labResultCommit);
    expect(a.vaccinationCommit).toEqual(b.vaccinationCommit);
  });
});
