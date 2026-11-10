import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler, ErrorRequestHandler } from 'express';

export function apiSecurity(key: string | undefined): RequestHandler {
  return (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.path === '/health' && req.method === 'GET') return next();
    if (!key || key.length < 32) { res.status(503).json({ error: 'Bridge authentication is not configured' }); return; }
    const provided = Buffer.from(req.get('Authorization') || '');
    const expected = Buffer.from(`Bearer ${key}`);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      res.status(401).json({ error: 'Unauthorized' }); return;
    }
    next();
  };
}

type Obj = Record<string, unknown>;
function object(v: unknown): Obj {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Expected a JSON object');
  return v as Obj;
}
function hex(v: unknown) {
  if (typeof v !== 'string' || !/^(0x)?[a-f0-9]{64}$/i.test(v)) throw new Error('Expected exactly 32 bytes encoded as hexadecimal');
}
function uint(v: unknown, bits: number) {
  if ((typeof v !== 'string' && (typeof v !== 'number' || !Number.isSafeInteger(v))) || !/^(0|[1-9][0-9]*)$/.test(String(v)) || String(v).length > 20 || BigInt(v as string) >= 2n ** BigInt(bits)) throw new Error(`Expected Uint<${bits}>`);
}
const flags = ['critDbt','critCardio','critAllergic','critCancer','critImmuno','critMental','critNutrition','critSocial','critCognitive'];
const vaccine = { vaccineId: 'hex', dose: 16, administeredDate: 64, hasNextDose: 'bool', nextDoseDate: 64, completed: 'bool' };
const lab = { testTypeId: 'hex', resultValue: 32, rangeLow: 32, rangeHigh: 32, analysisDate: 64 };
const critical = Object.fromEntries(flags.map(k => [k, 'bool']));
function fields(value: unknown, schema: Record<string, string | number>, required = false) {
  const o = object(value);
  for (const key of Object.keys(o)) if (!Object.hasOwn(schema, key)) throw new Error(`Unknown field: ${key}`);
  for (const [key, type] of Object.entries(schema)) {
    if (o[key] === undefined && !required) continue;
    if (type === 'hex') hex(o[key]);
    else if (type === 'bool') { if (typeof o[key] !== 'boolean') throw new Error(`${key} must be a boolean`); }
    else if (typeof type === 'number') uint(o[key], type);
  }
  if (o.rangeLow !== undefined && o.rangeHigh !== undefined && BigInt(o.rangeLow as string) > BigInt(o.rangeHigh as string)) throw new Error('rangeLow must not exceed rangeHigh');
}
export const validateBridgeBody: RequestHandler = (req, res, next) => {
  try {
    if (req.method !== 'POST') return next();
    const b = object(req.body);
    if (req.path === '/record-bundle') {
      fields(b, { recordId: 'hex', vaccination: 'object', labResult: 'object', criticalFlags: 'object' });
      if (b.vaccination !== undefined) fields(b.vaccination, vaccine);
      if (b.labResult !== undefined) fields(b.labResult, lab);
      if (b.criticalFlags !== undefined) fields(b.criticalFlags, critical);
    } else if (req.path === '/disclosure-token') {
      fields(b, { recordId: 'hex', tokenId: 'hex', recipientPubKey: 'hex', expiryTime: 64, grantVaccination: 'bool', grantLabResult: 'bool', grantCriticalFlags: 'bool' });
      hex(b.recordId);
      hex(b.recipientPubKey);
      if (b.expiryTime !== undefined && BigInt(b.expiryTime as string) <= BigInt(Math.floor(Date.now()/1000))) throw new Error('expiryTime must be in the future');
      if (b.grantVaccination === false && b.grantLabResult === false && b.grantCriticalFlags === false) throw new Error('Token must grant a bundle');
    } else if (req.path === '/revoke-token' || req.path === '/withdraw-record') {
      const key = req.path === '/revoke-token' ? 'tokenId' : 'recordId';
      fields(b, { [key]: 'hex' }, true);
    } else if (req.path === '/verify') {
      fields(b, { tokenId: 'hex', recordId: 'hex', category: 'category', requiredVaccineId: 'hex', requiredTestTypeId: 'hex', requestedFlag: 8 });
      hex(b.tokenId); hex(b.recordId);
      category(b);
    }
    next();
  } catch (err) { res.status(400).json({ error: (err as Error).message }); }
};
function category(b: Obj) {
  if (!['vaccination','labResult','criticalFlags'].includes(b.category as string)) throw new Error('Unknown category');
  if (b.category === 'criticalFlags') { uint(b.requestedFlag, 8); if (BigInt(b.requestedFlag as string) > 8n) throw new Error('requestedFlag must be between 0 and 8'); }
}
export const validateVerifierBody: RequestHandler = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.path === '/record-status') { hex(req.query.contractAddress); hex(req.query.recordId); }
    if (req.method !== 'POST') return next();
    const b = object(req.body);
    if (req.path === '/derive-pubkey') fields(b, { recipientSecret: 'hex' }, true);
    if (req.path === '/verify') {
      fields(b, { contractAddress: 'hex', recipientSecret: 'hex', tokenId: 'hex', recordId: 'hex', category: 'category', vaccination: 'object', vaccinationSalt: 'hex', labResult: 'object', labResultSalt: 'hex', criticalFlags: 'object', criticalFlagsSalt: 'hex', requestedFlag: 8 });
      for (const key of ['contractAddress','recipientSecret','tokenId','recordId']) hex(b[key]);
      category(b);
      const name = b.category as string;
      fields(b[name], name === 'vaccination' ? vaccine : name === 'labResult' ? lab : critical, true);
      hex(b[name + 'Salt']);
    }
    next();
  } catch (err) { res.status(400).json({ error: (err as Error).message }); }
};
export const jsonError: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err.type === 'entity.too.large' ? 413 : err instanceof SyntaxError ? 400 : 500;
  res.status(status).json({ error: status === 413 ? 'Request too large' : status === 400 ? 'Malformed JSON' : 'Request failed' });
};
