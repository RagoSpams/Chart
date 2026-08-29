// Same local devnet as bridge/src/network.ts — the verifier reads from the
// SAME public Midnight ledger the institution writes to (that's the whole
// point: one shared chain, two independent parties). What's separate is the
// PROCESS and the IDENTITY, not the network. Duplicated rather than
// imported from bridge/ on purpose — see this package's README/PLAN.md
// entry for why: a real verifier has no dependency on the institution's own
// service at all, so this package must stand on its own.

export type NetworkId = 'undeployed' | 'preview' | 'preprod';

export interface NetworkConfig {
  networkId: NetworkId;
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
}

export const LOCAL_DEVNET: NetworkConfig = {
  networkId: 'undeployed',
  indexer: 'http://127.0.0.1:8089/api/v4/graphql',
  indexerWS: 'ws://127.0.0.1:8089/api/v4/graphql/ws',
  node: 'ws://127.0.0.1:9945',
  proofServer: 'http://127.0.0.1:6301',
};

// Fee-paying wallet only — see midnight.ts's header comment for why reusing
// the genesis seed here does not compromise the verifier's real identity
// separation from the institution.
export const GENESIS_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
