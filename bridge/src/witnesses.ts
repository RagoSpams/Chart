// Builds the Witnesses object a Contract instance needs, for each of the
// two roles gnuhealth_disclosure.compact defines witnesses for. Mirrors
// Assay's witnesses.ts exactly, renamed to this contract's actual witness
// names (institutionSecret/recipientSecret).

import type { Witnesses } from '@gnuhealth-midnight/contracts';

// NOT `null`: midnight-js-contracts' getStates() does
// `assertDefined(privateState, ...)` on whatever the private-state provider
// returns, and assertDefined throws on `null` specifically (confirmed in
// @midnight-ntwrk/midnight-js-utils' source) — so a contract using `null` as
// its real PrivateState value can never pass that check once deployed for
// real, even though the value was stored correctly. An empty object is a
// private state as functionally inert as null for this contract (neither
// witness reads or writes it), but round-trips through the provider without
// tripping the null check.
export type PrivateState = Record<string, never>;

export function institutionWitnesses(institutionSecret: Uint8Array): Witnesses<PrivateState> {
  return {
    institutionSecret: (context) => [context.privateState, institutionSecret],
    recipientSecret: () => {
      throw new Error('recipientSecret was called on an institution-role client — wrong witness set for this circuit');
    },
  };
}

export function recipientWitnesses(recipientSecret: Uint8Array): Witnesses<PrivateState> {
  return {
    recipientSecret: (context) => [context.privateState, recipientSecret],
    institutionSecret: () => {
      throw new Error('institutionSecret was called on a recipient-role client — wrong witness set for this circuit');
    },
  };
}
