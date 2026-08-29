import express from 'express';
import type { FinalizedTxData } from '@midnight-ntwrk/midnight-js-types';

import { GnuhealthDisclosureClient } from './midnight.js';
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

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

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
    clientPromise = GnuhealthDisclosureClient.deploy().catch((err) => {
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
  if (body.dose !== undefined) v.dose = BigInt(body.dose as never);
  if (body.administeredDate !== undefined) v.administeredDate = BigInt(body.administeredDate as never);
  if (body.hasNextDose !== undefined) v.hasNextDose = Boolean(body.hasNextDose);
  if (body.nextDoseDate !== undefined) v.nextDoseDate = BigInt(body.nextDoseDate as never);
  if (body.completed !== undefined) v.completed = Boolean(body.completed);
  return v;
}

function parseLabResultOverrides(body: Record<string, unknown> | undefined): Partial<LabResult> {
  if (!body) return {};
  const l: Partial<LabResult> = {};
  if (typeof body.testTypeId === 'string') l.testTypeId = fromHex(body.testTypeId);
  if (body.resultValue !== undefined) l.resultValue = BigInt(body.resultValue as never);
  if (body.rangeLow !== undefined) l.rangeLow = BigInt(body.rangeLow as never);
  if (body.rangeHigh !== undefined) l.rangeHigh = BigInt(body.rangeHigh as never);
  if (body.analysisDate !== undefined) l.analysisDate = BigInt(body.analysisDate as never);
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
    if (body[key] !== undefined) c[key] = Boolean(body[key]);
  }
  return c;
}

// Commits a hashed bundle of synthetic vaccination/lab-result/critical-flags
// data to the Midnight ledger via submitRecordBundle. recordId and any
// bundle field can be overridden in the request body; anything omitted gets
// a synthetic default (see syntheticData.ts).
app.post('/record-bundle', async (req, res) => {
  try {
    const client = await getClient();
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
    console.error('[bridge] submitRecordBundle error:', err);
    res.status(500).json({ error: 'submitRecordBundle failed', message: (err as Error).message });
  }
});

// Issues a scoped, expiring, revocable disclosure token for a previously
// submitted record. recipientPubKey defaults to this bridge's own fixed
// synthetic recipient identity (deriveRecipientPubKey), but a real deployment
// receives this from the actual recipient out of band — pass recipientPubKey
// (hex) in the request body to issue to any real external identity, e.g. one
// generated by verifier/web and derived via verifier/server's /derive-pubkey.
// Reads back the exact bundle+salt this bridge remembers for a recordId —
// needed to hand a real recipient (e.g. the standalone verifier app) the
// same raw data the institution committed on-chain for a SPECIFIC record,
// including ones submitted via Tryton's wizard rather than this bridge's
// own /record-bundle caller (the wizard never sees the salt itself, since
// it only reads back recordId/contractAddress from the response — this is
// the one place that data can be recovered afterward).
app.get('/record-bundle/:recordId', (req, res) => {
  const bundle = getRecordBundle(req.params.recordId);
  if (!bundle) {
    res.status(404).json({ error: `No record bundle remembered for recordId ${req.params.recordId}` });
    return;
  }
  res.json(serializeTx(bundle));
});

app.post('/disclosure-token', async (req, res) => {
  try {
    const client = await getClient();
    const body = req.body ?? {};
    if (typeof body.recordId !== 'string') {
      res.status(400).json({ error: 'recordId (hex) is required' });
      return;
    }
    const recordId = fromHex(body.recordId);
    const tokenId: Uint8Array = typeof body.tokenId === 'string' ? fromHex(body.tokenId) : randomBytes32();
    const expiryTime: bigint =
      body.expiryTime !== undefined ? BigInt(body.expiryTime) : BigInt(Math.floor(Date.now() / 1000) + 3600);

    const recipientPubKey =
      typeof body.recipientPubKey === 'string' ? fromHex(body.recipientPubKey) : await client.deriveRecipientPubKey();

    const tx = await client.issueDisclosureToken({
      tokenId,
      recordId,
      grantVaccination: body.grantVaccination ?? true,
      grantLabResult: body.grantLabResult ?? true,
      grantCriticalFlags: body.grantCriticalFlags ?? true,
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
    res.status(500).json({ error: 'issueDisclosureToken failed', message: (err as Error).message });
  }
});

// Verifies a scoped claim against a previously submitted record and token.
// Discloses ONLY the boolean predicate result — never the underlying bundle
// data. Re-supplies the same synthetic data this bridge submitted earlier
// for recordId (see syntheticData.ts's in-memory store) — standing in for
// the out-of-band data the institution would share with a real recipient.
app.post('/verify', async (req, res) => {
  try {
    const client = await getClient();
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
      const { pass, tx } = await client.verifyCriticalFlagsBundle({
        tokenId,
        recordId,
        criticalFlags: bundle.criticalFlags,
        criticalFlagsSalt: bundle.criticalFlagsSalt,
        requestedFlag: BigInt(body.requestedFlag),
      });
      res.json({ category: 'criticalFlags', pass, tx: serializeTx(tx) });
    } else {
      res.status(400).json({ error: `Unknown category "${body.category}" — expected vaccination, labResult, or criticalFlags` });
    }
  } catch (err) {
    res.status(500).json({ error: 'verify failed', message: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`bridge service listening on :${PORT}`);
});
