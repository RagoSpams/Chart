# Developer setup and testing

[← Project overview](../README.md) · [Run a demo](DEMO.md) · [Architecture](ARCHITECTURE.md)

This guide documents the tested **local, synthetic-only** workflow. You will need Node.js >=22.12 (24.16 tested), npm (11.13 tested), Python 3.12 for the encoding tests and optional GNU Health integration, Docker Compose, and Compact CLI 0.5.1/compiler 0.31.1/language 0.23.0. Midnight JS 4.1.1, wallet SDK 1.2.0 and the shared on-chain WASM runtime 3.0.0 are pinned. The target is the **local ledger-8 devnet**, not public networks.

## Tested dependency versions

| Component | Validated version |
| --- | --- |
| Node.js / npm | 24.16.0 / 11.13.0 |
| Python | 3.12.10 |
| Compact CLI / compiler / language | 0.5.1 / 0.31.1 / 0.23.0 |
| Compact runtime / shared on-chain runtime | 0.16.0 / 3.0.0 |
| Midnight JS / wallet SDK | 4.1.1 / 1.2.0 |
| Local node / indexer / proof server | 1.0.0 / 4.3.3 / 8.1.0 |
| GNU Health / lab / Tryton | 5.0.5 / 5.0.0 / 7.0.61 |
| Synthetic PostgreSQL | 16.10 |

Keep `package-lock.json`, `requirements-integration.lock.txt`, the Docker image versions and compiler pin together. These are the tested versions, not a promise of compatibility with newer public networks.

## Python command

The root `npm test` script invokes `python`, even when GNU Health is not installed, because it runs the dependency-free encoding tests. Confirm `python --version` reports Python 3.12. If a POSIX system only provides `python3.12`, activate a virtual environment first:

```sh
python3.12 -m venv .validation/python
. .validation/python/bin/activate
python --version
```

The GNU Health setup below can use that same virtual environment. Windows commands assume the installed Python 3.12 executable is named `python`.

## Install Compact

In Linux/macOS or Ubuntu WSL on Windows:

```sh
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.1/compact-installer.sh -o /tmp/compact-installer.sh
sh /tmp/compact-installer.sh
export PATH="$HOME/.local/bin:$PATH"
compact update 0.31.1
compact compile +0.31.1 --version
```

