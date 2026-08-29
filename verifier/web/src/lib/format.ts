import { bytesToHex } from './hex.js';

/** `0x1a2b…9f00` — enough to eyeball-distinguish IDs without wrapping the layout. */
export function shortHex(bytes: Uint8Array): string {
  const hex = bytesToHex(bytes);
  return `0x${hex.slice(0, 6)}…${hex.slice(-4)}`;
}

export function fullHex(bytes: Uint8Array): string {
  return `0x${bytesToHex(bytes)}`;
}

/** Renders a contract `expiryTime`/`analysisDate`/`administeredDate` (Unix seconds, arriving as a JSON string from verifier-server) as a local datetime. */
export function formatUnixSeconds(seconds: number | bigint | string): string {
  return new Date(Number(seconds) * 1000).toLocaleString();
}

/** Best-effort human label for a Bytes<32>-ish field originally typed as text (vaccineId, testTypeId) — falls back to hex for anything that isn't printable ASCII. */
export function bytes32ToLabel(bytes: Uint8Array): string {
  const text = new TextDecoder()
    .decode(bytes)
    .replace(/\0+$/, '');
  return /^[\x20-\x7e]+$/.test(text) ? text : shortHex(bytes);
}
