// Minimal local test harness for running gnuhealth_disclosure circuits
// against an in-memory contract instance — no proof server, no devnet, no
// wallet. Adapted directly from the prior Assay project's harness (same
// underlying @midnight-ntwrk/compact-runtime primitives), with roles
// renamed to fit this project: manufacturer -> institution, batch -> record.

import {
  CostModel,
  QueryContext,
  createConstructorContext,
  dummyContractAddress,
  type CircuitContext,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, type Ledger, type Witnesses } from '../managed/gnuhealth_disclosure/contract/index.js';

// This contract's witnesses never read or write anything beyond the value
// they return (each secret is a fixed identity key) — so there's no
// meaningful private state to track between calls.
export type PrivateState = null;

// Matches the all-zero dummy coin public key OpenZeppelin's compact-tools
// simulator uses for local/dry contract testing.
const DUMMY_COIN_PUBLIC_KEY = '0'.repeat(64);

// Default "current" block time for every fresh TestEnv — an arbitrary but
// fixed Unix timestamp (2023-11-14T22:13:20Z) so fixture data
// (administeredDate/nextDoseDate/analysisDate/expiryTime) has a stable
// anchor to sit before/after. Change it per-test via setBlockTime.
export const DEFAULT_BLOCK_TIME = 1_700_000_000n;

export interface TestEnv {
  contract: Contract<PrivateState>;
  context: CircuitContext<PrivateState>;
  getLedger(): Ledger;
}

export function deployForTest(witnesses: Witnesses<PrivateState>): TestEnv {
  const contract = new Contract<PrivateState>(witnesses);
  const contractAddress = dummyContractAddress();

  const constructorContext = createConstructorContext<PrivateState>(null, DUMMY_COIN_PUBLIC_KEY);
  const { currentPrivateState, currentContractState, currentZswapLocalState } =
    contract.initialState(constructorContext);

  const queryContext = new QueryContext(currentContractState.data, contractAddress);
  // `.block` is a getter/setter pair, not a plain field — it returns a fresh
  // snapshot object on every read, so mutating a field on that snapshot is
  // silently discarded. Reassigning the whole property is what actually
  // reaches the underlying context.
  queryContext.block = { ...queryContext.block, secondsSinceEpoch: DEFAULT_BLOCK_TIME };

  const env: TestEnv = {
    contract,
    context: {
      currentPrivateState,
      currentZswapLocalState,
      currentQueryContext: queryContext,
      costModel: CostModel.initialCostModel(),
    },
    getLedger(): Ledger {
      return ledger(env.context.currentQueryContext.state);
    },
  };
  return env;
}

/**
 * Sets the "current" block time seen by kernel.blockTimeLessThan/GreaterThan
 * for this env's NEXT circuit call. Each circuit call returns a fresh
 * CircuitContext, so this needs to be called again before any later call
 * that also needs a custom time.
 */
export function setBlockTime(env: TestEnv, secondsSinceEpoch: bigint): void {
  const qc = env.context.currentQueryContext;
  qc.block = { ...qc.block, secondsSinceEpoch };
}

/** A witness set for an institution role: only institutionSecret is ever called. */
export function witnessesAsInstitution(secret: Uint8Array): Witnesses<PrivateState> {
  return {
    institutionSecret: (context) => [context.privateState, secret],
    recipientSecret: () => {
      throw new Error('recipientSecret should not be called on an institution-role contract in tests');
    },
  };
}

/** A witness set for a token-recipient role: only recipientSecret is ever called. */
export function witnessesAsRecipient(secret: Uint8Array): Witnesses<PrivateState> {
  return {
    recipientSecret: (context) => [context.privateState, secret],
    institutionSecret: () => {
      throw new Error('institutionSecret should not be called on a recipient-role contract in tests');
    },
  };
}

/**
 * A second Contract instance bound to different witnesses, for exercising
 * "wrong caller" paths against an existing TestEnv's ledger state. Witnesses
 * live on the Contract instance; ledger state lives in the CircuitContext
 * passed to each call — so calling `otherParty(env, w).circuits.X(env.context, ...)`
 * models a different party (their own secret) transacting against the same
 * on-chain state, exactly as it would with two separate real wallets.
 * `env` isn't read here — it's a parameter purely so call sites read as
 * "a party acting against this env", matching how every call site uses it.
 */
export function otherParty(_env: TestEnv, witnesses: Witnesses<PrivateState>): Contract<PrivateState> {
  return new Contract<PrivateState>(witnesses);
}

/** Deterministic 32-byte test value from a short label, for readable test data. */
export function bytes32(label: string): Uint8Array {
  const out = new Uint8Array(32);
  out.set(new TextEncoder().encode(label).slice(0, 32));
  return out;
}
