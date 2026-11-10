# Chart first public release validation

## Current repository and release candidate

This section records validation in the real clone of https://github.com/RagoSpams/Chart. It supersedes the earlier source-ZIP limitation below: the existing repository and history are now available for review. Earlier local audit evidence is retained as historical context, not as a claim that this release clone lacks Git metadata.

- Base commit: `eef30142de5563d296c86df7056a199d2d5c90a4` on the existing GitHub main branch.
- Local release branch: `release/first-public`.
- The validated improvements were copied into this clone; its original three-commit ancestry remains intact.
- The only inherited tracked file removed is stale local deployment metadata, `bridge/deployed-contract.json`.
- No remote push, force-push, branch deletion, rebase or history rewrite has been performed.
- Prepared author/committer identity: the public account handle and GitHub no-reply identity, avoiding the configured personal email address.

The current command results and exact file inventory are recorded in RELEASE_PREPARATION.md before the single local release commit. Runtime behavior matches the validated implementation. Release-specific changes are the actual-Git documentation, a GPL SPDX notice/trailing-blank-line cleanup, and inclusion of the full component GPL license in both source and Python package metadata. The Python wheel was built and inspected for the license, and its four Tryton tests passed after that metadata change. README/security-report changes retain the documented dependency/timeout limitations.

## Exact real-repository release results

All required checks completed in this GitHub clone on the proposed application code:

| Check | Result |
| --- | --- |
| npm ci --ignore-scripts with an empty clone-specific cache | PASS; own dependencies and own contract workspace, no parent installation fallback |
| npm test | PASS: 18 Node/API/browser/diagnostic tests, 4 Python encoding tests and 60 Compact tests; compiler 0.31.1, strict TypeScript checks and every workspace build |
| Actual GNU Health setup and scripts/test-gnuhealth.py | PASS: fresh synthetic database and all 4 wizard/session/authorization tests |
| npm run test:e2e with the clone's GNU Health Python | PASS: all nine real HTTP/proof/finalization and authorization steps |
| README credential generation and three npm development services | PASS HTTP/startup smoke checks |
| Python package wheel and component license inclusion | PASS; full GPL terms found inside the built wheel; four Tryton tests rerun after packaging metadata changes |
| Python pip check and compileall | PASS |
| Git-index filename/content guards and diff whitespace checks | PASS; 97 proposed tracked files, no private/generated paths staged |
| Existing GitHub history | All original 3 commits preserved; redacted Gitleaks scan found no leaks, source path/email review found no private developer-path/contact matches |
| npm audit | 12 moderate runtime package entries from one documented advisory; 0 high, 0 critical; no suppression |

Real end-to-end elapsed time: 278158 ms. All three category proofs finalized, and recipient mismatch, expiration, revocation and withdrawal returned the specific expected HTTP 403 authorization codes. The independent indexer read confirmed withdrawal. The earlier finalization timeout did not recur in this release-clone run, and its unresolved historical cause remains documented.

The only changes after the application test run are release documentation and license packaging/notice corrections; the package was rebuilt and Python checks rerun for those corrections. The full command suite is rerun once more on the finalized staged contents before the local commit. The exact changed-file inventory is in RELEASE_PREPARATION.md. New source is scanned from the actual staged tree before commit and the combined inherited/new history is scanned afterward.

Publication status: local review commit only. No push or hosted GitHub release/tag was created. Remote CI and public-network/clinical deployment remain unvalidated. The Git-history availability blocker from the earlier source-ZIP audit is resolved for this clone. Remaining limitations are the documented dependency advisory and intermittent-finalization uncertainty, plus the intentional local synthetic trust model.

---

## Earlier local validation and release audits (historical)

Release-readiness follow-up: 2026-11-10, America/Indianapolis. All project changes remain local. No GitHub remote was configured, no GitHub push was made, and the original source folder was not converted into or committed as a Git repository. Temporary source-only Git snapshots were created solely for local release validation.

## Release assessment

**The proposed source set is suitable for review as an explicitly experimental, synthetic-only open-source release. No reproducible build/test failure remains in the tested Windows/WSL environment.** A complete clean-checkout synthetic GNU Health → bridge → real contract → independent verifier run passed on freshly created chain/database state, and the final test/build commands passed in both the working folder and the isolated clone.

Publication still needs a review of the actual Git index/history that will be pushed: the supplied folder has no .git metadata, so that original history cannot be certified. Two residual risks must stay visible in the release notes: one unpatched runtime cookie advisory with no reachable sink found in current Chart usage, and the historical finalization stall whose precise cause remains unproven. Neither has been hidden or converted to a passing check. These prevent a clean-security-audit/production claim; they do not by themselves prevent publishing honestly labelled experimental source.

