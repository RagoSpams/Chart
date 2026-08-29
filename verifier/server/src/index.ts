import cors from 'cors';
import express from 'express';
import type { FinalizedTxData } from '@midnight-ntwrk/midnight-js-types';

import {
  deriveRecipientPubKeyLocally,
  getRecordStatus,
  verifyCriticalFlagsBundle,
  verifyLabResultBundle,
  verifyVaccinationBundle,
} from './midnight.js';

const app = express();
// The verifier's web UI is served from a different origin/port than this
// server (see verifier/web) — this is the real separation the whole
// package exists to demonstrate, so CORS has to be open between them.
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 4200;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: '@gnuhealth-midnight/verifier-server' });
});

function fromHex(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
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
    res.status(400).json({ error: (err as Error).message });
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
          dose: BigInt(v.dose),
          administeredDate: BigInt(v.administeredDate),
          hasNextDose: Boolean(v.hasNextDose),
          nextDoseDate: BigInt(v.nextDoseDate),
          completed: Boolean(v.completed),
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
          resultValue: BigInt(l.resultValue),
          rangeLow: BigInt(l.rangeLow),
          rangeHigh: BigInt(l.rangeHigh),
          analysisDate: BigInt(l.analysisDate),
        },
        labResultSalt: fromHex(body.labResultSalt),
      }));
    } else if (body.category === 'criticalFlags') {
      const c = body.criticalFlags ?? {};
      if (body.requestedFlag === undefined) {
        res.status(400).json({ error: 'requestedFlag (0-8) is required for category "criticalFlags"' });
        return;
      }
      ({ pass, tx } = await verifyCriticalFlagsBundle({
        contractAddress,
        recipientSecret,
        tokenId,
        recordId,
        criticalFlags: {
          critDbt: Boolean(c.critDbt),
          critCardio: Boolean(c.critCardio),
          critAllergic: Boolean(c.critAllergic),
          critCancer: Boolean(c.critCancer),
          critImmuno: Boolean(c.critImmuno),
          critMental: Boolean(c.critMental),
          critNutrition: Boolean(c.critNutrition),
          critSocial: Boolean(c.critSocial),
          critCognitive: Boolean(c.critCognitive),
        },
        criticalFlagsSalt: fromHex(body.criticalFlagsSalt),
        requestedFlag: BigInt(body.requestedFlag),
      }));
    } else {
      res.status(400).json({ error: `Unknown category "${body.category}"` });
      return;
    }

    res.json({ pass, tx: serialize(tx) });
  } catch (err) {
    res.status(500).json({ error: 'verify failed', message: (err as Error).message });
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
    res.status(500).json({ error: 'record-status failed', message: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`verifier-server listening on :${PORT}`);
});
