// Local, wallet-free identity for the verifier's demo: a 32-byte secret
// persisted in localStorage, so reloading the page keeps "you" the same
// regulator/researcher instead of minting a new identity every render.
// Mirrors the prior Assay project's identity.ts exactly — the whole point
// of this file is that it is generated HERE, in the verifier's own browser,
// and never shared with or derived from the institution's bridge. Only its
// derived public key (see api.ts's derivePubKey) is meant to leave this
// device, handed to the institution out of band so they can issue a token
// scoped to it.

import { useEffect, useState } from 'react';
import { bytesToHex, hexToBytes, randomBytes32 } from './hex.js';

const STORAGE_KEY = 'gnuhealth-midnight:verifier:identity';

function loadOrCreateSecret(): Uint8Array {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return hexToBytes(stored);
  const fresh = randomBytes32();
  localStorage.setItem(STORAGE_KEY, bytesToHex(fresh));
  return fresh;
}

/** A stable, localStorage-backed 32-byte secret identifying this verifier. */
export function useVerifierIdentity(): { secret: Uint8Array; regenerate: () => void } {
  const [secret, setSecret] = useState(() => loadOrCreateSecret());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) setSecret(hexToBytes(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function regenerate() {
    const fresh = randomBytes32();
    localStorage.setItem(STORAGE_KEY, bytesToHex(fresh));
    setSecret(fresh);
  }

  return { secret, regenerate };
}
