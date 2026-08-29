// Thin HTTP client for verifier-server — the ONLY thing this app talks to.
// No import from bridge/ or contracts/, no shared process, no shared
// identity: this is the real separation boundary the whole verifier app
// exists to demonstrate (see verifier/server/src/midnight.ts's header
// comment for the matching server-side half of this design).

const DEFAULT_SERVER_URL = 'http://localhost:4200';

export function getServerUrl(): string {
  return localStorage.getItem('gnuhealth-midnight:verifier:serverUrl') || DEFAULT_SERVER_URL;
}

export function setServerUrl(url: string): void {
  localStorage.setItem('gnuhealth-midnight:verifier:serverUrl', url);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getServerUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || json.error || `${path} failed (${res.status})`);
  return json as T;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getServerUrl()}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function derivePubKey(recipientSecretHex: string): Promise<string> {
  const { recipientPubKey } = await postJson<{ recipientPubKey: string }>('/derive-pubkey', {
    recipientSecret: recipientSecretHex,
  });
  return recipientPubKey;
}

export interface VaccinationBundle {
  vaccineId: string;
  dose: string;
  administeredDate: string;
  hasNextDose: boolean;
  nextDoseDate: string;
  completed: boolean;
}

export interface LabResultBundle {
  testTypeId: string;
  resultValue: string;
  rangeLow: string;
  rangeHigh: string;
  analysisDate: string;
}

export interface CriticalFlagsBundle {
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

export type VerifyArgs =
  | {
      category: 'vaccination';
      contractAddress: string;
      recipientSecret: string;
      tokenId: string;
      recordId: string;
      vaccination: VaccinationBundle;
      vaccinationSalt: string;
    }
  | {
      category: 'labResult';
      contractAddress: string;
      recipientSecret: string;
      tokenId: string;
      recordId: string;
      labResult: LabResultBundle;
      labResultSalt: string;
    }
  | {
      category: 'criticalFlags';
      contractAddress: string;
      recipientSecret: string;
      tokenId: string;
      recordId: string;
      criticalFlags: CriticalFlagsBundle;
      criticalFlagsSalt: string;
      requestedFlag: string;
    };

export interface VerifyResponse {
  category: string;
  pass: boolean;
  tx: unknown;
}

export async function verify(args: VerifyArgs): Promise<VerifyResponse> {
  return postJson<VerifyResponse>('/verify', args);
}

export interface RecordStatus {
  exists: boolean;
  withdrawn: boolean;
}

export async function recordStatus(contractAddress: string, recordId: string): Promise<RecordStatus> {
  const url = `${getServerUrl()}/record-status?contractAddress=${encodeURIComponent(contractAddress)}&recordId=${encodeURIComponent(recordId)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || json.error || `record-status failed (${res.status})`);
  return json as RecordStatus;
}
