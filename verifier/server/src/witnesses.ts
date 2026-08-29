// The verifier only ever needs the recipient role — it never submits a
// record bundle or issues a token, so institutionSecret is never called.

import type { Witnesses } from '@gnuhealth-midnight/contracts';

export type PrivateState = Record<string, never>;

export function recipientWitnesses(recipientSecret: Uint8Array): Witnesses<PrivateState> {
  return {
    recipientSecret: (context) => [context.privateState, recipientSecret],
    institutionSecret: () => {
      throw new Error('institutionSecret was called on the verifier — it should never need the institution role');
    },
  };
}
