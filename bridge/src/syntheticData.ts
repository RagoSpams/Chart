// Synthetic record-bundle data, constructed entirely in this bridge service
// for the isolated bridge-to-Midnight integration proof. Deliberately NOT
// pulled from a real GNU Health instance — Tryton integration is a separate,
// later step. Field shapes match contracts/src/gnuhealth_disclosure.compact
// exactly (same as contracts/test/fixtures.ts, kept independent since the
// bridge doesn't depend on the test-only contracts workspace).

export interface Vaccination {
  vaccineId: Uint8Array;
  dose: bigint;
  administeredDate: bigint;
  hasNextDose: boolean;
  nextDoseDate: bigint;
  completed: boolean;
}

export interface LabResult {
  testTypeId: Uint8Array;
  resultValue: bigint;
  rangeLow: bigint;
  rangeHigh: bigint;
  analysisDate: bigint;
}

export interface CriticalFlags {
  critDbt: boolean;
  critCardio: boolean;
  critAllergic: boolean;
  critCancer: boolean;
  critImmuno: boolean;
  critMental: boolean;
  critNutrition: boolean;
  critSocial: boolean;
  critCognitive: boolean;
}

export function bytes32(label: string): Uint8Array {
  const out = new Uint8Array(32);
  out.set(new TextEncoder().encode(label).slice(0, 32));
  return out;
}

export function randomBytes32(): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < out.length; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function fromHex(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

const nowSeconds = () => BigInt(Math.floor(Date.now() / 1000));

export function syntheticVaccination(overrides: Partial<Vaccination> = {}): Vaccination {
  return {
    vaccineId: bytes32('VACCINE-MMR'),
    dose: 2n,
    administeredDate: nowSeconds() - 1_000n,
    hasNextDose: false,
    nextDoseDate: 0n,
    completed: true,
    ...overrides,
  };
}

export function syntheticLabResult(overrides: Partial<LabResult> = {}): LabResult {
  return {
    testTypeId: bytes32('TEST-LIVER-FUNCTION'),
    resultValue: 25n,
    rangeLow: 10n,
    rangeHigh: 40n,
    analysisDate: nowSeconds() - 500n,
    ...overrides,
  };
}

export function syntheticCriticalFlags(overrides: Partial<CriticalFlags> = {}): CriticalFlags {
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

export interface RecordBundle {
  vaccination: Vaccination;
  vaccinationSalt: Uint8Array;
  labResult: LabResult;
  labResultSalt: Uint8Array;
  criticalFlags: CriticalFlags;
  criticalFlagsSalt: Uint8Array;
}

export function syntheticRecordBundle(overrides: Partial<RecordBundle> = {}): RecordBundle {
  return {
    vaccination: syntheticVaccination(),
    vaccinationSalt: randomBytes32(),
    labResult: syntheticLabResult(),
    labResultSalt: randomBytes32(),
    criticalFlags: syntheticCriticalFlags(),
    criticalFlagsSalt: randomBytes32(),
    ...overrides,
  };
}

// In-memory store: recordId(hex) -> the synthetic bundle data submitted for
// it. Stands in for the out-of-band data-sharing an institution would do
// with a recipient in a real flow (see gnuhealth_disclosure.compact's
// verify*Bundle comment) — here the bridge plays both roles, so it just
// keeps what it submitted so /verify can re-supply matching data.
const recordBundles = new Map<string, RecordBundle>();

export function rememberRecordBundle(recordIdHex: string, bundle: RecordBundle): void {
  recordBundles.set(recordIdHex, bundle);
}

export function getRecordBundle(recordIdHex: string): RecordBundle | undefined {
  return recordBundles.get(recordIdHex);
}
