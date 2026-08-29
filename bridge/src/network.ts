// Local-devnet network config for the bridge service. Trimmed from
// create-mn-app's network.ts (verified 2026-08-27, same run that produced
// docker-compose.yml): no mnemonic/public-network/CLI-switching machinery,
// since the bridge only ever talks to this project's own local devnet
// (ports offset +1 from the template's defaults — see docker-compose.yml).

// Same NetworkId union create-mn-app's own network.ts declares — we only
// ever use 'undeployed' (the local devnet), but keep the exact type rather
// than a narrower one so it stays assignable to setNetworkId/getNetworkId.
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

// The well-known genesis seed create-mn-app's own network.ts uses for the
// 'undeployed' (local devnet) network — a local 'dev'-preset devnet mints
// NIGHT to this seed's wallet at genesis specifically so scripts like this
// one can deploy/transact without a faucet or a real funded account.
export const GENESIS_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
