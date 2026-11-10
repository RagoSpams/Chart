// The "regulator/researcher" role — checks one scoped predicate against a
// disclosure token, using an identity generated in this browser and never
// shared with the institution (see lib/identity.ts). The raw bundle data +
// salt a real verifier needs is exactly what the institution's bridge
// echoes back in its /record-bundle response's "bundle" field — paste that
// JSON below (a real handoff would be a portal or a signed message, not
// copy-paste, but the shape is the same: out-of-band, never on-chain).

import { useEffect, useMemo, useState } from 'react';
import { derivePubKey, verify, type CriticalFlagsBundle } from '../lib/api.js';
import { useVerifierIdentity } from '../lib/identity.js';
import { bytes32ToLabel, formatUnixSeconds, shortHex } from '../lib/format.js';
import { hexToBytes } from '../lib/hex.js';
import { parseBundleJson, type ParsedBundle } from '../lib/bundle.js';
import { PrivacyInspector, type InspectorRow } from './PrivacyInspector.js';

type Category = 'vaccination' | 'labResult' | 'criticalFlags';

const CATEGORY_OPTIONS: { id: Category; label: string }[] = [
  { id: 'vaccination', label: 'Vaccination status' },
  { id: 'labResult', label: 'Lab result' },
  { id: 'criticalFlags', label: 'Critical flags' },
];

const CRIT_FLAG_LABELS: { key: keyof CriticalFlagsBundle; index: number; label: string }[] = [
  { key: 'critDbt', index: 0, label: 'Diabetes' },
  { key: 'critCardio', index: 1, label: 'Cardiovascular' },
  { key: 'critAllergic', index: 2, label: 'Allergic' },
  { key: 'critCancer', index: 3, label: 'Cancer' },
  { key: 'critImmuno', index: 4, label: 'Immunocompromised' },
  { key: 'critMental', index: 5, label: 'Mental health' },
  { key: 'critNutrition', index: 6, label: 'Nutrition' },
  { key: 'critSocial', index: 7, label: 'Social' },
  { key: 'critCognitive', index: 8, label: 'Cognitive' },
];

type Outcome = { kind: 'pass'; pass: boolean } | { kind: 'error'; message: string };

