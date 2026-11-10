import { instrumentProvider } from './diagnostics.js';
// Deploys the compiled gnuhealth_disclosure contract to this project's own
// local Midnight devnet (docker-compose.yml) and exposes typed wrappers
// around its callable circuits. Real proof generation via the running
// proof-server, real submission via a genesis-seeded local wallet, real
// indexer-backed contract state — adapted from create-mn-app's deploy.ts
// (wallet/DUST bootstrap) and the prior Assay project's client.ts (typed
// circuit-call wrapper shape).
//
// Deliberately isolated from GNU Health/Tryton: every endpoint that uses
// this module supplies synthetic data constructed in this bridge service
// (see syntheticData.ts), never anything pulled from a real GNU Health
// instance.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';

import {
  CostModel,
  QueryContext,
  createConstructorContext,
  dummyContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import {
  deployContract,
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

// Static import (not a dynamic file-path import) — matching the prior
// Assay project's client.ts exactly. This is what lets CompiledContract.make's
// explicit type argument below actually resolve circuit method names on
// FoundContract/callTx; a dynamically `await import()`-ed module's type
// degrades to `any`, which cascades into `never` through the pipe below.
import { Contract as GnuhealthContractClass, type Witnesses } from '@gnuhealth-midnight/contracts';
import { LOCAL_DEVNET, GENESIS_SEED } from './network.js';
import { createWallet, unshieldedToken, type WalletContext } from './wallet.js';
import { institutionWitnesses, recipientWitnesses, type PrivateState } from './witnesses.js';
import type { CriticalFlags, LabResult, Vaccination } from './syntheticData.js';

// Required for wallet sync (matches create-mn-app's deploy.ts exactly).
// @ts-expect-error Node has no global WebSocket the wallet SDK will use.
globalThis.WebSocket = WebSocket;

// Two distinct IDs, not one: the institution-role and recipient-role
// FoundContract bindings below share a single process/wallet/private-state
// provider (this bridge plays both parties for the isolated integration
// test) — Assay's real client.ts never had this collision because each role
// there ran in its own separate process with its own on-disk store. Reusing
// one ID for both caused "No private state found" once the second
// registration overwrote the first's entry.
const INSTITUTION_PRIVATE_STATE_ID = 'gnuhealthDisclosurePrivateState-institution';
const RECIPIENT_PRIVATE_STATE_ID = 'gnuhealthDisclosurePrivateState-recipient';

type ContractInstance = InstanceType<typeof GnuhealthContractClass<PrivateState>>;

async function waitForProofServer(maxAttempts = 60, delayMs = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fetch(LOCAL_DEVNET.proofServer, { method: 'GET', signal: AbortSignal.timeout(3000) });
      return true;
    } catch (err: unknown) {
      const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code ?? '';
      if (code !== 'ECONNREFUSED' && code !== 'UND_ERR_CONNECT_TIMEOUT' && code !== 'UND_ERR_SOCKET') return true;
    }
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// bridge/src/midnight.ts -> ../../contracts/managed/gnuhealth_disclosure
const zkConfigPath = path.resolve(__dirname, '..', '..', 'contracts', 'managed', 'gnuhealth_disclosure');
const contractPath = path.join(zkConfigPath, 'contract', 'index.js');

// Persists the deployed contract's address across bridge restarts. Without
// this, every fresh process's first request re-ran deployContract and
// minted a brand-new address — harmless in isolated testing, but wrong for
// a demo where Tryton, the verifier app, and whoever's watching all need to
// agree on ONE contract for the whole session. Local file, not committed —
// it's only valid for this specific local devnet's chain state, and a
// `docker compose down -v` / fresh devnet invalidates it same as any other
// on-chain state.
const deployedContractPath = process.env.CHART_DEPLOYMENT_FILE || path.resolve(__dirname, '..', 'deployed-contract.json');

function readPersistedContractAddress(): string | null {
  try {
    const raw = fs.readFileSync(deployedContractPath, 'utf-8');
    const parsed = JSON.parse(raw) as { contractAddress?: string };
    return parsed.contractAddress ?? null;
  } catch {
    return null;
  }
}

function persistContractAddress(contractAddress: string): void {
  fs.writeFileSync(deployedContractPath, JSON.stringify({ contractAddress }, null, 2) + '\n');
}

function compileGnuhealthContract(witnesses: Witnesses<PrivateState>) {
  if (!fs.existsSync(contractPath)) {
    throw new Error(`Contract not compiled — run \`npm run compile -w contracts\` first (looked in ${zkConfigPath})`);
  }
  return CompiledContract.make<ContractInstance>('gnuhealth_disclosure', GnuhealthContractClass).pipe(
    CompiledContract.withCompiledFileAssets(zkConfigPath),
    CompiledContract.withWitnesses(witnesses),
  );
}

async function createProviders(walletCtx: WalletContext): Promise<ContractProviders<ContractInstance>> {
  const privateStatePassword = process.env.CHART_PRIVATE_STATE_PASSWORD;
  if (!privateStatePassword || privateStatePassword.length < 32) throw new Error('CHART_PRIVATE_STATE_PASSWORD must contain at least 32 characters');
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
      midnightDbName: process.env.CHART_PRIVATE_STATE_DIR || 'bridge-state',
      privateStateStoreName: 'gnuhealth-midnight-bridge-state',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: instrumentProvider(indexerPublicDataProvider(LOCAL_DEVNET.indexer, LOCAL_DEVNET.indexerWS), 'bridge.indexer'),
    zkConfigProvider,
    proofProvider: instrumentProvider(httpClientProofProvider(LOCAL_DEVNET.proofServer, zkConfigProvider), 'bridge.proof'),
    walletProvider: instrumentProvider(walletProvider, 'bridge.wallet'),
    midnightProvider: instrumentProvider(walletProvider, 'bridge.wallet'),
  } as unknown as ContractProviders<ContractInstance>;
}

async function fundedWallet(): Promise<WalletContext> {
  const walletCtx = await createWallet({ networkConfig: LOCAL_DEVNET, seed: GENESIS_SEED });

  console.log('[bridge] syncing genesis wallet with local devnet...');
  const state = await walletCtx.wallet.waitForSyncedState();
  const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  console.log(`[bridge] wallet synced. Balance: ${balance.toLocaleString()} tNight`);
  if (balance === 0n) {
    throw new Error(
      'Genesis-seed wallet has zero NIGHT — the devnet may not have minted to it. Check `docker compose ps` / `docker compose logs node`.',
    );
  }

  const dustState = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  const unregisteredUtxos = dustState.unshielded.availableCoins.filter(
    (c: { meta?: { registeredForDustGeneration?: boolean } }) => !c.meta?.registeredForDustGeneration,
  );
  if (unregisteredUtxos.length > 0) {
    console.log(`[bridge] registering ${unregisteredUtxos.length} NIGHT UTXOs for DUST generation...`);
    const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
      unregisteredUtxos,
      walletCtx.unshieldedKeystore.getPublicKey(),
      (payload: unknown) => walletCtx.unshieldedKeystore.signData(payload as never),
    );
    const finalized = await walletCtx.wallet.finalizeRecipe(recipe);
    await walletCtx.wallet.submitTransaction(finalized);
  }

  if (dustState.dust.balance(new Date()) === 0n) {
    console.log('[bridge] waiting for DUST tokens...');
    await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.throttleTime(5000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      ),
    );
  }
  console.log('[bridge] DUST ready.');

  return walletCtx;
}

