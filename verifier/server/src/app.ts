import cors from 'cors';
import express from 'express';
import type { FinalizedTxData } from '@midnight-ntwrk/midnight-js-types';

import { validateVerifierBody, jsonError } from './security.js';
import type * as Midnight from './midnight.js';
type Backend = Pick<typeof Midnight, 'deriveRecipientPubKeyLocally' | 'getRecordStatus' | 'verifyCriticalFlagsBundle' | 'verifyLabResultBundle' | 'verifyVaccinationBundle'>;
export function createApp(backend: Backend) {
const { deriveRecipientPubKeyLocally, getRecordStatus, verifyCriticalFlagsBundle, verifyLabResultBundle, verifyVaccinationBundle } = backend;
const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
// The verifier's web UI is served from a different origin/port than this
// server (see verifier/web) — this is the real separation the whole
// package exists to demonstrate, so CORS has to be open between them.
const ALLOWED_ORIGINS = process.env.CHART_VERIFIER_ORIGIN
  ? [process.env.CHART_VERIFIER_ORIGIN]
  : ['http://localhost:5174', 'http://127.0.0.1:5174'];
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: '64kb' }));
app.use(validateVerifierBody);


app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: '@gnuhealth-midnight/verifier-server' });
});

function fromHex(hex: unknown): Uint8Array {
  if (typeof hex !== 'string') throw new InputError('Expected a 32-byte hex string');
  const normalized = hex.replace(/^0x/i, '');
  if (!/^[a-fA-F0-9]{64}$/.test(normalized)) throw new InputError('Expected exactly 32 bytes encoded as hexadecimal');
  return new Uint8Array(Buffer.from(normalized, 'hex'));
}

class InputError extends Error {}
function parseUInt(value: unknown, name: string, bits: number): bigint {
  if (typeof value !== 'string' && (typeof value !== 'number' || !Number.isSafeInteger(value))) throw new InputError(`${name} must be an unsigned integer`);
  if (!/^(0|[1-9][0-9]*)$/.test(String(value))) throw new InputError(`${name} must be an unsigned integer`);
  const result = BigInt(value);
  if (result >= (1n << BigInt(bits))) throw new InputError(`${name} exceeds Uint<${bits}>`);
  return result;
}
function parseBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new InputError(`${name} must be a boolean`);
  return value;
}
function reportError(res: import('express').Response, err: unknown, operation: string): void {
  if (err instanceof InputError) {
    res.status(400).json({ error: err.message });
  } else if (err instanceof Error && /failed assert: (Token has expired|Token has been revoked|Record has been withdrawn|Caller is not this token's recipient)/.test(err.message)) {
    const code = err.message.includes('Token has expired') ? 'TOKEN_EXPIRED' :
      err.message.includes('Token has been revoked') ? 'TOKEN_REVOKED' :
      err.message.includes('Record has been withdrawn') ? 'RECORD_WITHDRAWN' : 'RECIPIENT_MISMATCH';
    res.status(403).json({ error: 'Disclosure authorization failed', code });
  } else {
    console.error(`[verifier] ${operation} failed`);
  if (process.env.CHART_DEBUG_SYNTHETIC === 'true') console.error(String(err).replace(/[a-f0-9]{64}/gi, '[redacted]').slice(0, 2000));
    res.status(500).json({ error: `${operation} failed` });
  }
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function serialize(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (typeof v === 'bigint') return v.toString();
      if (v instanceof Uint8Array) return toHex(v);
      return v;
    }),
  );
}

// Pure, local — no transaction. Lets the verifier's own UI show "your
// public key (share this with the institution)" without needing to submit
// anything first.
app.post('/derive-pubkey', (req, res) => {
  try {
    const recipientSecret = fromHex(req.body.recipientSecret);
    const pubKey = deriveRecipientPubKeyLocally(recipientSecret);
    res.json({ recipientPubKey: toHex(pubKey) });
  } catch (err) {
    reportError(res, err, 'derive-pubkey');
  }
});

