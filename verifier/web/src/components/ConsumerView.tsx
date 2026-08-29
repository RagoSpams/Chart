// The plain public read — no identity, no token, no ZK proof at all.
// recordRegistry is `export ledger` in gnuhealth_disclosure.compact
// specifically so this check needs none of the ZK machinery the Verifier
// view uses (see verifier/server/src/midnight.ts's getRecordStatus header
// comment). Anyone can check whether a record exists / was withdrawn.

import { useState } from 'react';
import { recordStatus, type RecordStatus } from '../lib/api.js';
import { PrivacyInspector } from './PrivacyInspector.js';

export function ConsumerView() {
  const [contractAddress, setContractAddress] = useState('');
  const [recordIdHex, setRecordIdHex] = useState('');
  const [result, setResult] = useState<RecordStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setResult(await recordStatus(contractAddress, recordIdHex));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const active = result?.exists && !result.withdrawn;

  return (
    <div className="dashboard consumer-view">
      <div className="scan-card">
        <div className="eyebrow tc">RECORD STATUS</div>

        <form onSubmit={handleCheck}>
          <label>
            Contract address
            <input type="text" value={contractAddress} onChange={(e) => setContractAddress(e.target.value)} required />
          </label>
          <label>
            Record ID
            <input type="text" value={recordIdHex} onChange={(e) => setRecordIdHex(e.target.value)} required />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Check'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>

        {result && (
          <>
            <div className="scan-result-row">
              <span>Status</span>
              <span className={active ? 'ok-text' : 'danger-text'}>
                {!result.exists ? 'Unknown record' : result.withdrawn ? 'Withdrawn — no longer disclosable' : 'Active'}
              </span>
            </div>
            <div className={active ? 'stamp stamp-pass stamp-center' : 'stamp stamp-fail stamp-center'}>
              {!result.exists ? 'UNKNOWN' : result.withdrawn ? 'WITHDRAWN' : 'ACTIVE'}
            </div>
          </>
        )}

        <PrivacyInspector
          compact
          privateTitle="Private witness"
          publicTitle="Public ledger"
          privateItems={[{ label: 'Witness data used', value: 'NONE — this check needs none' }]}
          publicItems={
            result
              ? [
                  { label: 'Record exists?', value: String(result.exists) },
                  { label: 'Withdrawn?', value: String(result.withdrawn) },
                ]
              : []
          }
          disclosed={result ? { label: 'Everything shown above', value: 'this entire check is public by design' } : undefined}
        />
      </div>
    </div>
  );
}