export function VerifierView() {
  const { secret, regenerate } = useVerifierIdentity();
  const [recipientSecretHex, setRecipientSecretHex] = useState('');
  const [pubKeyHex, setPubKeyHex] = useState('');
  const [pubKeyError, setPubKeyError] = useState<string | null>(null);

  useEffect(() => {
    setRecipientSecretHex(Array.from(secret).map((b) => b.toString(16).padStart(2, '0')).join(''));
  }, [secret]);

  useEffect(() => {
    if (!recipientSecretHex) return;
    let cancelled = false;
    derivePubKey(recipientSecretHex)
      .then((pk) => !cancelled && (setPubKeyHex(pk), setPubKeyError(null)))
      .catch((err) => !cancelled && setPubKeyError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [recipientSecretHex]);

  const [contractAddress, setContractAddress] = useState('');
  const [tokenIdHex, setTokenIdHex] = useState('');
  const [recordIdHex, setRecordIdHex] = useState('');
  const [category, setCategory] = useState<Category>('labResult');
  const [bundleJsonText, setBundleJsonText] = useState('');
  const [requestedFlag, setRequestedFlag] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);

  const parsedBundle = useMemo<ParsedBundle | null>(() => {
    if (!bundleJsonText.trim()) return null;
    try {
      return parseBundleJson(bundleJsonText);
    } catch {
      return null;
    }
  }, [bundleJsonText]);

  const privateItems: InspectorRow[] = [
    { label: 'Your recipient secret', value: recipientSecretHex },
    ...(category === 'vaccination' && parsedBundle?.vaccination
      ? [
          { label: 'Vaccine', value: bytes32ToLabel(hexToBytes(parsedBundle.vaccination.vaccineId)) },
          { label: 'Dose', value: String(parsedBundle.vaccination.dose) },
          { label: 'Administered', value: formatUnixSeconds(parsedBundle.vaccination.administeredDate) },
          { label: 'Completed', value: String(parsedBundle.vaccination.completed) },
          { label: 'Salt (never disclosed)', value: parsedBundle.vaccinationSalt ?? '' },
        ]
      : []),
    ...(category === 'labResult' && parsedBundle?.labResult
      ? [
          { label: 'Test type', value: bytes32ToLabel(hexToBytes(parsedBundle.labResult.testTypeId)) },
          { label: 'Result value', value: String(parsedBundle.labResult.resultValue) },
          { label: 'Reference range', value: `${parsedBundle.labResult.rangeLow}–${parsedBundle.labResult.rangeHigh}` },
          { label: 'Salt (never disclosed)', value: parsedBundle.labResultSalt ?? '' },
        ]
      : []),
    ...(category === 'criticalFlags' && parsedBundle?.criticalFlags
      ? [
          ...CRIT_FLAG_LABELS.filter((f) => parsedBundle.criticalFlags![f.key]).map((f) => ({ label: f.label, value: 'true' })),
          { label: 'Salt (never disclosed)', value: parsedBundle.criticalFlagsSalt ?? '' },
        ]
      : []),
  ];

  const publicItems: InspectorRow[] = [
    ...(pubKeyHex ? [{ label: 'Your public key (shared with the institution)', value: shortHex(hexToBytes(pubKeyHex)) }] : []),
    ...(contractAddress ? [{ label: 'Contract', value: `0x${contractAddress.slice(0, 10)}…` }] : []),
    ...(tokenIdHex ? [{ label: 'Token ID', value: `0x${tokenIdHex.slice(0, 10)}…` }] : []),
    ...(recordIdHex ? [{ label: 'Record ID', value: `0x${recordIdHex.slice(0, 10)}…` }] : []),
  ];

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setOutcome(null);
    setBusy(true);
    try {
      const bundle = parseBundleJson(bundleJsonText);
      let pass: boolean;
      if (category === 'vaccination') {
        if (!bundle.vaccination || !bundle.vaccinationSalt) throw new Error('Pasted bundle has no vaccination data');
        ({ pass } = await verify({
          category: 'vaccination',
          contractAddress,
          recipientSecret: recipientSecretHex,
          tokenId: tokenIdHex,
          recordId: recordIdHex,
          vaccination: bundle.vaccination,
          vaccinationSalt: bundle.vaccinationSalt,
        }));
      } else if (category === 'labResult') {
        if (!bundle.labResult || !bundle.labResultSalt) throw new Error('Pasted bundle has no lab result data');
        ({ pass } = await verify({
          category: 'labResult',
          contractAddress,
          recipientSecret: recipientSecretHex,
          tokenId: tokenIdHex,
          recordId: recordIdHex,
          labResult: bundle.labResult,
          labResultSalt: bundle.labResultSalt,
        }));
      } else {
        if (!bundle.criticalFlags || !bundle.criticalFlagsSalt) throw new Error('Pasted bundle has no critical-flags data');
        ({ pass } = await verify({
          category: 'criticalFlags',
          contractAddress,
          recipientSecret: recipientSecretHex,
          tokenId: tokenIdHex,
          recordId: recordIdHex,
          criticalFlags: bundle.criticalFlags,
          criticalFlagsSalt: bundle.criticalFlagsSalt,
          requestedFlag: String(requestedFlag),
        }));
      }
      setOutcome({ kind: 'pass', pass });
    } catch (err) {
      setOutcome({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dashboard">
      <div className="cert-header">
        <div>
          <div className="eyebrow">SCOPED DISCLOSURE VERIFICATION</div>
          <h1>Verify a disclosure token</h1>
        </div>
        {outcome?.kind === 'pass' && <div className={outcome.pass ? 'stamp stamp-pass' : 'stamp stamp-fail'}>{outcome.pass ? 'PASS' : 'FAIL'}</div>}
      </div>

      <p className="hint">
        This identity was generated in your own browser and has never been shared with the hospital's system — only
        its public key below is meant to leave this device, handed to the institution so they can issue a token
        scoped to it. A real proof runs against the live contract when you verify; your secret and the pasted bundle are sent to your trusted verifier server for proof generation.
        The ledger receives commitments, authorization metadata, the result, and vaccination scheduling fields.
      </p>

      <div className="card identity-card">
        <label>
          Your recipient secret
          <input type="password" autoComplete="off" value={recipientSecretHex} onChange={(e) => setRecipientSecretHex(e.target.value)} />
        </label>
        <div className="identity-row">
          <span className="hint">
            Your public key: {pubKeyError ? <span className="error">{pubKeyError}</span> : pubKeyHex ? shortHex(hexToBytes(pubKeyHex)) : 'deriving…'}
          </span>
          <button type="button" onClick={regenerate} className="secondary">
            Generate new identity
          </button>
        </div>
      </div>

      <form className="card" onSubmit={handleVerify}>
        <label>
          Contract address
          <input type="text" value={contractAddress} onChange={(e) => setContractAddress(e.target.value)} placeholder="paste the contract address" required />
        </label>
        <label>
          Token ID
          <input type="text" value={tokenIdHex} onChange={(e) => setTokenIdHex(e.target.value)} placeholder="paste the token ID the institution issued to your public key" required />
        </label>
        <label>
          Record ID
          <input type="text" value={recordIdHex} onChange={(e) => setRecordIdHex(e.target.value)} placeholder="paste the record ID" required />
        </label>
        <label>
          Bundle data export (JSON)
          <textarea
            value={bundleJsonText}
            onChange={(e) => setBundleJsonText(e.target.value)}
            placeholder='paste the "bundle" object the institution shared out of band'
            rows={4}
            required
          />
        </label>

        <div className="scope-picker">
          {CATEGORY_OPTIONS.map(({ id, label }) => (
            <label key={id} className="checkbox-row">
              <input type="radio" name="category" checked={category === id} onChange={() => setCategory(id)} />
              {label}
            </label>
          ))}
        </div>

        {category === 'criticalFlags' && (
          <label>
            Which flag to check (0–8)
            <select value={requestedFlag} onChange={(e) => setRequestedFlag(Number(e.target.value))}>
              {CRIT_FLAG_LABELS.map((f) => (
                <option key={f.index} value={f.index}>
                  {f.index}: {f.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <button type="submit" disabled={busy}>
          {busy ? 'Generating proof…' : 'Verify'}
        </button>

        {outcome?.kind === 'pass' && (
          <p className={outcome.pass ? 'success' : 'error'}>
            Verification returned {outcome.pass ? 'PASS' : 'FAIL'}. The verifier server received the witness data;
            vaccination checks also disclose scheduling fields to the ledger.
          </p>
        )}
        {outcome?.kind === 'error' && <p className="error">Could not verify: {outcome.message}</p>}
      </form>

      <PrivacyInspector
        privateItems={privateItems}
        publicItems={publicItems}
        disclosed={outcome?.kind === 'pass' ? { label: 'Verification result', value: outcome.pass ? 'PASS' : 'FAIL' } : undefined}
      />
    </div>
  );
}