## Final executed checks

The final suites total **86 named automated checks**: **18 Node/API/browser/diagnostic tests + 60 Compact tests + 4 Python encoding tests + 4 real Tryton wizard/session/security tests**. `npm test` contains the first 82; the four Tryton checks run separately against the dedicated synthetic database. All passed, with no skipped tests. The Tryton tests stub their HTTP boundary; the complete devnet runs below use real HTTP, real proofs and real transactions.

| Release audit check | Result |
| --- | --- |
| Working folder: final npm test | PASS: 18 Node, 4 Python and 60 contract tests; full compilation, contract-test tsc and all workspace builds |
| Initial source-only clean clone: npm ci with an empty dedicated cache, then npm test | PASS; no node_modules, generated contract output, build output or .env was copied |
| Final clone: npm run clean, then npm test | PASS; all generated contract/proof-key/build outputs regenerated and all final checks passed |
| New Python venv: pip 26.3 and locked integration requirements with --no-cache-dir | PASS; packages downloaded again, no old venv reused; pip check also passes |
| Fresh Docker state: registry-checked pinned images, new Midnight containers and independent new PostgreSQL DB | PASS; only Chart's old synthetic services were stopped, without deleting volumes or touching unrelated services |
| README npm run setup:gnuhealth from an empty test database | PASS after fixing explicit fixture seeding |
| README scripts/test-gnuhealth.py | PASS, 4/4 in the fresh database and again after final changes |
| Instrumented complete GNU Health devnet run on existing test chain | PASS, 279,766 ms (~4m40s), all nine workflow/security steps |
| Complete GNU Health devnet run from clean clone on a new chain/database | PASS, 275,906 ms (~4m36s), all nine workflow/security steps |
| Public live diagnostic check using a real finalized transaction | PASS: actual ledger-8 33-byte identifier retained, historical transaction observed and public snapshot reports found=true |
| README credential generation and exact npm dev:bridge/dev:verifier-server/dev:verifier-web commands | PASS HTTP smoke checks; only the test-created process trees were stopped afterward |
| Git-index filename/content guards | PASS, final proposed source set has 95 indexed files |
| Gitleaks 8.30.1, official binary verified against published SHA-256, --redact=100 | PASS: three local audit commits scanned, no leaks found |
| Git status in the clone after installs/builds/credential generation | Clean; generated .env, .validation and private state remain ignored |
| Full npm audit and npm audit --omit=dev | Same 12 moderate package entries, 0 high/critical; one distinct runtime advisory, unresolved as described below |

The final code-only test suites were rerun after the diagnostic identifier-format correction. Subsequent report edits do not change application behavior. The full fresh-chain run used the same application/contract logic; the identifier correction was additionally checked against a real historical transaction and the final diagnostic regression suite.

## 1. Dependency advisory investigation

See [DEPENDENCY_AUDIT.md](DEPENDENCY_AUDIT.md) for all twelve affected packages/versions, exact dependency paths, runtime classification, current reachability and remediation decision. The earlier phrase "12 advisories" meant twelve npm affected-package entries, **not twelve distinct vulnerabilities**.

