// Real Midnight SDK calls for the verifier — completely separate process
// and identity from bridge/src/midnight.ts, though necessarily similar in
// shape (same SDK, same kind of real proof-generation work). Two tiers,
// matching the prior Assay project's Verifier/Consumer split:
//
//  - verify*Bundle: witness-gated, needs a real recipientSecret + a valid
//    token, produces a real transaction (proof + submission) — same
//    ProvableCircuits requirement as submit/issue on the institution side.
//  - getRecordStatus: a PLAIN PUBLIC LEDGER READ. recordRegistry is
//    `export ledger` in gnuhealth_disclosure.compact specifically so this
//    needs no witness, no proof, no wallet at all — mirrors Assay's
//    consumerVerify.ts exactly (batchRegistry -> recordRegistry,
//    recalled -> withdrawn).
//
// Fee-paying wallet note: verify*Bundle calls still cost a real transaction
// fee on this local devnet, and the only wallet known to hold funds locally
// is the genesis-seeded one (no faucet exists for 'undeployed'). Reusing it
// here for FEES ONLY does not compromise the verifier's real identity
// separation from the institution — the privacy-relevant identity is the
// recipientSecret used inside the circuit witness (see witnesses.ts), which
// is genuinely independent, generated fresh in the verifier's own browser
// (see verifier/web/src/lib/identity.ts) and never shared with or derived
// from the institution's bridge.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

import {
  findDeployedContract,
  type ContractProviders,
  type FoundContract,
} from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import type { FinalizedTxData } from '@midnight-ntwrk/midnight-js-types';
import {
  CostModel,
  QueryContext,
  createConstructorContext,
  dummyContractAddress,
} from '@midnight-ntwrk/compact-runtime';

import { Contract as GnuhealthContractClass, ledger, type Witnesses } from '@gnuhealth-midnight/contracts';
import { LOCAL_DEVNET, GENESIS_SEED } from './network.js';
import { createWallet, type WalletContext } from './wallet.js';
import { recipientWitnesses, type PrivateState } from './witnesses.js';

// @ts-expect-error Node has no global WebSocket the wallet SDK will use.
globalThis.WebSocket = WebSocket;

type ContractInstance = InstanceType<typeof GnuhealthContractClass<PrivateState>>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// verifier/server/src/midnight.ts -> ../../../contracts/managed/gnuhealth_disclosure
const zkConfigPath = path.resolve(__dirname, '..', '..', '..', 'contracts', 'managed', 'gnuhealth_disclosure');
const contractPath = path.join(zkConfigPath, 'contract', 'index.js');

function compileGnuhealthContract(witnesses: Witnesses<PrivateState>) {
  if (!fs.existsSync(contractPath)) {
    throw new Error(`Contract not compiled — run \`npm run compile -w contracts\` first (looked in ${zkConfigPath})`);
  }
  return CompiledContract.make<ContractInstance>('gnuhealth_disclosure', GnuhealthContractClass).pipe(
    CompiledContract.withCompiledFileAssets(zkConfigPath),
    CompiledContract.withWitnesses(witnesses),
  );
}

let walletPromise: Promise<WalletContext> | null = null;
function getWallet(): Promise<WalletContext> {
  if (!walletPromise) {
    walletPromise = createWallet({ networkConfig: LOCAL_DEVNET, seed: GENESIS_SEED }).then(async (walletCtx) => {
      await walletCtx.wallet.waitForSyncedState();
      return walletCtx;
    });
  }
  return walletPromise;
}