export interface VerifyResult {
  readonly pass: boolean;
  readonly tx: FinalizedTxData;
}

export class GnuhealthDisclosureClient {
  private constructor(
    private readonly asInstitution: FoundContract<ContractInstance>,
    private readonly asRecipient: FoundContract<ContractInstance>,
    private readonly recipientPubKey: Uint8Array,
  ) {}

  static async deploy(): Promise<GnuhealthDisclosureClient> {
    console.log('[bridge] checking proof server...');
    if (!(await waitForProofServer())) {
      throw new Error(`Proof server unreachable at ${LOCAL_DEVNET.proofServer}. Run: npm run devnet:up`);
    }

    const walletCtx = await fundedWallet();
    const providers = await createProviders(walletCtx);

    const secretHex = process.env.CHART_INSTITUTION_SECRET;
    if (!secretHex || !/^[a-f0-9]{64}$/i.test(secretHex)) throw new Error('Set CHART_INSTITUTION_SECRET to 32 random bytes encoded as hex');
    const institutionSecret = new Uint8Array(Buffer.from(secretHex, 'hex'));
    const recipientSecret = paddedSecret('BRIDGE-TEST-RECIPIENT-A');

    const compiledForInstitution = compileGnuhealthContract(institutionWitnesses(institutionSecret));

    const persistedAddress = readPersistedContractAddress();
    let asInstitution: FoundContract<ContractInstance>;
    if (persistedAddress) {
      console.log(`[bridge] reusing persisted contract at ${persistedAddress}...`);
      asInstitution = await findDeployedContract(providers, {
        compiledContract: compiledForInstitution,
        contractAddress: persistedAddress,
        privateStateId: INSTITUTION_PRIVATE_STATE_ID,
        initialPrivateState: {},
      });
    } else {
      console.log('[bridge] no persisted contract found — deploying gnuhealth_disclosure contract...');
      const deployed = await deployContract(providers, {
        compiledContract: compiledForInstitution,
        privateStateId: INSTITUTION_PRIVATE_STATE_ID,
        initialPrivateState: {},
      });
      asInstitution = deployed;
      persistContractAddress(deployed.deployTxData.public.contractAddress);
    }
    const contractAddress = asInstitution.deployTxData.public.contractAddress;
    console.log(`[bridge] contract address: ${contractAddress}`);

    const compiledForRecipient = compileGnuhealthContract(recipientWitnesses(recipientSecret));
    const asRecipient = await findDeployedContract(providers, {
      compiledContract: compiledForRecipient,
      contractAddress,
      privateStateId: RECIPIENT_PRIVATE_STATE_ID,
      initialPrivateState: {},
    });

    const recipientPubKey = deriveRecipientPubKeyLocally(recipientSecret);

    return new GnuhealthDisclosureClient(asInstitution, asRecipient, recipientPubKey);
  }

