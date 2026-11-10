import express from 'express';
import type { FinalizedTxData } from '@midnight-ntwrk/midnight-js-types';

import type { GnuhealthDisclosureClient } from './midnight.js';
import { apiSecurity, validateBridgeBody, jsonError } from './security.js';
import {
  fromHex,
  getRecordBundle,
  randomBytes32,
  rememberRecordBundle,
  syntheticCriticalFlags,
  syntheticLabResult,
  syntheticVaccination,
  toHex,
  type CriticalFlags,
  type LabResult,
  type Vaccination,
} from './syntheticData.js';

export function createApp(options: { apiKey?: string; allowRawExport?: boolean; deploy?: () => Promise<GnuhealthDisclosureClient> } = {}) {
const app = express();
app.disable('x-powered-by');
app.use(apiSecurity(options.apiKey ?? process.env.CHART_BRIDGE_API_KEY));
app.use(express.json({ limit: '64kb' }));
app.use(validateBridgeBody);

const ALLOW_RAW_BUNDLE_EXPORT = options.allowRawExport ?? (process.env.CHART_ALLOW_RAW_BUNDLE_EXPORT === 'true');

function requiredBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`);
  return value;
}

function uint(value: unknown, name: string, bits: number): bigint {
  if (typeof value !== 'string' && (typeof value !== 'number' || !Number.isSafeInteger(value))) {
    throw new Error(`${name} must be an integer or decimal integer string`);
  }
  if (!/^(0|[1-9][0-9]*)$/.test(String(value))) throw new Error(`${name} must be an unsigned decimal integer`);
  const result = BigInt(value);
  if (result >= (1n << BigInt(bits))) throw new Error(`${name} exceeds Uint<${bits}>`);
  return result;
}

function inputError(res: import('express').Response, err: unknown, operation: string): void {
  if (err instanceof Error && /^(Expected exactly|.* must be |.* exceeds Uint)/.test(err.message)) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error(`[bridge] ${operation} failed`);
  if (process.env.CHART_DEBUG_SYNTHETIC === 'true') console.error(String(err).replace(/[a-f0-9]{64}/gi, '[redacted]').slice(0, 2000));
  res.status(500).json({ error: `${operation} failed` });
}


// Health check — proves this service is reachable over HTTP from outside.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: '@gnuhealth-midnight/bridge' });
});

// --- Lazy, cached deployment of the real contract to the local devnet ----
// First request pays the cost (wallet sync + DUST registration + deploy);
// every request after reuses the same deployed contract. On failure the
// cache is cleared so the next request retries from scratch rather than
// permanently wedging the service on a transient error.
let clientPromise: Promise<GnuhealthDisclosureClient> | null = null;
function getClient(): Promise<GnuhealthDisclosureClient> {
  if (!clientPromise) {
    clientPromise = (options.deploy ? options.deploy() : import('./midnight.js').then(m => m.GnuhealthDisclosureClient.deploy())).catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

function serializeTx(tx: FinalizedTxData | unknown) {
  return JSON.parse(
    JSON.stringify(tx, (_key, value) => {
      if (typeof value === 'bigint') return value.toString();
      if (value instanceof Uint8Array) return toHex(value);
      return value;
    }),
  );
}

function parseVaccinationOverrides(body: Record<string, unknown> | undefined): Partial<Vaccination> {
  if (!body) return {};
  const v: Partial<Vaccination> = {};
  if (typeof body.vaccineId === 'string') v.vaccineId = fromHex(body.vaccineId);
  if (body.dose !== undefined) v.dose = uint(body.dose, 'dose', 16);
  if (body.administeredDate !== undefined) v.administeredDate = uint(body.administeredDate, 'administeredDate', 64);
  if (body.hasNextDose !== undefined) v.hasNextDose = requiredBoolean(body.hasNextDose, 'hasNextDose');
  if (body.nextDoseDate !== undefined) v.nextDoseDate = uint(body.nextDoseDate, 'nextDoseDate', 64);
  if (body.completed !== undefined) v.completed = requiredBoolean(body.completed, 'completed');
  return v;
}

function parseLabResultOverrides(body: Record<string, unknown> | undefined): Partial<LabResult> {
  if (!body) return {};
  const l: Partial<LabResult> = {};
  if (typeof body.testTypeId === 'string') l.testTypeId = fromHex(body.testTypeId);
  if (body.resultValue !== undefined) l.resultValue = uint(body.resultValue, 'resultValue', 32);
  if (body.rangeLow !== undefined) l.rangeLow = uint(body.rangeLow, 'rangeLow', 32);
  if (body.rangeHigh !== undefined) l.rangeHigh = uint(body.rangeHigh, 'rangeHigh', 32);
  if (body.analysisDate !== undefined) l.analysisDate = uint(body.analysisDate, 'analysisDate', 64);
  return l;
}

const CRIT_FLAG_KEYS = [
  'critDbt',
  'critCardio',
  'critAllergic',
  'critCancer',
  'critImmuno',
  'critMental',
  'critNutrition',
  'critSocial',
  'critCognitive',
] as const;

function parseCriticalFlagsOverrides(body: Record<string, unknown> | undefined): Partial<CriticalFlags> {
  if (!body) return {};
  const c: Partial<CriticalFlags> = {};
  for (const key of CRIT_FLAG_KEYS) {
    if (body[key] !== undefined) c[key] = requiredBoolean(body[key], key);
  }
  return c;
}

// Commits a hashed bundle of synthetic vaccination/lab-result/critical-flags
// data to the Midnight ledger via submitRecordBundle. recordId and any
// bundle field can be overridden in the request body; anything omitted gets
// a synthetic default (see syntheticData.ts).
app.post('/record-bundle', async (req, res) => {
  try {
    const body = req.body ?? {};
    const recordId: Uint8Array = typeof body.recordId === 'string' ? fromHex(body.recordId) : randomBytes32();

    const bundle = {
      vaccination: syntheticVaccination(parseVaccinationOverrides(body.vaccination)),
      vaccinationSalt: randomBytes32(),
      labResult: syntheticLabResult(parseLabResultOverrides(body.labResult)),
      labResultSalt: randomBytes32(),
      criticalFlags: syntheticCriticalFlags(parseCriticalFlagsOverrides(body.criticalFlags)),
      criticalFlagsSalt: randomBytes32(),
    };

    const client = await getClient();
    const tx = await client.submitRecordBundle({ recordId, ...bundle });
    rememberRecordBundle(toHex(recordId), bundle);

    res.json({
      recordId: toHex(recordId),
      contractAddress: client.contractAddress,
      // serializeTx isn't tx-specific — it's a generic BigInt/Uint8Array-safe
      // JSON encoder, reused here for the echoed-back bundle fields.
      bundle: serializeTx(bundle),
      tx: serializeTx(tx),
    });
  } catch (err) {
    inputError(res, err, 'submitRecordBundle');
  }
});

// Issues a scoped, expiring, revocable disclosure token for a previously
// submitted record. recipientPubKey defaults to this bridge's own fixed
// synthetic recipient identity (deriveRecipientPubKey), but a real deployment
// receives this from the actual recipient out of band — pass recipientPubKey
// (hex) in the request body to issue to any real external identity, e.g. one
// generated by verifier/web and derived via verifier/server's /derive-pubkey.
// DEVELOPMENT-ONLY raw bundle export. This reveals all underlying data and
// salts, so it must remain disabled when using any non-synthetic records.
// For the demo, explicitly opt in with CHART_ALLOW_RAW_BUNDLE_EXPORT=true.
app.get('/record-bundle/:recordId', (req, res) => {
  if (!ALLOW_RAW_BUNDLE_EXPORT) {
    res.status(403).json({ error: 'Raw bundle export is disabled. Set CHART_ALLOW_RAW_BUNDLE_EXPORT=true for a synthetic-only local demo.' });
    return;
  }
  const bundle = getRecordBundle(req.params.recordId);
  if (!bundle) {
    res.status(404).json({ error: `No record bundle remembered for recordId ${req.params.recordId}` });
    return;
  }
  res.json(serializeTx(bundle));
});

app.post('/disclosure-token', async (req, res) => {
  try {
    const body = req.body ?? {};
    if (typeof body.recordId !== 'string') {
      res.status(400).json({ error: 'recordId (hex) is required' });
      return;
    }
    const recordId = fromHex(body.recordId);
    const tokenId: Uint8Array = typeof body.tokenId === 'string' ? fromHex(body.tokenId) : randomBytes32();
    const expiryTime: bigint =
      body.expiryTime !== undefined ? uint(body.expiryTime, 'expiryTime', 64) : BigInt(Math.floor(Date.now() / 1000) + 3600);

    const client = await getClient();
    const recipientPubKey =
      typeof body.recipientPubKey === 'string' ? fromHex(body.recipientPubKey) : await client.deriveRecipientPubKey();
    const tx = await client.issueDisclosureToken({
      tokenId,
      recordId,
      grantVaccination: body.grantVaccination === undefined ? true : requiredBoolean(body.grantVaccination, 'grantVaccination'),
      grantLabResult: body.grantLabResult === undefined ? true : requiredBoolean(body.grantLabResult, 'grantLabResult'),
      grantCriticalFlags: body.grantCriticalFlags === undefined ? true : requiredBoolean(body.grantCriticalFlags, 'grantCriticalFlags'),
      expiryTime,
      recipientPubKey,
    });

    res.json({
      tokenId: toHex(tokenId),
      recordId: toHex(recordId),
      recipientPubKey: toHex(recipientPubKey),
      expiryTime: expiryTime.toString(),
      contractAddress: client.contractAddress,
      tx: serializeTx(tx),
    });
  } catch (err) {
    inputError(res, err, 'issueDisclosureToken');
  }
});

for (const [route, method, field] of [
  ['/revoke-token', 'revokeToken', 'tokenId'],
  ['/withdraw-record', 'withdrawRecordBundle', 'recordId'],
] as const) {
  app.post(route, async (req, res) => {
    try {
      const id = fromHex(req.body[field]);
      const client = await getClient();
      res.json({ tx: serializeTx(await client[method](id)) });
    } catch (err) { inputError(res, err, method); }
  });
}

// Verifies a scoped claim against a previously submitted record and token.
// Discloses ONLY the boolean predicate result — never the underlying bundle
// data. Re-supplies the same synthetic data this bridge submitted earlier
// for recordId (see syntheticData.ts's in-memory store) — standing in for
// the out-of-band data the institution would share with a real recipient.
app.post('/verify', async (req, res) => {
  try {
    const body = req.body ?? {};
    if (typeof body.tokenId !== 'string' || typeof body.recordId !== 'string' || typeof body.category !== 'string') {
      res.status(400).json({ error: 'tokenId, recordId, and category are required' });
      return;
    }
    const tokenId = fromHex(body.tokenId);
    const recordId = fromHex(body.recordId);
    const bundle = getRecordBundle(body.recordId);
    if (!bundle) {
      res.status(404).json({ error: `No record bundle remembered for recordId ${body.recordId}` });
      return;
    }

    const client = await getClient();
    if (body.category === 'vaccination') {
      const requiredVaccineId =
        typeof body.requiredVaccineId === 'string' ? fromHex(body.requiredVaccineId) : bundle.vaccination.vaccineId;
      const { pass, tx } = await client.verifyVaccinationBundle({
        tokenId,
        recordId,
        requiredVaccineId,
        vaccination: bundle.vaccination,
        vaccinationSalt: bundle.vaccinationSalt,
      });
      res.json({ category: 'vaccination', pass, tx: serializeTx(tx) });
    } else if (body.category === 'labResult') {
      const requiredTestTypeId =
        typeof body.requiredTestTypeId === 'string' ? fromHex(body.requiredTestTypeId) : bundle.labResult.testTypeId;
      const { pass, tx } = await client.verifyLabResultBundle({
        tokenId,
        recordId,
        requiredTestTypeId,
        labResult: bundle.labResult,
        labResultSalt: bundle.labResultSalt,
      });
      res.json({ category: 'labResult', pass, tx: serializeTx(tx) });
    } else if (body.category === 'criticalFlags') {
      if (body.requestedFlag === undefined) {
        res.status(400).json({ error: 'requestedFlag (0-8) is required for category "criticalFlags"' });
        return;
      }
      if (Number(body.requestedFlag) > 8) {
        res.status(400).json({ error: 'requestedFlag must be between 0 and 8' });
        return;
      }
      const { pass, tx } = await client.verifyCriticalFlagsBundle({
        tokenId,
        recordId,
        criticalFlags: bundle.criticalFlags,
        criticalFlagsSalt: bundle.criticalFlagsSalt,
        requestedFlag: uint(body.requestedFlag, 'requestedFlag', 8),
      });
      res.json({ category: 'criticalFlags', pass, tx: serializeTx(tx) });
    } else {
      res.status(400).json({ error: `Unknown category "${body.category}" — expected vaccination, labResult, or criticalFlags` });
    }
  } catch (err) {
    inputError(res, err, 'verify');
  }
});

app.use(jsonError);
return app;
}
