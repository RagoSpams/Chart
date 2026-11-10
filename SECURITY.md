# Security policy

Chart is an experimental privacy-preserving verification integration, not a clinically validated or production-ready healthcare system.

## Data safety
- Use synthetic, fictional, or properly de-identified demo data only.
- Never upload real patient records, access tokens, wallet seeds, private keys, or credentials in issues or pull requests.
- Never use this prototype to make clinical decisions or establish insurance eligibility.
- Do not assume a valid zero-knowledge proof establishes the correctness or freshness of the underlying medical facts; source authenticity and record updates are separate concerns.
- Keep private medical data out of ledger state, logs, telemetry, browser storage, and exceptions.

## Current demo security boundaries
- The bridge `GET /record-bundle/:recordId` raw export is opt-in only (`CHART_ALLOW_RAW_BUNDLE_EXPORT=true`); do not use it with real patient records.
- Every non-health bridge route requires a configured bearer API key of at least 32 characters. This is single-institution local authorization; it does not provide multi-tenant access control. `POST /record-bundle` returns the full raw bundle and salts to its authenticated caller.
- The verifier UI sends its generated secret and full witness bundle to the verifier server. Never operate an untrusted verifier server.
- The app lacks production identity management, per-patient consent policies, comprehensive encryption and audit logs, and medically validated source signing. Midnight private-state stores use caller-configured passwords and separate database directories; browser localStorage and in-memory bundles remain sensitive. CORS is not access control.
- The current vaccination circuit makes scheduling fields public in addition to its final boolean.

## Reporting vulnerabilities
Please do not open a public issue containing a working exploit or private data. Contact the repository maintainer privately through GitHub before public disclosure. Maintainers should add a dedicated private disclosure address or enable GitHub Private Vulnerability Reporting.

## Threat-model checklist
- Confirm who authenticates the hospital/source and commits the underlying facts.
- Confirm token binding to verifier identity, scope, expiry, and revocation checks.
- Check replay resistance and cross-patient/cross-tenant isolation.
- Confirm that proof public inputs do not disclose unintended information.
- Evaluate whether narrow predicates reveal sensitive information through repeated queries.
- Check record versioning, measurement units, provenance, and staleness.

## Validation status

See [VALIDATION_REPORT.md](VALIDATION_REPORT.md) for actual synthetic end-to-end runs and negative tests. The pinned ledger-8 Midnight SDK dependency tree still has 12 moderate npm advisories (underlying Effect cookie-attribute injection); high and critical npm findings were removed through compatible updates. Do not describe this as a clean dependency audit. See [DEPENDENCY_AUDIT.md](DEPENDENCY_AUDIT.md): these are 12 runtime package entries caused by one advisory, with no reachable cookie-writing sink found in current usage. A compatible upstream patch or tested SDK/ledger migration is required to clear the audit.

The proof server runs without `-v`: verbose mode can log proof preimages. Application failures return generic errors; opt-in synthetic diagnostic output is limited and redacts 32-byte hex strings. Do not enable diagnostic logging with any non-synthetic workload. Institution secrets and private-state passwords are configured locally, not embedded in source. The well-known genesis wallet seed is public test material for the isolated devnet only.

Before publishing, run `npm run check:release` in the actual Git checkout and scan its full history with a redacting secret scanner. The release-preparation clone preserves the original RagoSpams/Chart history. Its inherited history and proposed source set were scanned with redaction; see the current release section in VALIDATION_REPORT.md. Repeat the checks against the actual index/history before any later push. Generated `.env*` files (except empty examples), private state and `.validation/` must remain untracked.
