# Chart

Chart is an experimental, synthetic-data-only GNU Health → authenticated bridge → Midnight contract → independent verifier integration. It commits salted record bundles and verifies recipient-scoped vaccination, laboratory-range and critical-flag predicates. Tokens expire and can be revoked; withdrawal invalidates previously issued tokens.

**Use fictional patients only.** This is a local research demonstration, not clinical software. Read [VALIDATION_REPORT.md](VALIDATION_REPORT.md) for executed checks, known dependency advisories and integration limits. [AUDIT_REPORT.md](AUDIT_REPORT.md) records the earlier review; the validation report supersedes its testing status.

## Tested toolchain

| Component | Version / requirement |
| --- | --- |
| Node.js / npm | Tested with 24.16.0 / 11.13.0; Node >=22.12 required |
| Python | 3.12.10 for GNU Health and encoding tests |
| Compact CLI / compiler | CLI 0.5.1; **compiler 0.31.1**, language 0.23.0 |
| Compact / on-chain runtime | 0.16.0 / **3.0.0**, one shared WASM instance |
| Midnight JS / wallet SDK | 4.1.1 / 1.2.0 |
| Local devnet | node 1.0.0, indexer 4.3.3, proof server 8.1.0 |
| GNU Health / lab / Tryton | 5.0.5 / 5.0.0 / 7.0.61 |
| PostgreSQL | 16.10, dedicated synthetic-only container |

