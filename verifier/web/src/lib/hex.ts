// Shared byte<->hex helpers, mirroring the prior Assay project's sdk/hex.ts.
// This app has no server-side WASM contract binding to import types from
// (unlike bridge/verifier-server), so it keeps its own tiny copy rather than
// depending on @gnuhealth-midnight/contracts just for this.

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Tolerates an optional leading `0x`/`0X`. */
export function hexToBytes(hex: string): Uint8Array {
  const unprefixed = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  if (unprefixed.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(unprefixed)) {
    throw new Error(`Invalid hex string: ${hex}`);
  }
  const bytes = new Uint8Array(unprefixed.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(unprefixed.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** A fresh random 32-byte value — used for generating a new verifier identity secret. */
export function randomBytes32(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}