async function getProviders(): Promise<ContractProviders<ContractInstance>> {
  const walletCtx = await getWallet();
  const privateStatePassword = 'Local-Devnet-Development-Placeholder-1';
  const walletProvider = {
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: unknown, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx as never,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: unknown) => walletCtx.wallet.submitTransaction(tx as never),
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'gnuhealth-midnight-verifier-state',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(LOCAL_DEVNET.indexer, LOCAL_DEVNET.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(LOCAL_DEVNET.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  } as unknown as ContractProviders<ContractInstance>;
}

/** Pure function of the secret — computed locally, no transaction (mirrors bridge's identical need; see that file for why this can't go through callTx). */
export function deriveRecipientPubKeyLocally(recipientSecret: Uint8Array): Uint8Array {
  const contract = new GnuhealthContractClass<PrivateState>(recipientWitnesses(recipientSecret));
  const constructorContext = createConstructorContext<PrivateState>({}, '0'.repeat(64));
  const { currentPrivateState, currentContractState, currentZswapLocalState } =
    contract.initialState(constructorContext);
  const queryContext = new QueryContext(currentContractState.data, dummyContractAddress());
  const { result } = contract.circuits.deriveRecipientPubKey({
    currentPrivateState,
    currentZswapLocalState,
    currentQueryContext: queryContext,
    costModel: CostModel.initialCostModel(),
  });
  return result;
}

async function joinAsRecipient(contractAddress: string, recipientSecret: Uint8Array): Promise<FoundContract<ContractInstance>> {
  const providers = await getProviders();
  const compiled = compileGnuhealthContract(recipientWitnesses(recipientSecret));
  // privateStateId scoped by secret: this one server may be asked to act as
  // many different real recipients over its lifetime (each a genuinely
  // different verifier hitting this same local devnet), and reusing one ID
  // across different secrets is exactly the collision bridge/ hit and fixed
  // in Prompt 3.5 ("No private state found") — scoping avoids it here too.
  const privateStateId = `verifier-${Buffer.from(recipientSecret).toString('hex')}`;
  return findDeployedContract(providers, {
    compiledContract: compiled,
    contractAddress,
    privateStateId,
    initialPrivateState: {},
  });
}

export interface VerifyResult {
  readonly pass: boolean;
  readonly tx: FinalizedTxData;
}

export async function verifyVaccinationBundle(args: {
  contractAddress: string;
  recipientSecret: Uint8Array;
  tokenId: Uint8Array;
  recordId: Uint8Array;
  requiredVaccineId: Uint8Array;
  vaccination: {
    vaccineId: Uint8Array;
    dose: bigint;
    administeredDate: bigint;
    hasNextDose: boolean;
    nextDoseDate: bigint;
    completed: boolean;
  };
  vaccinationSalt: Uint8Array;
}): Promise<VerifyResult> {
  const contract = await joinAsRecipient(args.contractAddress, args.recipientSecret);
  const result = await contract.callTx.verifyVaccinationBundle(
    args.tokenId,
    args.recordId,
    args.requiredVaccineId,
    args.vaccination,
    args.vaccinationSalt,
  );
  return { pass: result.private.result, tx: result.public };
}

export async function verifyLabResultBundle(args: {
  contractAddress: string;
  recipientSecret: Uint8Array;
  tokenId: Uint8Array;
  recordId: Uint8Array;
  requiredTestTypeId: Uint8Array;
  labResult: {
    testTypeId: Uint8Array;
    resultValue: bigint;
    rangeLow: bigint;
    rangeHigh: bigint;
    analysisDate: bigint;
  };
  labResultSalt: Uint8Array;
}): Promise<VerifyResult> {
  const contract = await joinAsRecipient(args.contractAddress, args.recipientSecret);
  const result = await contract.callTx.verifyLabResultBundle(
    args.tokenId,
    args.recordId,
    args.requiredTestTypeId,
    args.labResult,
    args.labResultSalt,
  );
  return { pass: result.private.result, tx: result.public };
}

export async function verifyCriticalFlagsBundle(args: {
  contractAddress: string;
  recipientSecret: Uint8Array;
  tokenId: Uint8Array;
  recordId: Uint8Array;
  criticalFlags: {
    critDbt: boolean;
    critCardio: boolean;
    critAllergic: boolean;
    critCancer: boolean;
    critImmuno: boolean;
    critMental: boolean;
    critNutrition: boolean;
    critSocial: boolean;
    critCognitive: boolean;
  };
  criticalFlagsSalt: Uint8Array;
  requestedFlag: bigint;
}): Promise<VerifyResult> {
  const contract = await joinAsRecipient(args.contractAddress, args.recipientSecret);
  const result = await contract.callTx.verifyCriticalFlagsBundle(
    args.tokenId,
    args.recordId,
    args.criticalFlags,
    args.criticalFlagsSalt,
    args.requestedFlag,
  );
  return { pass: result.private.result, tx: result.public };
}

export interface RecordStatus {
  readonly exists: boolean;
  readonly withdrawn: boolean;
}

/** Plain public read — no witness, no proof, no wallet. See header comment. */
export async function getRecordStatus(contractAddress: string, recordId: Uint8Array): Promise<RecordStatus> {
  const publicDataProvider = indexerPublicDataProvider(LOCAL_DEVNET.indexer, LOCAL_DEVNET.indexerWS);
  const state = await publicDataProvider.queryContractState(contractAddress);
  if (!state) return { exists: false, withdrawn: false };
  const publicState = ledger(state.data);
  const exists = publicState.recordRegistry.member(recordId);
  if (!exists) return { exists: false, withdrawn: false };
  const record = publicState.recordRegistry.lookup(recordId);
  return { exists: true, withdrawn: record.withdrawn };
}
