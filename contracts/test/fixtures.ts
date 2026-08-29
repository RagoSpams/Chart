// Shared sample data and circuit-call wrappers for gnuhealth_disclosure
// contract tests.

import { bytes32, DEFAULT_BLOCK_TIME, type TestEnv } from './harness.js';

export function vaccinationData(
  overrides: Partial<{
    vaccineId: Uint8Array;
    dose: bigint;
    administeredDate: bigint;
    hasNextDose: boolean;
    nextDoseDate: bigint;
    completed: boolean;
  }> = {},
) {
  return {
    vaccineId: bytes32('VACCINE-MMR'),
    dose: 2n,
    administeredDate: DEFAULT_BLOCK_TIME - 1_000n,
    hasNextDose: false,
    nextDoseDate: 0n,
    completed: true,
    ...overrides,
  };
}

export function labResultData(
  overrides: Partial<{
    testTypeId: Uint8Array;
    resultValue: bigint;
    rangeLow: bigint;
    rangeHigh: bigint;
    analysisDate: bigint;
  }> = {},
) {
  return {
    testTypeId: bytes32('TEST-LIVER-FUNCTION'),
    resultValue: 25n,
    rangeLow: 10n,
    rangeHigh: 40n,
    analysisDate: DEFAULT_BLOCK_TIME - 500n,
    ...overrides,
  };
}

// critAllergic defaults true, everything else false — gives happy-path tests
// both a "flag set" (index 2) and a "flag not set" (index 0) case from one
// fixture, without needing a second submission.
export function criticalFlagsData(
  overrides: Partial<{
    critDbt: boolean;
    critCardio: boolean;
    critAllergic: boolean;
    critCancer: boolean;
    critImmuno: boolean;
    critMental: boolean;
    critNutrition: boolean;
    critSocial: boolean;
    critCognitive: boolean;
  }> = {},
) {
  return {
    critDbt: false,
    critCardio: false,
    critAllergic: true,
    critCancer: false,
    critImmuno: false,
    critMental: false,
    critNutrition: false,
    critSocial: false,
    critCognitive: false,
    ...overrides,
  };
}

/** A full, valid set of submitRecordBundle bundle arguments (minus recordId), for reuse across tests. */
export function defaultBundleArgs() {
  return {
    vaccination: vaccinationData(),
    vaccinationSalt: bytes32('VACCINATION-SALT'),
    labResult: labResultData(),
    labResultSalt: bytes32('LABRESULT-SALT'),
    criticalFlags: criticalFlagsData(),
    criticalFlagsSalt: bytes32('CRITICALFLAGS-SALT'),
  };
}

export function submitRecordBundle(env: TestEnv, recordId: Uint8Array, args: ReturnType<typeof defaultBundleArgs>) {
  const { result, context } = env.contract.circuits.submitRecordBundle(
    env.context,
    recordId,
    args.vaccination,
    args.vaccinationSalt,
    args.labResult,
    args.labResultSalt,
    args.criticalFlags,
    args.criticalFlagsSalt,
  );
  env.context = context;
  return result;
}

export interface TokenGrant {
  tokenId: Uint8Array;
  recordId: Uint8Array;
  grantVaccination?: boolean;
  grantLabResult?: boolean;
  grantCriticalFlags?: boolean;
  expiryTime?: bigint;
  recipientPubKey: Uint8Array;
}

/** Defaults to full scope and an expiry far after DEFAULT_BLOCK_TIME. */
export function issueDisclosureToken(env: TestEnv, grant: TokenGrant) {
  const { result, context } = env.contract.circuits.issueDisclosureToken(
    env.context,
    grant.tokenId,
    grant.recordId,
    grant.grantVaccination ?? true,
    grant.grantLabResult ?? true,
    grant.grantCriticalFlags ?? true,
    grant.expiryTime ?? DEFAULT_BLOCK_TIME + 500_000n,
    grant.recipientPubKey,
  );
  env.context = context;
  return result;
}