See [official setup](https://docs.midnight.network/getting-started/installation) and [Windows/WSL](https://docs.midnight.network/guides/windows-compact-setup). `compact.exe` in Windows System32 is **not** the Midnight compiler. The repo compilation script can call into Ubuntu WSL; set `CHART_WSL_DISTRO` for a differently named distribution. The upstream guide may describe newer public-network versions; use this repository's ledger-8 pins for this local demo. Keep the native `node_modules` built for the OS running Node rather than sharing them across WSL and Windows.

## Install, compile and unit test

```sh
npm ci --ignore-scripts
npm test
node scripts/check-sensitive-files.mjs
```

The tested Windows x64 install used native prebuilds with ignored scripts. Other platforms may need `npm rebuild classic-level msgpackr-extract esbuild` after auditing install scripts. Compilation generates ignored artifacts under `contracts/managed/`.

Other commands:

```sh
npm run test:unit
npm run test:python
npm run compile
npm run test:contracts
npm run typecheck
npm run build
python -m compileall -q tryton_modules
npm audit
npm run check:release  # Only in an actual Git checkout; checks the tracked index/content
```

`npm test` covers 18 Node tests, 4 Python encoding tests and 60 Compact tests; the additional **four real Tryton wizard/authorization tests** are run separately. The GitHub Actions workflow is configured to execute tests/builds without a full local Docker/GNU Health transaction. The reports describe local validation; inspect a workflow run before claiming remote CI passed.

## Local Midnight transaction integration

With Docker Desktop (Linux containers) or equivalent running:

```sh
npm run devnet:up
npm run test:e2e
```

The test runner starts local bridge (port 14000) and verifier (14200) processes, creates ephemeral credentials, uses a fresh contract, and performs live proof generation/submission/finalization on the local ledger. It runs negative recipient, expiry, revocation and withdrawal scenarios; a timeout or HTTP 500 does not count as an authorization rejection. Logs/private state are stored in ignored `.validation/e2e-*/` paths. It has a 20-minute overall deadline and per-HTTP timeouts. Docker services remain running until stopped.

Devnet ports 9945/8089/6301 bind to `127.0.0.1`. Keep proof-server verbose logging disabled: it can log proof preimages. The local genesis wallet seed is public test data and must not be used on a real network.

## Full persisted GNU Health/Tryton fixture

Chart uses a **separate synthetic-only** PostgreSQL database at `127.0.0.1:55432` with user `chart_synthetic`, not any existing GNU Health database. The pip command installs the locked GNU Health packages. The setup script creates local passwords and a Tryton configuration under ignored `.validation/`, initializes the database, activates the installed modules and seeds fictional records.

**PowerShell (Windows):**

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

**Linux/macOS (Python 3.12):**

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

Linux compilation of `psycopg2` may require compiler/Python/PostgreSQL headers. Windows/WSL was used for the reported complete integration; the Linux/macOS GNU Health installation pathway is not separately validated. The four Tryton tests cover persisted synthetic records, wizard/session authorization and patient selection with a stub HTTP response. The separate full devnet E2E runner performs real HTTP and real on-chain transactions.

Missing lab observations use `analysisDate=0` and must not produce passing laboratory proofs. The fixture demonstrates x10 decimal scaling and dates interpreted as UTC, but not clinical reference-range or unit correctness.

## Local interactive UI

```sh
node scripts/create-local-env.mjs
```

In three separate shells:

```sh
node --env-file=.env --import tsx bridge/src/index.ts
node --env-file=.env --import tsx verifier/server/src/index.ts
npm run dev:verifier-web
```

The commands above avoid automatic backend restarts during a transaction. For source editing, `npm run dev:bridge` and `npm run dev:verifier-server` provide watch mode. In this documentation check the verifier watch process repeatedly restarted before listening; the equivalent non-watch entry point passed its health check. Do not restart a backend while a proof or transaction is in progress.

Browser: `http://127.0.0.1:5174`; bridge: `127.0.0.1:4000`; verifier API: `127.0.0.1:4200`. The bridge loads a `.env` with the generated single-institution API key, institution secret and private-state password. The GNU Health Tryton process also requires `CHART_BRIDGE_API_KEY`, `CHART_BRIDGE_URL`, `CHART_SYNTHETIC_ONLY=true`. Do not put the bridge API key into the UI. Restarting with an unrelated chain/private state or stale `bridge/deployed-contract.json` will lead to confusing contract errors.

Bridge routes: `GET /health` (public), authenticated `POST /record-bundle`, `POST /disclosure-token`, `POST /revoke-token`, `POST /withdraw-record`, `POST /verify`. Authenticated raw `GET /record-bundle/:recordId` additionally requires `CHART_ALLOW_RAW_BUNDLE_EXPORT=true`. The independent verifier accepts `/derive-pubkey`, `/verify`, `/record-status` and returns specific `403` authorization codes for `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `RECORD_WITHDRAWN`, `RECIPIENT_MISMATCH`.

## Diagnostics and cleanup

Enable `CHART_DIAGNOSTICS=true` locally for structured non-witness timing/stage logs, including proof/submission/indexer waits. A pending heartbeat is not success or retry. After a timeout, check the public transaction ID before deciding to retry; the outcome may be unknown.

```sh
npm run devnet:logs
npm run devnet:down
npm run clean
```

`npm run clean` removes generated build/contract outputs but preserves private local credentials and dependencies. To stop only the synthetic database without printing its generated password, run the appropriate command from the repository root.

PowerShell:

```powershell
$env:CHART_TEST_DATABASE_PASSWORD = (Get-Content -Raw .validation/database-password).Trim()
docker compose -f docker-compose.integration.yml --profile integration down
Remove-Item Env:CHART_TEST_DATABASE_PASSWORD
```

POSIX shell:

```sh
env CHART_TEST_DATABASE_PASSWORD="$(cat .validation/database-password)" docker compose -f docker-compose.integration.yml --profile integration down
```

These stop/remove the test containers without requesting volume deletion. `devnet:down` stops the Midnight services, not this separate PostgreSQL profile. The setup command starts the synthetic database again. Keep local identity/password files and private state matched to the chain; after intentionally replacing a chain, use a fresh local deployment/private-state context rather than reusing stale addresses.

## Remaining limits

The 2026 release audit reports 12 moderate runtime npm package findings associated with one cookie-attribute injection advisory and one unresolved historical finalization stall. Neither is silently suppressed. The app is not production clinical software. See [DEPENDENCY_AUDIT.md](../DEPENDENCY_AUDIT.md), [VALIDATION_REPORT.md](../VALIDATION_REPORT.md) and [SECURITY.md](../SECURITY.md).