app.post('/verify', async (req, res) => {
  const body = req.body ?? {};
  try {
    if (typeof body.contractAddress !== 'string') {
      res.status(400).json({ error: 'contractAddress is required' });
      return;
    }
    if (typeof body.recipientSecret !== 'string') {
      res.status(400).json({ error: 'recipientSecret is required' });
      return;
    }
    if (typeof body.tokenId !== 'string' || typeof body.recordId !== 'string' || typeof body.category !== 'string') {
      res.status(400).json({ error: 'tokenId, recordId, and category are required' });
      return;
    }

    const contractAddress = body.contractAddress;
    const recipientSecret = fromHex(body.recipientSecret);
    const tokenId = fromHex(body.tokenId);
    const recordId = fromHex(body.recordId);

    let pass: boolean;
    let tx: FinalizedTxData;

    if (body.category === 'vaccination') {
      const v = body.vaccination ?? {};
      ({ pass, tx } = await verifyVaccinationBundle({
        contractAddress,
        recipientSecret,
        tokenId,
        recordId,
        requiredVaccineId: fromHex(v.vaccineId),
        vaccination: {
          vaccineId: fromHex(v.vaccineId),
          dose: parseUInt(v.dose, 'dose', 16),
          administeredDate: parseUInt(v.administeredDate, 'administeredDate', 64),
          hasNextDose: parseBoolean(v.hasNextDose, 'hasNextDose'),
          nextDoseDate: parseUInt(v.nextDoseDate, 'nextDoseDate', 64),
          completed: parseBoolean(v.completed, 'completed'),
        },
        vaccinationSalt: fromHex(body.vaccinationSalt),
      }));
    } else if (body.category === 'labResult') {
      const l = body.labResult ?? {};
      ({ pass, tx } = await verifyLabResultBundle({
        contractAddress,
        recipientSecret,
        tokenId,
        recordId,
        requiredTestTypeId: fromHex(l.testTypeId),
        labResult: {
          testTypeId: fromHex(l.testTypeId),
          resultValue: parseUInt(l.resultValue, 'resultValue', 32),
          rangeLow: parseUInt(l.rangeLow, 'rangeLow', 32),
          rangeHigh: parseUInt(l.rangeHigh, 'rangeHigh', 32),
          analysisDate: parseUInt(l.analysisDate, 'analysisDate', 64),
        },
        labResultSalt: fromHex(body.labResultSalt),
      }));
    } else if (body.category === 'criticalFlags') {
      const c = body.criticalFlags ?? {};
      if (body.requestedFlag === undefined) {
        res.status(400).json({ error: 'requestedFlag (0-8) is required for category "criticalFlags"' });
        return;
      }
      if (!/^[0-8]$/.test(String(body.requestedFlag))) {
        res.status(400).json({ error: 'requestedFlag must be between 0 and 8' });
        return;
      }
      ({ pass, tx } = await verifyCriticalFlagsBundle({
        contractAddress,
        recipientSecret,
        tokenId,
        recordId,
        criticalFlags: {
          critDbt: parseBoolean(c.critDbt, 'critDbt'),
          critCardio: parseBoolean(c.critCardio, 'critCardio'),
          critAllergic: parseBoolean(c.critAllergic, 'critAllergic'),
          critCancer: parseBoolean(c.critCancer, 'critCancer'),
          critImmuno: parseBoolean(c.critImmuno, 'critImmuno'),
          critMental: parseBoolean(c.critMental, 'critMental'),
          critNutrition: parseBoolean(c.critNutrition, 'critNutrition'),
          critSocial: parseBoolean(c.critSocial, 'critSocial'),
          critCognitive: parseBoolean(c.critCognitive, 'critCognitive'),
        },
        criticalFlagsSalt: fromHex(body.criticalFlagsSalt),
        requestedFlag: parseUInt(body.requestedFlag, 'requestedFlag', 8),
      }));
    } else {
      res.status(400).json({ error: `Unknown category "${body.category}"` });
      return;
    }

    res.json({ category: body.category, pass, tx: serialize(tx) });
  } catch (err) {
    reportError(res, err, 'verify');
  }
});

// Plain public ledger read — no witness, no proof. See midnight.ts's header
// comment. This is the Consumer-equivalent: anyone can check whether a
// record exists / was withdrawn, with zero identity or token needed.
app.get('/record-status', async (req, res) => {
  try {
    const contractAddress = String(req.query.contractAddress ?? '');
    const recordId = String(req.query.recordId ?? '');
    if (!contractAddress || !recordId) {
      res.status(400).json({ error: 'contractAddress and recordId query params are required' });
      return;
    }
    const status = await getRecordStatus(contractAddress, fromHex(recordId));
    res.json(status);
  } catch (err) {
    reportError(res, err, 'record-status');
  }
});

app.use(jsonError);
return app;
}
