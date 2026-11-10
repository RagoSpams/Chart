// The judge-facing centerpiece, ported from the prior Assay project: makes
// the "prove the predicate, reveal nothing else" claim concrete by showing,
// side by side, exactly what data this browser holds privately versus what
// a real verify call discloses. Private values render as redaction bars —
// the real value is still in the DOM (title attribute) since this app's
// whole point is letting a judge verify what's actually kept private.

export interface InspectorRow {
  readonly label: string;
  readonly value: string;
}

function RedactionBar({ value }: { value: string }) {
  const width = Math.min(200, Math.max(60, value.length * 7));
  return <div className="redaction-bar" style={{ width }} title={value} aria-label={value} />;
}

function PrivateBox({ items }: { items: InspectorRow[] }) {
  return (
    <div className="privacy-box private-box">
      {items.length === 0 ? (
        <p className="hint pi-empty">Nothing yet.</p>
      ) : (
        items.map((row) => (
          <div className="privacy-field" key={row.label}>
            <div className="privacy-field-label">{row.label}</div>
            <RedactionBar value={row.value} />
          </div>
        ))
      )}
    </div>
  );
}

function PublicBox({ items }: { items: InspectorRow[] }) {
  return (
    <div className="privacy-box public-box">
      {items.length === 0 ? (
        <p className="hint pi-empty">Nothing on-chain yet.</p>
      ) : (
        items.map((row) => (
          <div className="privacy-field" key={row.label}>
            <span className="privacy-field-label">{row.label}</span>
            <br />
            <span className="privacy-field-value">{row.value}</span>
          </div>
        ))
      )}
    </div>
  );
}

export function PrivacyInspector({
  privateTitle = 'Witness (shared with trusted verifier server)',
  publicTitle = 'Public (what a real indexer shows anyone)',
  privateItems,
  publicItems,
  disclosed,
  compact = false,
}: {
  privateTitle?: string;
  publicTitle?: string;
  privateItems: InspectorRow[];
  publicItems: InspectorRow[];
  disclosed?: InspectorRow;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'privacy-inspector compact' : 'privacy-inspector'}>
      <div className="privacy-inspector-heading">
        <h2>Privacy Inspector</h2>
        <p className="pi-subtitle">
          {compact ? "What was checked, vs. what's on-chain" : 'Every value held privately, set side by side with the only thing this call actually reveals.'}
        </p>
      </div>

      {compact ? (
        <>
          <div className="privacy-column-label private-label">{privateTitle.toUpperCase()}</div>
          <PrivateBox items={privateItems} />
          <div className="privacy-pivot-compact">
            <div className="pivot-badge pivot-badge-sm">ZK</div>
            <span>zero-knowledge proof</span>
          </div>
          <div className="privacy-column-label public-label">{publicTitle.toUpperCase()}</div>
          <PublicBox items={publicItems} />
        </>
      ) : (
        <div className="privacy-columns">
          <div className="privacy-column private-column">
            <div className="privacy-column-label">{privateTitle.toUpperCase()}</div>
            <PrivateBox items={privateItems} />
          </div>

          <div className="privacy-pivot">
            <div className="pivot-line" />
            <div className="pivot-badge">ZK</div>
            <div className="pivot-line" />
          </div>

          <div className="privacy-column public-column">
            <div className="privacy-column-label">{publicTitle.toUpperCase()}</div>
            <PublicBox items={publicItems} />
          </div>
        </div>
      )}

      {disclosed && (
        <div className="privacy-disclosed">
          <span>Disclosed by this circuit call — the only thing that crossed the line:</span>
          <strong>
            {disclosed.label}: {disclosed.value}
          </strong>
        </div>
      )}
    </div>
  );
}