Both `npm audit` and `npm audit --omit=dev` identify [GHSA-chp3-j5qr-2vfr / CVE-2026-115779](https://github.com/advisories/GHSA-chp3-j5qr-2vfr) through @effect/platform 0.95.0 and 0.96.3. These are runtime dependencies. The vulnerable path constructs Set-Cookie attributes from untrusted names/domains/paths. Chart uses Express and bearer headers, with no cookie login/session feature; no calls to the affected cookie-writing APIs were found in Chart or the immediate Midnight consumers. The platform is used for Error types and outbound binary proof/check HTTP requests. **No exploitable path was identified in this usage; the installed library is still unpatched.**

The patched upstream version 0.97.1 is outside consumers' ^0.95.0/^0.96.0 declarations; the registry contains no patched compatible 0.95.x/0.96.x release. No safe non-breaking fix for these entries is available at audit time. No force upgrade, advisory suppression or ad-hoc node_modules patch was applied. A compatible backport or separately validated SDK/ledger migration is needed to remove the finding.

## 2. Finalization timeout investigation

The historical timeout was **not reproduced in two additional complete real GNU Health runs**, including one with new chain/database state. It remains an observed failure with an unknown exact root cause, not a repaired defect proven by these successes.

Source inspection found two separate waits after proving:

- wallet-sdk-facade submitTransaction calls the submission service with Finalized and waits before returning the public transaction identifier;
- midnight-js-contracts subsequently calls the indexer provider's watchForTxData, which polls until a matching nonempty transaction result appears and has no built-in overall timeout.

In the first instrumented run, bridge wallet submission/finalization took 15.2–19.2 seconds and verifier submission took 15.4–18.9 seconds; indexer transaction observations took about 1.03–1.08 seconds. In the fresh-chain run, corresponding wallet ranges were 16.3–19.9 and 15.3–19.4 seconds, and verifier indexer observations were about 1.03 seconds. These measured stage boundaries avoid confusing completed proof generation with transaction finalization.

Likely failure modes, not established explanations for the old event: a lost/reconnecting node submission subscription; a transaction accepted locally but not finalized; stale/conflicting fee-wallet inputs when bridge and verifier share the public genesis wallet; insufficient resources/invalidated state; or an indexer that is behind or never observes a transaction. Healthy services and advancing blocks do not prove that a particular transaction finalized. The old run did not retain its transaction identifier, so it cannot be reconstructed conclusively from that evidence.

Added diagnostics in both servers emit stage/span/state/elapsed-time and validated **public transaction identifiers only**, plus 15-second pending heartbeats. Arguments, witness values, secrets, full transactions and SDK error messages are excluded. The ledger's actual 33-byte identifier format has an explicit regression and a real read-only lookup check.

The bounded end-to-end runner now saves public node head/finalized hash, indexer head, proof HTTP reachability, optional transaction-observed status and active request timing on failure. Offline snapshot queries fail safely without echoing error payloads. Its 10-minute HTTP and 20-minute overall deadlines are unchanged. No automatic transaction retry, silent success, lowered security assertion or cancellation of an in-flight contract transaction was introduced. After an HTTP timeout, on-chain outcome may be unknown; inspect the public transaction ID before deciding on recovery or resubmission.

A temporary read-only diagnostic helper initially used forced process.exit and hit a Windows libuv teardown assertion after its assertions had passed. That local harness was changed to natural shutdown and reran with exit 0. The project end-to-end runners and final suites exited normally. This was not treated as a successful process run until corrected.

## 3. Clean-checkout reproduction

Because the supplied working folder has no Git metadata, this audit cannot clone or inspect an original upstream repository. Instead it created an isolated **source-only local Git repository** and used `git clone --no-local` into a separate workspace outside the original dependency tree. No generated files, caches, .env/private state, Python venv or node_modules were copied. The exact source manifest and hashes are retained locally in ignored .validation/release-clone-manifest.json.

Chart/NODE_PATH/NODE_OPTIONS/Python environment overrides were cleared in the test shell. Only documented prerequisites (installed Node/npm/Python, Docker Desktop and compatible Compact in Ubuntu WSL) were reused. Dependencies resolved inside the clean clone's own node_modules; no parent/original installation was used. npm downloaded into a new empty dedicated cache; pip downloaded with caching disabled into a new venv. Contract outputs and proof keys were generated from source. Final npm run clean removed them again and npm test regenerated them successfully.

Pinned Docker images were checked against the registry with docker compose pull, and new containers/new chain/database state were created. Existing immutable Docker image layers and installed tool binaries were not destructively purged; this is a clean application/package-state test, not a newly installed operating system. Linux/macOS and remote GitHub Actions execution remain outside this audit.

**Clean-only defect found and fixed:** scripts/test-gnuhealth.py required a persisted synthetic patient, but setup previously only initialized modules. The setup command now explicitly seeds fictional patient/clinician/vaccination/lab records via the actual GNU Health ORM. The README's test sequence now works on an empty database without relying on earlier sessions. Expanded .gitignore protection covers all populated .env variants, and release guards distinguish a real Git index from a source ZIP.

The three documented npm development service commands were also started in the isolated clone after generating its own random .env. Both health APIs and the Vite index page responded correctly; generated secrets remained ignored. This is HTTP/startup smoke coverage, not an interactive browser or GNU Health desktop-client usability test.

## 4. Proposed tracked source and secret review

The final source-only Git snapshot has **95 indexed source/document/configuration files**. Filename checks reject private environment files, key files, private state, deployment metadata and patient-export artifacts. The release content guard checks the actual index for recognized credential/private-key patterns and developer-specific absolute paths; it refuses to give tracked-file assurance without Git metadata. Gitleaks 8.30.1 scanned the local audit history with full redaction and found zero leaks. No developer-specific user/home paths were found in the indexed source. Workstation-specific Docker commentary was removed.

Only .env.example is intentionally indexed, with empty credential placeholders. Generated .env and .env.production-style files, .validation, LevelDB state and deployed-contract metadata are ignored and absent from the index. Public local-devnet materials remain deliberately present: the well-known all-zero-except-one genesis seed, local indexer defaults and clearly labelled synthetic test constants. These are not private credentials and must never be repurposed for public-network/production accounts.

**Limit:** the actual original folder still has no .git metadata; no assertion is made about a missing original Git index/history or any remote repository. Before a real publication, create/use the intended Git checkout, review git status/git ls-files, run npm run check:release there and scan its full history. The audit's local Git snapshots are test artifacts; they are not a commit or push of the user's original working folder. No patient information or generated credential/state files were included in the proposed source set.

## 5. Release conditions and remaining limits

- No observed build/test blocker remains for the tested Windows x64 + Ubuntu WSL compiler + Linux Docker configuration.
- The twelve moderate runtime package entries remain; the detailed reachability assessment must accompany any security claim. This is not a zero-advisory audit.
- The historical finalization stall is not conclusively explained; the new diagnostics and unknown-outcome recovery guidance must remain. Two successful audit runs do not establish long-term reliability.
- Original Git index/history is unavailable. The actual publication checkout needs the same index/history checks before a push. This audit did not push anything.
- Production identity/consent architecture, clinical truth/provenance/units, real patient use, public-network migration, load testing, interactive GUI/accessibility coverage, remote CI and other operating systems remain unvalidated. These are production-readiness limits, not requirements to hide an experimental source project.

### New named diagnostic checks (all passed)

- transaction diagnostics preserve results and omit private arguments and errors;
- pending finalization is observable and never retried or converted to success;
- diagnostic sink failures do not alter transaction results;
- diagnostics retain actual ledger-8 33-byte public transaction identifiers;
- timeout snapshot tolerates offline services and does not echo error payloads;
- timeout snapshot distinguishes node/indexer heads and observes a submitted transaction.

The original 80 named checks below were rerun as part of the final 86-check result. Earlier implementation-phase findings and failures are retained as historical evidence rather than erased.

---

## Previous implementation validation (historical)

Date: 2026-11-10 (America/Indianapolis). Work performed directly in the supplied repository. Only fictional/synthetic records were created or submitted. No Git commits were made; this ZIP-derived checkout has no Git metadata.

## Outcome

**The complete persisted synthetic GNU Health → registered disclosure wizard → authenticated bridge → real Midnight contract → independent verifier workflow passed.** All three predicate proofs were generated, submitted and finalized. Real contract calls rejected the wrong recipient, expired and revoked tokens, and withdrawn records. An independent public indexer read confirmed withdrawal.

The final clean-install test run passed **80 named automated checks**: 12 Node/API/browser-input tests, 60 contract tests, 4 dependency-free Python encoding tests and 4 actual Tryton wizard/session/security tests. The last four use a stub HTTP response and are reported separately from real devnet transactions. All workspace TypeScript checks/builds passed after the changes.

This is a working **local synthetic research demonstration**, not an unqualified security certification or production healthcare release. Twelve moderate npm advisories remain in the pinned Midnight dependency tree, and one earlier real GNU Health run stalled during transaction finalization before a fresh complete retry passed. These limitations are not suppressed.

## Inspection and environment

Read AUDIT_REPORT.md before implementation. Inspected the Compact source, all contract-test suites/harness/fixtures, bridge and verifier HTTP/SDK/wallet/network/witness code, browser components/utilities/styles/configuration, GNU Health module/model/view/registration files, Docker configuration, package/TypeScript/CI configuration and project/security/contribution documentation.

| Check | Observed result |
| --- | --- |
| Windows Node / npm | 24.16.0 / 11.13.0 |
| Windows Python | 3.12.10 |
| Docker / Compose | 29.6.1 / v5.3.0; Linux engine reachable after startup/access check |
| Windows compact.exe | System32 file-compression utility; deliberately not used |
| Ubuntu WSL | Installed; Compact CLI 0.5.1 and compiler 0.31.1 already present |
| Compiler metadata | language 0.23.0, compact-runtime 0.16.0 |
| GNU Health / lab / Tryton | Installed locally in .validation/python: 5.0.5 / 5.0.0 / 7.0.61 |
| PostgreSQL | New isolated postgres:16.10 container, dedicated chart_synthetic DB, loopback port 55432 |
| Midnight services | node:1.0.0, indexer-standalone:4.3.3, proof-server:8.1.0; all healthy |
| Git | Executable present, but no .git directory in this supplied checkout |

Locked npm packages were installed with --ignore-scripts; their bundled native prebuilds worked on this Windows x64 host. Network/WSL/Docker and localhost test operations that failed under sandbox restrictions were rerun with approved elevated access. No security check was weakened to bypass the sandbox.

## Reproducible defects fixed

1. **Real transactions failed despite passing circuit tests.** compact-runtime resolved onchain-runtime-v3 3.1.0 while the SDK protocol resolved a separate 3.0.0 WASM module. Real submission failed with `expected instance of StateValue`. Pinned a direct shared 3.0.0 dependency, aligned the override and regenerated/deduplicated the lock. Added a runtime-class identity regression; it still passes after a clean npm ci.
2. **Bridge callers implicitly controlled the institution.** Added constant-time bearer-key authorization to every non-health bridge route and fail-closed startup/configuration. Institution secrets and private-state passwords now come from local configuration. Independent bridge/verifier LevelDB directories avoid cross-process store collisions. Removed shipped stale deployment metadata and ignored future local deployment files.
3. **Malformed API inputs could reach wallet initialization or silently use defaults.** Added nested-object/field validation before SDK calls, strict booleans/identifiers/widths, required recipient public keys, range ordering, category/flag bounds, unknown-field rejection, bounded JSON errors, no-store headers and generic infrastructure errors. Tests prove malformed/unauthorized bridge requests do not initialize the wallet. Browser bundle parsing now rejects malformed shapes before rendering.
4. **Missing laboratory data could pass as zero in [0,0].** The contract now returns false when analysisDate is zero, and rejects inverted reference ranges on submission. Added regressions and recompiled real proof keys.
5. **Lifecycle behavior was inaccessible via the bridge.** Added authenticated /revoke-token and /withdraw-record routes backed by actual institution circuit calls. The verifier returns explicit HTTP 403 authorization codes; end-to-end tests require the exact code, not a generic HTTP 500.
6. **Python date/scaling and transport gaps.** Added UTC handling for Date and DateTime values, decimal x10 scaling, non-finite/negative/overflow rejection, authenticated bridge requests and safe HTTP errors. Added an explicit synthetic-only/patient-selection guard and installable Tryton package metadata.
7. **Privacy claims/logging overstated protection.** Corrected UI/README claims: witnesses and recipient secrets reach the trusted verifier server, and vaccination scheduling fields reach the ledger. Removed proof-server -v, which logged proof preimages; restarted and verified healthy operation without verbose mode. Normal application errors do not log SDK witness arguments.
8. **Tooling/onboarding gaps.** Added pinned Windows/WSL compilation, portable clean commands, credential generation, isolated GNU Health setup, bounded real end-to-end runner, lockfiles, expanded CI configuration and exact README commands. The sensitive-filename guard now supports source ZIPs as well as Git clones.
9. **Dependency advisories.** Compatible npm updates removed all reported high/critical findings. Upgraded only the repository-local Python environment's pip from 25.0.1 to 26.3 after its vulnerability scan found installer advisories.

## Commands and results

| Command / operation | Final result and scope |
| --- | --- |
| npm ci --ignore-scripts --no-audit --no-fund | PASS, final clean lockfile installation |
| npm test | PASS; runs Node, Python, full Compact compilation/circuit tests, contract-test tsc and all workspace builds |
| npm run compile | PASS with compiler 0.31.1; all 7 provable circuits plus generated identity helpers; full proof keys emitted |
| npm run test:unit | PASS, 12/12; actual loopback HTTP with SDK stubs for API boundary tests |
| npm run test:python | PASS, 4/4; real dependency-free encoding functions |
| vitest run (contracts) | PASS, 60/60 across 7 files against the generated contract/runtime |
| npm run typecheck | PASS, strict TypeScript contract-test/harness checks |
| npm run build | PASS: bridge tsc, verifier-server tsc, browser tsc -b and Vite production build |
| python -m compileall -q tryton_modules scripts/gnuhealth-synthetic.py scripts/test-gnuhealth.py | PASS; syntax only, separately from functional tests |
| node --check on setup-gnuhealth, compile-contracts, create-local-env, devnet-e2e, clean scripts | PASS |
| create-local-env smoke test in ignored .validation/env-smoke | PASS; SDK-validated random credentials generated without printing their values |
| npm ls @midnight-ntwrk/onchain-runtime-v3 | PASS; contract and SDK dedupe to one 3.0.0 runtime after clean install |
| docker compose up -d --wait | PASS; node, indexer and proof server healthy, loopback ports only |
| GNU Health module installation and activation | PASS; health, health_lab and health_midnight_disclosure activated; patient model and wizard resolve from real Pool |
| scripts/gnuhealth-synthetic.py with CHART_SEED_ONLY=true | PASS; fictional records persisted through actual GNU Health ORM |
| node scripts/setup-gnuhealth.mjs | PASS on repeat invocation; documented setup is executable/idempotent on this Windows environment |
| .validation/python/Scripts/python.exe scripts/test-gnuhealth.py | PASS, 4/4; real Tryton DB/session/result view and access checks; stub HTTP boundary |
| npm run test:e2e with CHART_GNUHEALTH_PYTHON | PASS on complete retry; actual GNU Health model extraction, HTTP, real proofs, real transactions, independent verifier/indexer |
| node scripts/check-sensitive-files.mjs | PASS source-filename fallback; no Git tracked-history/content scan available |
| npm audit --json | REMAINING FINDINGS: 12 moderate, 0 high, 0 critical; see below |
| Python pip check | PASS, no broken requirements |
| pip-audit --local after pip upgrade | PASS for known advisories in audited PyPI packages; local Chart module is not on PyPI and was not registry-auditable |

Final npm test output: 12 Node tests, 4 Python tests, 60 contract tests, no skipped tests or failures, all builds complete. Final Tryton rerun: 4 tests passed. Windows/WSL generated source-map paths produce a Vitest warning about missing original source files; this does not prevent compilation, proof generation, tests or builds. Tryton warns that the Windows host timezone is US Eastern; conversion helpers explicitly handle UTC and passed offset/date tests. No host timezone was changed.

## Real end-to-end evidence

The runner creates separate Node bridge/verifier processes and fresh random institution/API/recipient identities. The fee wallet is the public local genesis wallet; contract witness identities remain distinct. The GNU Health fixture uses setup-administrator privileges solely inside the dedicated synthetic database, with explicitly fictional patient and clinician records. It checks that the transmitted lab value is 107 (10.7 x10), the actual extracted vaccination is completed and the fictional allergy flag is true. This prevents bridge default data from being mistaken for GNU Health integration.

The final run validated:

1. **PASS** — GNU Health persisted synthetic patient -> real wizard -> bridge -> contract.
2. **PASS** — Real vaccination proof generated, submitted and finalized.
3. **PASS** — Real labResult proof generated, submitted and finalized.
4. **PASS** — Real criticalFlags proof generated, submitted and finalized.
5. **PASS** — Wrong recipient rejected by real contract.
6. **PASS** — Expired token rejected by real contract.
7. **PASS** — Revoked token rejected by real contract.
8. **PASS** — Withdrawn record rejected with a previously issued, unrevoked token.
9. **PASS** — Independent public indexer read confirms withdrawal.

Each successful proof returned only after SDK transaction finalization. Recipient mismatch, expiration, revocation and withdrawal returned HTTP 403 with the specific expected error code (RECIPIENT_MISMATCH, TOKEN_EXPIRED, TOKEN_REVOKED, RECORD_WITHDRAWN). HTTP 500 is never accepted as evidence of successful authorization enforcement in the final runner.

Public record-status read returned exactly `{exists: true, withdrawn: true}`. A separate earlier bridge-only real-devnet run also passed all three proofs and recipient/revocation/withdrawal checks; it was not counted as GNU Health integration.

Local execution evidence is retained under ignored .validation/ directories; these include private state and synthetic witness handoff files and must not be committed or published. Final result file: `e2e-1794346111672/results.json` inside .validation. Node child processes were stopped by the runner. Midnight and the isolated synthetic PostgreSQL services remain running for further local development.

## Failures encountered and disposition

| Earlier failure | Disposition |
| --- | --- |
| npm/network/WSL/Docker/localhost sandbox denials; one stalled npm attempt ended with npm Exit handler never called | Approved access reruns succeeded; final clean npm ci succeeded |
| First exploratory Vitest invocation used a doubled contracts/config path | Corrected invocation/root; canonical npm test passed |
| New lab regressions initially failed against pre-change generated artifacts | Recompiled contract/proof keys; both regressions and real proofs pass |
| Missing no-store header on malformed verifier JSON | Moved header middleware before JSON parsing; regression passes |
| Test fixture used an incorrect recipient variable name | Corrected; strict TypeScript checks pass |
| Two real-devnet submissions failed with StateValue incompatibility | Fixed shared WASM version/deduplication; subsequent bridge-only and full GNU Health runs passed |
| Python venv bootstrap initially blocked by sandbox; editable installation without build backend failed | Approved venv/pip installation with isolated setuptools build succeeded |
| Windows Tryton CLI has a script rather than trytond-admin.exe | Invoke installed script through selected Python; setup helper does this automatically |
| GNU Health fixtures required federation prefix, clinician identity and clinician gender | Supplied explicit fictional values; did not disable model validation or clinical access checks |
| One GNU Health real run timed out after proof generation during first verification | Recorded as FAIL; node/indexer/proof server were healthy. A fresh full run passed. Root cause of that one finalization stall is not established; intermittent reliability remains a limitation |
| Original npm scan: 19 findings (15 moderate, 3 high, 1 critical) | Compatible patches reduce this to 12 moderate; remaining upstream tree is documented, not suppressed |
| Python scan found 12 advisory entries against pip 25.0.1 (including duplicate advisory aliases) | Upgraded local pip to 26.3; scan then found no known vulnerabilities |

## Remaining blockers and limits

- **Dependency security:** npm still reports 12 affected packages in the pinned Midnight tree, all tracing to [Effect cookie attribute injection, GHSA-chp3-j5qr-2vfr](https://github.com/advisories/GHSA-chp3-j5qr-2vfr). npm proposes breaking Midnight SDK 5.0.0 upgrades. A coordinated SDK/compiler/ledger migration or upstream-compatible patch is required for a clean audit. No force-upgrade, advisory exclusion or security-check removal was used.
- **Reliability:** one full-chain verification stalled and hit the 10-minute HTTP deadline; the later complete run passed all steps. This work does not establish sustained performance or eliminate intermittent node/wallet/indexer finalization issues.
- **Security architecture:** bearer authorization is single-institution/local only; no multi-tenant patient consent, production identity management, rate limiting, clinical provenance or comprehensive audit trail. The trusted verifier sees witness data and recipient secrets. Browser localStorage and bridge in-memory bundles remain sensitive. These prevent production/clinical security claims.
- **Coverage boundaries:** browser parsing and production build were tested, but no interactive browser click-through, live GNU Health desktop client/RPC UI session or visual/accessibility QA was executed. Real model extraction/transition/HTTP/proofs were exercised; the complete Tryton execute/result-view path and unauthorized-user check were separately exercised with a stub HTTP boundary.
- **Portability/CI:** actual execution was Windows x64 + Ubuntu WSL compiler + Linux Docker. The revised Ubuntu GitHub Actions job, Linux/macOS Python setup and other architectures have not been observed here. Git metadata/history and remote CI are absent from this checkout.
- **Data semantics:** tests use fictional data only. Units, staleness, source signatures, truth of medical observations, legal consent/compliance and public-network compatibility are unvalidated. Negative or unsupported lab measurements are rejected rather than coerced into Uint values.
- **Scanner scope:** Python audit examined 64 installed distributions, including temporary scanner tooling; the local Chart distribution was skipped because it is not published on PyPI. Filename guard does not scan contents, Git history or dependencies for embedded secrets. No actual credentials were added to source; generated credentials/state stay under ignored .validation or .env.

## Named automated checks

All tests below passed on the final executed suite. Matrix subcases within a named test are grouped under that name.

### Node / API / browser input (12)

- PASS — `bridge/test/api.test.mjs`: bridge rejects unauthorized submit, issue, verify, revoke, withdraw and export before wallet initialization
- PASS — `bridge/test/api.test.mjs`: bridge fails closed without authentication configuration
- PASS — `bridge/test/api.test.mjs`: raw export is denied even for authenticated users unless explicitly enabled
- PASS — `bridge/test/api.test.mjs`: bridge rejects malformed nested values, identifiers, flags, dates and grants without wallet initialization
- PASS — `bridge/test/api.test.mjs`: malformed JSON and oversized bodies produce bounded JSON errors
- PASS — `bridge/test/runtime.test.mjs`: contract and SDK share one WASM StateValue class
- PASS — `bridge/test/syntheticData.test.mjs`: random IDs and salts use 32 bytes of randomness
- PASS — `bridge/test/syntheticData.test.mjs`: hex decoding accepts valid 32-byte strings and rejects malformed input
- PASS — `bridge/test/syntheticData.test.mjs`: record IDs normalize case and optional 0x prefix for lookup
- PASS — `verifier/server/test/api.test.mjs`: verifier rejects malformed inputs before calling any Midnight operation
- PASS — `verifier/web/test/input.test.mjs`: UI rejects malformed bundle shapes and identifiers before rendering
- PASS — `verifier/web/test/input.test.mjs`: browser hex decoder rejects truncation and nonhex digits

The HTTP malformed-input matrix includes null/array bodies, wrong nested types, malformed/overlong hex, numeric IDs, negative/fractional/overflowing integers, overlong Uint64 values, string/null booleans, unknown fields/categories, inverted ranges, absent recipient keys, expired issuance requests, invalid selectors, missing revoke/withdraw IDs, malformed JSON and bodies over 64 KiB. Unauthorized operations cover submission, issuance, verification, revocation, withdrawal and raw export; default export stays denied even after authentication.

### Compact circuit tests (60)


**issueDisclosureToken.test.ts**

- PASS — succeeds for the record's own institution and stores the token
- PASS — fails when the record does not exist
- PASS — fails when called by anyone other than the record's institution
- PASS — fails once the record has been withdrawn
- PASS — fails on a duplicate tokenId
- PASS — fails when no bundle is granted

**revokeToken.test.ts**

- PASS — succeeds for the record's institution and marks the token revoked
- PASS — leaves the rest of the token record untouched
- PASS — fails when the token does not exist
- PASS — fails when called by anyone other than the record's institution

**submitRecordBundle.test.ts**

- PASS — rejects an inverted laboratory reference range
- PASS — registers a new record with withdrawn = false
- PASS — stores non-empty commitments for all three bundles
- PASS — rejects a second submission with the same recordId
- PASS — allows the same institution to submit multiple distinct records
- PASS — derives the same institutionId for the same secret across different records
- PASS — derives a different institutionId for a different secret
- PASS — reproduces the same commitment for identical bundle data and salt
- PASS — changes vaccinationCommit when the vaccination data changes, and nothing else
- PASS — changes a commitment when only its salt changes (binding property)

**verifyCriticalFlagsBundle.test.ts**

- PASS — discloses true for a requested flag that is set (critAllergic, default fixture)
- PASS — discloses false (does not throw) for a requested flag that is not set (critDbt, default fixture)
- PASS — selects each of the nine flags correctly, independent of the others
- PASS — fails (throws) when requestedFlag is out of range (9 and above)
- PASS — fails (throws) on an expired token
- PASS — rejects verification after the institution withdraws the record
- PASS — rejects a token at its exact expiry boundary
- PASS — fails (throws) on a revoked token
- PASS — fails (throws) when the token does not grant access to the CriticalFlags bundle
- PASS — fails (throws) for the wrong recipientSecret
- PASS — fails (throws) when the supplied critical-flags data does not match the committed record (tampered data)
- PASS — fails (throws) when the supplied salt does not match (tampered salt)

**verifyLabResultBundle.test.ts**

- PASS — discloses true when the result is within the reference range
- PASS — discloses false (does not throw) when the result is outside the reference range
- PASS — fails (throws) on an expired token
- PASS — rejects previously issued tokens after the source record is withdrawn
- PASS — rejects a token at its exact expiry boundary
- PASS — returns false for a missing laboratory observation placeholder
- PASS — fails (throws) on a revoked token
- PASS — fails (throws) when the token does not grant access to the LabResult bundle
- PASS — fails (throws) for the wrong recipientSecret
- PASS — fails (throws) when the supplied lab result data does not match the committed record (tampered data)
- PASS — fails (throws) when the supplied salt does not match (tampered salt)
- PASS — fails (throws) when the requested test type does not match the committed bundle's test type

**verifyVaccinationBundle.test.ts**

- PASS — discloses true for a completed, non-overdue vaccination and a valid, in-scope token
- PASS — discloses false (does not throw) when the vaccination is not marked completed
- PASS — discloses false (does not throw) when a next dose is already overdue
- PASS — fails (throws) on an expired token
- PASS — rejects verification after the institution withdraws the record
- PASS — rejects a token at its exact expiry boundary
- PASS — fails (throws) on a revoked token
- PASS — fails (throws) when the token does not grant access to the Vaccination bundle
- PASS — fails (throws) for the wrong recipientSecret
- PASS — fails (throws) when the supplied vaccination data does not match the committed record (tampered data)
- PASS — fails (throws) when the supplied salt does not match (tampered salt)
- PASS — fails (throws) when the requested vaccine does not match the committed bundle's vaccine

**withdrawRecordBundle.test.ts**

- PASS — succeeds for the record's institution and sets withdrawn = true
- PASS — leaves the commitments and institutionId untouched
- PASS — fails when the record does not exist
- PASS — fails when called by anyone other than the record's institution

### Python encoding tests (4) and real Tryton checks (4)

- PASS — `tryton_modules/tests/test_encoding.py`: `test_date_datetime_and_missing_date`
- PASS — `tryton_modules/tests/test_encoding.py`: `test_hash_is_exact_bytes32_and_unicode_is_deterministic`
- PASS — `tryton_modules/tests/test_encoding.py`: `test_decimal_lab_scaling_and_rounding`
- PASS — `tryton_modules/tests/test_encoding.py`: `test_lab_scaling_rejects_negative_infinite_nan_and_overflow`
- PASS — `scripts/test-gnuhealth.py`: `test_synthetic_acknowledgement_is_required`
- PASS — `scripts/test-gnuhealth.py`: `test_patient_context_is_required`
- PASS — `scripts/test-gnuhealth.py`: `test_result_view_and_session_execute_with_stub_http`
- PASS — `scripts/test-gnuhealth.py`: `test_user_without_health_groups_cannot_execute_patient_wizard`
