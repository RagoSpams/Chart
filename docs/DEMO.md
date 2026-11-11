# Demo walkthrough — synthetic records only

[← Project overview](../README.md) · [Development setup](DEVELOPMENT.md) · [Architecture](ARCHITECTURE.md)

The goal is to show a **verifiable claim** without making the original medical measurement a public ledger value. This is a developer demonstration, not a patient-facing service.

## Option A: automated local end-to-end run

After completing the prerequisites in [Development](DEVELOPMENT.md) and starting Docker:

```sh
npm ci --ignore-scripts
npm test
npm run devnet:up
npm run test:e2e
```

The E2E runner starts independent local bridge and verifier processes, deploys a fresh contract, exercises synthetic vaccination/lab/flag flows, and checks specific authorization rejections for recipient mismatch, token expiration/revocation and record withdrawal. The proof/finalization workflow uses real local Midnight services. It is time-bounded; a timeout is **a failed run**, not evidence of success.

## Option B: explore the local browser UI

Complete the install/compile steps and start the devnet above first. Create local credentials once (skip this if your checkout already has its generated `.env`):

```sh
node scripts/create-local-env.mjs
```

Open **three terminals**, each from the repository root, and run one command in each:

```sh
node --env-file=.env --import tsx bridge/src/index.ts
node --env-file=.env --import tsx verifier/server/src/index.ts
npm run dev:verifier-web
```

## Prepare a browser handoff

There is no institution-facing UI, and the verifier UI displays only a shortened public key. This command creates a matching synthetic recipient identity, derives its full public key, submits the default fictional record, and issues a one-hour **lab-only** token through the authenticated bridge. Run it from the repository root in PowerShell 7 or a POSIX shell while the services above are running. Initial deployment and proof generation can take several minutes.

```sh
node --env-file=.env --input-type=module -e '
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const apiKey = process.env.CHART_BRIDGE_API_KEY;
if (!apiKey) throw new Error("Missing local bridge API key");
async function post(port, route, body, authenticated = false) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(600000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${route}: HTTP ${response.status}; ${result.error}`);
  return result;
}
const recipientSecret = randomBytes(32).toString("hex");
const { recipientPubKey } = await post(4200, "/derive-pubkey", { recipientSecret });
const record = await post(4000, "/record-bundle", {}, true);
const token = await post(4000, "/disclosure-token", {
  recordId: record.recordId, recipientPubKey,
  grantVaccination: false, grantLabResult: true, grantCriticalFlags: false
}, true);
await mkdir(".validation", { recursive: true });
await writeFile(".validation/browser-demo.json", JSON.stringify({
  recipientSecret, recipientPubKey, contractAddress: record.contractAddress,
  recordId: record.recordId, tokenId: token.tokenId,
  bundle: { labResult: record.bundle.labResult, labResultSalt: record.bundle.labResultSalt }
}, null, 2), { mode: 0o600 });
console.log("Private synthetic handoff saved to ignored .validation/browser-demo.json");
'
```

The command deliberately does not print secrets or salts. On Windows, file permissions follow your local account/ACLs; keep this ignored file private. The bridge submission returns all three raw categories to the authenticated caller, but the saved handoff selects only the laboratory category. Tokens do not erase or revoke raw information already shared.

Open [the local UI](http://127.0.0.1:5174) and the private handoff file locally:

1. Copy `recipientSecret` into **Your recipient secret**. Do not use the shortened displayed key as an API public key.
2. Fill the contract address, record ID and token ID from the file.
3. Paste the JSON object inside `bundle` into the bundle input and select the laboratory category.
4. Verify. The default synthetic value is within its committed range, so the result should be true.

Editing the secret changes the current form identity; it does not replace the saved browser identity. Reloading or generating another identity can change the key used for verification. The secret and selected witness are sent to your trusted verifier server; that server and the proof service must be trusted with private inputs. **Never enter the bridge API key in the UI.**

For repeatable expiration, revocation, withdrawal and recipient-mismatch checks, use `npm run test:e2e`. An authorized predicate may return false. That is different from authorization rejection: the verifier maps these four rejection reasons to specific HTTP 403 codes. Other contract failures, including some scope mismatches, currently surface as generic HTTP 500 errors; those are not successful negative-test results.

## Troubleshooting

- **Compiler not found on Windows:** Compact is installed in Ubuntu WSL; Windows `compact.exe` is unrelated. Check `compact compile +0.31.1 --version` from Ubuntu.
- **Docker connection errors:** ensure Docker Desktop/Compose and the local devnet are running; `npm run devnet:logs` shows the service logs.
- **Wrong chain or private-state errors:** reuse matching local configuration and identity for the current chain; do not copy stale deployment metadata across chain resets.
- **Timeout during finalization:** do not automatically resubmit. Check recorded public transaction IDs and diagnostics; the on-chain outcome may be unknown.
- **Missing persisted GNU Health fixture:** follow the separate database and Tryton wizard setup in [Development](DEVELOPMENT.md).