  get contractAddress(): string {
    return this.asInstitution.deployTxData.public.contractAddress;
  }

  /** Pure function of this bridge's fixed synthetic recipient secret — computed locally, no transaction involved. */
  async deriveRecipientPubKey(): Promise<Uint8Array> {
    return this.recipientPubKey;
  }

  async submitRecordBundle(args: {
    recordId: Uint8Array;
    vaccination: Vaccination;
    vaccinationSalt: Uint8Array;
    labResult: LabResult;
    labResultSalt: Uint8Array;
    criticalFlags: CriticalFlags;
    criticalFlagsSalt: Uint8Array;
  }): Promise<FinalizedTxData> {
    const { public: tx } = await this.asInstitution.callTx.submitRecordBundle(
      args.recordId,
      args.vaccination,
      args.vaccinationSalt,
      args.labResult,
      args.labResultSalt,
      args.criticalFlags,
      args.criticalFlagsSalt,
    );
    return tx;
  }

  async issueDisclosureToken(args: {
    tokenId: Uint8Array;
    recordId: Uint8Array;
    grantVaccination: boolean;
    grantLabResult: boolean;
    grantCriticalFlags: boolean;
    expiryTime: bigint;
    recipientPubKey: Uint8Array;
  }): Promise<FinalizedTxData> {
    const { public: tx } = await this.asInstitution.callTx.issueDisclosureToken(
      args.tokenId,
      args.recordId,
      args.grantVaccination,
      args.grantLabResult,
      args.grantCriticalFlags,
      args.expiryTime,
      args.recipientPubKey,
    );
    return tx;
  }

  async revokeToken(tokenId: Uint8Array): Promise<FinalizedTxData> {
    return (await this.asInstitution.callTx.revokeToken(tokenId)).public;
  }

  async withdrawRecordBundle(recordId: Uint8Array): Promise<FinalizedTxData> {
    return (await this.asInstitution.callTx.withdrawRecordBundle(recordId)).public;
  }

  async verifyVaccinationBundle(args: {
    tokenId: Uint8Array;
    recordId: Uint8Array;
    requiredVaccineId: Uint8Array;
    vaccination: Vaccination;
    vaccinationSalt: Uint8Array;
  }): Promise<VerifyResult> {
    const result = await this.asRecipient.callTx.verifyVaccinationBundle(
      args.tokenId,
      args.recordId,
      args.requiredVaccineId,
      args.vaccination,
      args.vaccinationSalt,
    );
    return { pass: result.private.result, tx: result.public };
  }

  async verifyLabResultBundle(args: {
    tokenId: Uint8Array;
    recordId: Uint8Array;
    requiredTestTypeId: Uint8Array;
    labResult: LabResult;
    labResultSalt: Uint8Array;
  }): Promise<VerifyResult> {
    const result = await this.asRecipient.callTx.verifyLabResultBundle(
      args.tokenId,
      args.recordId,
      args.requiredTestTypeId,
      args.labResult,
      args.labResultSalt,
    );
    return { pass: result.private.result, tx: result.public };
  }

  async verifyCriticalFlagsBundle(args: {
    tokenId: Uint8Array;
    recordId: Uint8Array;
    criticalFlags: CriticalFlags;
    criticalFlagsSalt: Uint8Array;
    requestedFlag: bigint;
  }): Promise<VerifyResult> {
    const result = await this.asRecipient.callTx.verifyCriticalFlagsBundle(
      args.tokenId,
      args.recordId,
      args.criticalFlags,
      args.criticalFlagsSalt,
      args.requestedFlag,
    );
    return { pass: result.private.result, tx: result.public };
  }
}

function paddedSecret(label: string): Uint8Array {
  const out = new Uint8Array(32);
  out.set(new TextEncoder().encode(label).slice(0, 32));
  return out;
}

// deriveRecipientPubKey never touches the ledger, so it's excluded from
// ProvableCircuits entirely (confirmed against the generated
// contract/index.d.ts) — there is no way to call it via callTx/FoundContract
// against the real deployed contract. It's a pure function of the secret,
// so the correct fix is computing it locally with the raw compact-runtime
// interface — the exact technique contracts/test/harness.ts and the prior
// Assay project's localNetwork.ts use for in-memory circuit calls — rather
// than trying to force it through the real-transaction path.
const DUMMY_COIN_PUBLIC_KEY = '0'.repeat(64);

function deriveRecipientPubKeyLocally(recipientSecret: Uint8Array): Uint8Array {
  const contract = new GnuhealthContractClass<PrivateState>(recipientWitnesses(recipientSecret));
  const constructorContext = createConstructorContext<PrivateState>({}, DUMMY_COIN_PUBLIC_KEY);
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