Keep the lockfiles and compiler pin together. The public networks may use a newer stack; this repository targets its **local ledger-8 devnet**, not a public-network deployment. See the official [Compact installation](https://docs.midnight.network/getting-started/installation), [Windows/WSL setup](https://docs.midnight.network/guides/windows-compact-setup), and [compatible 0.31.1 SDK example](https://docs.midnight.network/guides/deploy-and-operate). The root runtime pin prevents two WASM `StateValue` classes from breaking real transactions.

## Install and test

Start Docker Desktop with the Linux engine. On Windows, install Ubuntu in WSL and install Compact **inside Ubuntu**. Windows System32/compact.exe is an unrelated compression utility.

Run these compiler-install commands in Linux/macOS or an Ubuntu WSL shell (the installer is from the pinned official release):

```sh
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.1/compact-installer.sh -o /tmp/compact-installer.sh
sh /tmp/compact-installer.sh
export PATH="$HOME/.local/bin:$PATH"
compact update 0.31.1
compact compile +0.31.1 --version
```

From the repository root, in PowerShell or your regular development shell:

```sh
npm ci --ignore-scripts
npm test
node scripts/check-sensitive-files.mjs
# In a real Git checkout, also audit the proposed tracked release files:
npm run check:release
```

`npm test` runs Node HTTP/security/browser-input tests, Python encoding tests, full Compact compilation and circuit tests, contract-test TypeScript checks, and every workspace build. It needs no devnet. Compilation generates proof keys under `contracts/managed/` and can take several minutes. The compiler script automatically uses Ubuntu WSL on Windows; set `CHART_WSL_DISTRO` if your distribution has a different name. Keep Node dependencies installed by the operating system that runs Node; do not share native node_modules between Windows and WSL.

The tested install uses `--ignore-scripts`: bundled native prebuilds worked on this Windows x64 machine. Other platforms may require `npm rebuild classic-level msgpackr-extract esbuild`; review that dependency code before allowing install scripts. CI is configured to compile and test on Ubuntu; the updated GitHub workflow must still be observed on your own remote repository.

Individual checks:

```sh
npm run test:unit
npm run test:python
npm run compile
npm run test:contracts
npm run typecheck
npm run build
python -m compileall -q tryton_modules
npm audit
```

The filename guard uses Git-tracked paths in a clone, or source paths in a ZIP checkout; it is **not a content/secret scanner**. This repository preserves the history of [RagoSpams/Chart](https://github.com/RagoSpams/Chart). Before any publication, stage the intended source changes, run `npm run check:release`, and review `git diff --cached --name-status`. The guard deliberately fails without a Git index; generated outputs, local credentials and private state must remain untracked. See the current release evidence in the validation report.

## Run the real Midnight integration

```sh
npm run devnet:up
npm run test:e2e
```

This starts separate bridge and verifier processes on loopback ports 14000/14200, generates ephemeral random credentials, deploys a fresh real contract, submits synthetic bundles, and generates/finalizes actual proofs for all three categories. It also checks recipient mismatch, expiration, revocation, record withdrawal and an independent indexer read. It has a 20-minute overall deadline and 10-minute HTTP deadlines, exits nonzero on failure, and stops its Node processes. Docker services remain running. Results and local private state are written only under ignored `.validation/e2e-*/` directories. A timeout is a failed integration run, never a skipped success.

Ports 9945, 8089 and 6301 are bound to 127.0.0.1. Proof-server verbose mode is disabled because it can log proof preimages. `/health` only proves HTTP reachability; the first transaction also initializes/synchronizes a funded local genesis wallet. The genesis seed is public local-devnet test material and must never fund a public-network wallet.

## Include a real GNU Health database and wizard

The GNU Health fixture uses the actual ORM and registered wizard with persisted **fictional** patient, clinician, vaccination and validated lab records. It runs as Tryton's setup administrator in a separate `chart_synthetic` database. It does not reuse any existing GNU Health installation or database. The helper refuses database URIs outside 127.0.0.1:55432 with user `chart_synthetic`.

In PowerShell, from the repository root:

```powershell
python -m venv .validation/python
.validation/python/Scripts/python.exe -m pip install --upgrade pip==26.3
.validation/python/Scripts/python.exe -m pip install -r requirements-integration.lock.txt
$env:CHART_GNUHEALTH_PYTHON = (Resolve-Path .validation/python/Scripts/python.exe).Path
npm run setup:gnuhealth
npm run devnet:up
.validation/python/Scripts/python.exe scripts/test-gnuhealth.py
npm run test:e2e
```

On Linux/macOS, use Python 3.12 and:

```sh
python3.12 -m venv .validation/python
.validation/python/bin/python -m pip install --upgrade pip==26.3
.validation/python/bin/python -m pip install -r requirements-integration.lock.txt
export CHART_GNUHEALTH_PYTHON="$PWD/.validation/python/bin/python"
npm run setup:gnuhealth
npm run devnet:up
.validation/python/bin/python scripts/test-gnuhealth.py
npm run test:e2e
```

Building `psycopg2` on Linux may need the distribution's PostgreSQL development headers, C compiler and Python headers. `requirements-integration.lock.txt` records the tested Python package set; Linux/macOS installation has not been exercised here. Use the smaller `requirements-integration.txt` only when intentionally resolving a new environment, then revalidate and refresh the lock.

`setup:gnuhealth` creates generated database/admin passwords and a local Tryton configuration under `.validation/`, starts PostgreSQL through `docker-compose.integration.yml`, initializes Tryton, seeds an explicitly fictional patient/clinician/vaccination/lab fixture, and activates `health_midnight_disclosure`, `health` and `health_lab`. Repeat it to update this test database. Do not copy the generated config into a clinical environment. Keep `.validation/` private and untracked.

The four `test-gnuhealth.py` checks use the actual Tryton database, wizard session and result view with a stub HTTP response; they separately verify synthetic-mode enforcement, selected-patient context and denial of a user without health groups.

The integration helper reads back persisted model values in a new transaction, runs the wizard, checks that the x10-scaled lab result is **107** (not the bridge's synthetic default), then hands the exact bundle to the independent verifier. Missing laboratory observations use analysisDate=0 and cannot produce a passing laboratory proof. Date fields are converted as UTC; measurements use decimal x10 scaling and reject negative, non-finite or overflowing values. Units, clinical correctness and provenance remain outside this demonstration.

## Use the local browser demo

Generate local credentials once (the script refuses to overwrite an existing identity):

```sh
node scripts/create-local-env.mjs
```

In three separate terminals at the repository root:

```sh
npm run dev:bridge
npm run dev:verifier-server
npm run dev:verifier-web
```

The Node services load `.env`. Open [the verifier UI](http://127.0.0.1:5174). Bridge: 127.0.0.1:4000; verifier API: 127.0.0.1:4200. Preserve your institution secret and private-state password across service restarts. The bridge's deployed address is local, ignored metadata; after replacing/resetting its chain, remove `bridge/deployed-contract.json` and use fresh private-state directories before deploying again.

The UI derives an independent recipient public key. Share that **public key** with the institution, submit a fictional bundle, issue a token to that recipient, and paste the returned bundle/contract/record/token values into the UI. All non-health bridge endpoints require `Authorization: Bearer <CHART_BRIDGE_API_KEY>`; do not put that key in the browser UI. GNU Health's Tryton process also needs `CHART_BRIDGE_API_KEY`, `CHART_BRIDGE_URL` and `CHART_SYNTHETIC_ONLY=true`. The wizard refuses to run without the synthetic-only acknowledgement or outside a selected patient record.

Bridge endpoints:

| Method / path | Input / behavior |
| --- | --- |
| GET /health | Public liveness only |
| POST /record-bundle | Optional recordId and vaccination/labResult/criticalFlags overrides; fictional defaults for omitted fields; returns full bundle and salts |
| POST /disclosure-token | Required recordId and recipientPubKey; optional tokenId, expiryTime (Unix seconds), grantVaccination/grantLabResult/grantCriticalFlags (default true) |
| POST /revoke-token | Required tokenId; institution-authorized contract transaction |
| POST /withdraw-record | Required recordId; institution-authorized contract transaction |
| POST /verify | Bridge-only demo recipient; prefer the independent verifier for externally issued tokens |
| GET /record-bundle/:recordId | Authenticated; additionally disabled unless CHART_ALLOW_RAW_BUNDLE_EXPORT=true |

IDs and addresses are exactly 32 bytes encoded as 64 hex digits, optionally prefixed with 0x. Integers are unsigned safe JSON numbers or decimal strings within their Compact field width. Booleans must be JSON booleans. Unknown fields, malformed nested objects, inverted lab ranges and oversized requests are rejected. The independent verifier accepts `/derive-pubkey`, `/verify` and `/record-status`; its authorization failures return HTTP 403 with TOKEN_EXPIRED, TOKEN_REVOKED, RECORD_WITHDRAWN or RECIPIENT_MISMATCH. Infrastructure failures return 500, which the end-to-end test never treats as a successful authorization rejection.

## Diagnose a stalled transaction

Set `CHART_DIAGNOSTICS=true` in the service environment (or `.env` for the Node development scripts) to log structured proof, wallet balance/submission and indexer-watch stages. These events contain timing, span IDs and public transaction identifiers only; arguments, witnesses and SDK error messages are omitted. The end-to-end runner enables this mode and saves diagnostics/requests under its ignored run directory.

A 15-second `pending` heartbeat means the original operation is still waiting. It is not a retry or an authorization failure. On an end-to-end timeout, results.json records the active HTTP operation and a bounded public node/indexer/proof-server snapshot. The SDK first waits for node finalization inside wallet submission, then polls the indexer for transaction data. Either stage can stall. After an HTTP timeout, the transaction outcome may be unknown: inspect the public transaction ID before taking action, and do not automatically resubmit or reset private state. No automatic transaction retry or security bypass has been added.

## Trust boundaries and remaining limits

The bridge API key authorizes a **single local institution**; it is not multi-tenant authentication. All services default to loopback. CORS permits only the local verifier UI (or CHART_VERIFIER_ORIGIN); CORS is not authentication. The verifier service receives the recipient secret and full selected witness bundle, so operate it only as a trusted local service. Browser identities remain in localStorage for demo continuity. Raw bundles remain in bridge process memory and are lost on restart; the submitting caller must retain its response for handoff.

The ledger contains commitments, record/token identifiers, scopes, recipient public keys and transaction metadata. Vaccination verification also discloses hasNextDose and nextDoseDate. Repeated predicates can reveal information. Neither a valid proof nor an administrator-created fixture establishes clinical authenticity, source signing, consent compliance, freshness, measurement units or lawful clinical use.

The pinned Midnight dependency tree has 12 moderate runtime package findings caused by one cookie-injection advisory. No path to the affected cookie-writing API was found in Chart; the installed library remains unpatched. The fixed upstream version is outside the SDKs' declared 0.x-compatible ranges. See [DEPENDENCY_AUDIT.md](DEPENDENCY_AUDIT.md) for every affected dependency, reachability evidence and the fix decision. Do not describe this as a clean dependency audit. See [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md) and the validation report.

Stop Midnight with `npm run devnet:down`. To stop the synthetic database without exposing its password, run the setup shell with CHART_TEST_DATABASE_PASSWORD loaded from `.validation/database-password`, then `docker compose -f docker-compose.integration.yml --profile integration down`. Avoid volume deletion unless you intend to discard synthetic state. `npm run clean` removes generated contract/build outputs, preserves dependencies and local credentials, and works on Windows and POSIX.

## License

TypeScript/Compact original code is MIT under [LICENSE](LICENSE). The Tryton module files retain their GPL-3.0-or-later SPDX notices; the full [GPL terms](tryton_modules/health_midnight_disclosure/COPYING) are included in its source and Python package. GNU Health, Tryton and Midnight dependencies retain their upstream licenses.
