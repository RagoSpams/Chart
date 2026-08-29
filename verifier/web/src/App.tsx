import { useEffect, useState } from 'react';
import './App.css';
import { checkHealth, getServerUrl, setServerUrl } from './lib/api.js';
import { VerifierView } from './components/VerifierView.js';
import { ConsumerView } from './components/ConsumerView.js';

const TABS = [
  { id: 'verifier', label: 'Verifier' },
  { id: 'consumer', label: 'Consumer check' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function ServerStatus() {
  const [url, setUrl] = useState(getServerUrl());
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkHealth().then((ok) => !cancelled && setHealthy(ok));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="server-status">
      <span className={healthy ? 'ok-dot' : 'danger-dot'} />
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={() => setServerUrl(url)}
        title="verifier-server URL — this app talks only to this, never to the institution's bridge"
      />
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('verifier');

  return (
    <div className="page">
      <header className="app-header">
        <div className="wordmark-row">
          <span className="wordmark">GNU Health Disclosure Verifier</span>
          <span className="eyebrow">ZERO-KNOWLEDGE SCOPED DISCLOSURE · BUILT ON MIDNIGHT</span>
        </div>
        <ServerStatus />
      </header>
      <nav className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main className="panel">
        {activeTab === 'verifier' && <VerifierView />}
        {activeTab === 'consumer' && <ConsumerView />}
      </main>
    </div>
  );
}

export default App;
