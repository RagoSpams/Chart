# Contributing to Chart

Chart explores privacy-preserving verification of narrow claims derived from medical records. Contributions that improve reproducibility, security, clarity, testing, and interoperability are especially welcome.

## Development prerequisites
- Node.js 22.12 or newer (24 tested)
- npm (lockfile-based install)
- Docker and Docker Compose for local services
- Any additional GNU Health / Midnight dependencies documented in the repository README

## Basic checks
```sh
npm ci --ignore-scripts
npm test
node scripts/check-sensitive-files.mjs
```

Some integration tests may require the local Midnight devnet, seeded synthetic GNU Health instance, or environment variables. Please document exact prerequisites in your pull request rather than silently skipping integration checks.

## Pull requests
- Explain the problem, user-visible behavior, and threat-model consequences.
- Add a unit test or integration test for behavior changes when practical.
- Include reproducible commands and disclose anything not tested.
- Use synthetic data only; never commit real patient health information, secrets, or wallet credentials.
- Preserve existing commitment formats and circuit public-input semantics unless an intentional migration is documented.

## Areas needing contribution
- One-command, synthetic-data-only local demo
- Verification of expiry, revocation, recipient binding, and stale-record cases
- Negative and adversarial test vectors
- FHIR-aligned integration examples
- Benchmarking proof creation and verification times

Run `npm run test:e2e` against the local devnet. Set `CHART_GNUHEALTH_PYTHON` after following the README GNU Health setup to include persisted fictional EHR data. `scripts/test-gnuhealth.py` checks the real Tryton wizard/session and authorization with a stub HTTP boundary; report that separately from real chain transactions. Never count a timeout, mock, skipped check or HTTP 500 as a successful authorization rejection.
