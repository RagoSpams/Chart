# Chart repository review — 2026-11-10

This report accompanies the edited source ZIP, based on the supplied `Chart-main.zip` (snapshot dated 2026-09-04). It does **not** represent an independent verification of real Midnight transactions or GNU Health integration.

## Confirmed findings and fixes

1. **High: raw private bundles available via unauthenticated GET** (`bridge/src/index.ts`). `GET /record-bundle/:recordId` exposed the bundle **and salts** to anyone able to reach the bridge and learn a record ID. Fixed: endpoint now defaults to HTTP 403 and needs `CHART_ALLOW_RAW_BUNDLE_EXPORT=true` for synthetic demos. The service remains unauthenticated and is **not safe** for real patient information.
2. **High: withdrawn record could still be verified with a previously issued token** (`contracts/src/gnuhealth_disclosure.compact`). `issueDisclosureToken` rejected withdrawn records, but `checkTokenValidity` checked token revocation/expiry without checking later record withdrawal. Added a withdrawn-state check to the shared circuit precondition and a regression in `contracts/test/verifyLabResultBundle.test.ts`. **Regression cannot be executed without the Compact toolchain.**
3. **Medium: insecure randomness** (`bridge/src/syntheticData.ts`). `Math.random` generated record IDs and commitment salts. Replaced it with Node WebCrypto's cryptographically secure generator.
4. **Medium: weak input parsing** (bridge/verifier APIs). Buffer hex decoding silently truncated malformed hex, `Boolean('false')` yielded `true`, and several integer values were unbounded. Added strict 32-byte hex and field-width/type checks; invalid inputs return 400 where handled. No schema validator has been integrated.
5. **Medium: network exposure by default** (Docker/node/vite). Node services and Docker devnet ports now default to loopback; verifier CORS limits known local UI origins. Explicit host/origin overrides are available for controlled demos. **CORS does not provide authentication.**
6. **Portability: developer-specific WSL IP** (`tryton_modules/.../patient.py`). Replaced with `CHART_BRIDGE_URL` and loopback default.
7. **Onboarding:** README updated to avoid inaccurate binary-access claims, document setup and demo constraints; added security/contributing docs, MIT LICENSE, fast unit tests and CI.

## Verification performed

- `npm run test:unit`: **PASS**, 3/3 tests.
- `python3 -m compileall -q tryton_modules`: **PASS** (syntax only).
- `node --check scripts/check-sensitive-files.mjs`: **PASS**.
- Root/workspace package JSON parses: **PASS**.
- `npm ci --ignore-scripts --offline`: **BLOCKED** by unavailable cached registry tarball (`ws@8.21.3`).
- `compact` executable: **NOT AVAILABLE**.
- Full `npm test`, TypeScript builds, Midnight devnet, GNU Health integration: **NOT RUN / NOT VERIFIED**.

## Further work in recommended order

1. Build, compile, and execute all Compact tests on a workstation with the proper compiler; pay particular attention to the new withdrawn-record check.
2. Validate live client/bridge/verifier interactions against Docker Midnight devnet. Run an end-to-end demo from GNU Health and the browser.
3. Add authentication and authorization to bridge APIs before any network deployment. Bundle export is only a demo mechanism, not a secure delivery protocol.
4. Remove the need to transmit recipient secrets and complete raw witness bundles to an externally controlled verifier server (e.g., local proof generation or a carefully scoped trusted verifier model).
5. Add input schemas for nested record data, limits and dates; test all malformed inputs without requiring wallet initialization.
6. Add negative tests for all three categories after withdrawal/revocation/expiration and test multiple recipient identities.
7. Test measurement scale, units, record freshness, clinical provenance, and consent semantics in real GNU Health versions.
8. Document the exact compatible Compact installation; add integration CI using provisioned devnet only once reproducible.

## Files changed or added

- `contracts/src/gnuhealth_disclosure.compact`
- `contracts/test/verifyLabResultBundle.test.ts`
- `bridge/src/syntheticData.ts`, `bridge/src/index.ts`, `bridge/test/syntheticData.test.mjs`
- `verifier/server/src/index.ts`, `verifier/web/src/lib/identity.ts`, `verifier/web/vite.config.ts`
- `tryton_modules/health_midnight_disclosure/patient.py`
- `docker-compose.yml`, `package.json`, `README.md`
- `.github/workflows/ci.yml`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGE_PLAN.md`, `scripts/check-sensitive-files.mjs`
