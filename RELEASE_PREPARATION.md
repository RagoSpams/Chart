# First public release preparation

Repository: https://github.com/RagoSpams/Chart

Base: `eef30142de5563d296c86df7056a199d2d5c90a4` (existing main branch). Local branch: `release/first-public`.

The release is one new, non-merge local commit on top of the existing three-commit history. No push, force-push, branch deletion or history rewrite is authorized or performed. The commit identity uses the public GitHub handle and no-reply address, not the configured personal email.

## What changed

- Authenticated local institution bridge with strict request validation and safe raw-export defaults.
- Withdrawal-safe, expiring, recipient-bound and revocable disclosure checks; missing laboratory observations cannot pass.
- Compatible shared WASM runtime pin, reproducible Compact/TypeScript/Python setup and full test commands.
- Actual synthetic GNU Health setup and independent verifier workflow, bounded diagnostics and explicit trust boundaries.
- Accurate README, security/dependency/validation reports, contribution/license files and CI configuration.
- Removed stale local deployment metadata. Generated outputs and local credentials/state are excluded.

Only README/security/validation/release-context documentation, a GPL SPDX notice/trailing whitespace cleanup, and full component-license source/package inclusion differ from the already validated local source transfer. Application behavior is preserved.

## Validation results

- **86 automated checks passed:** 18 Node/API/browser/diagnostic, 60 Compact, 4 Python encoding and 4 real Tryton wizard/session/security tests.
- All Compact compilation, strict TypeScript checks and workspace production builds passed in this real Git clone.
- The full synthetic GNU Health → authenticated bridge → real contract → independent verifier workflow passed in 278158 ms, including exact-code rejection of wrong recipient, expired/revoked tokens and withdrawn records.
- README credential generation and all three npm development-service HTTP smoke checks passed.
- The Tryton wheel builds and includes its full GPL terms; Python checks pass after the license packaging change.
- Inherited history, staged filenames/content and final proposed source are checked with full redaction. No actual credentials, private patient data, developer-specific paths or generated outputs are included. Only empty .env.example placeholders and explicitly public local-devnet/test material are tracked.
- New commit author/committer metadata uses the GitHub public handle and no-reply email. Existing author metadata is preserved as part of the original history.
- The final commit is created only after the finalized staged tree's command and secret checks pass. Full inherited-plus-release history is rescanned after creation.

See VALIDATION_REPORT.md and DEPENDENCY_AUDIT.md for detailed evidence and scope. npm audit still has twelve moderate package entries from one runtime advisory, with no reachable sink found in current Chart usage and no compatible non-breaking upstream fix.

## Exact changed-file inventory

67 files: 41 added, 25 modified, 1 removed.

| Status | File |
| --- | --- |
| A | `.env.example` |
| A | `.github/workflows/ci.yml` |
| M | `.gitignore` |
| A | `AUDIT_REPORT.md` |
| A | `CHANGE_PLAN.md` |
| A | `CONTRIBUTING.md` |
| A | `DEPENDENCY_AUDIT.md` |
| A | `LICENSE` |
| M | `README.md` |
| A | `RELEASE_PREPARATION.md` |
| A | `SECURITY.md` |
| A | `VALIDATION_REPORT.md` |
| D | `bridge/deployed-contract.json` |
| M | `bridge/package.json` |
| A | `bridge/src/app.ts` |
| A | `bridge/src/diagnostics.ts` |
| M | `bridge/src/index.ts` |
| M | `bridge/src/midnight.ts` |
| A | `bridge/src/security.ts` |
| M | `bridge/src/syntheticData.ts` |
| A | `bridge/test/api.test.mjs` |
| A | `bridge/test/diagnostics.test.mjs` |
| A | `bridge/test/runtime.test.mjs` |
| A | `bridge/test/syntheticData.test.mjs` |
| M | `contracts/package.json` |
| M | `contracts/src/gnuhealth_disclosure.compact` |
| M | `contracts/test/submitRecordBundle.test.ts` |
| M | `contracts/test/verifyCriticalFlagsBundle.test.ts` |
| M | `contracts/test/verifyLabResultBundle.test.ts` |
| M | `contracts/test/verifyVaccinationBundle.test.ts` |
| A | `docker-compose.integration.yml` |
| M | `docker-compose.yml` |
| M | `package-lock.json` |
| M | `package.json` |
| A | `requirements-integration.lock.txt` |
| A | `requirements-integration.txt` |
| A | `scripts/check-release-content.mjs` |
| A | `scripts/check-sensitive-files.mjs` |
| A | `scripts/clean.mjs` |
| A | `scripts/compile-contracts.mjs` |
| A | `scripts/create-local-env.mjs` |
| A | `scripts/devnet-diagnostics.mjs` |
| A | `scripts/devnet-e2e.mjs` |
| A | `scripts/gnuhealth-synthetic.py` |
| A | `scripts/setup-gnuhealth.mjs` |
| A | `scripts/test-gnuhealth.py` |
| A | `scripts/test/devnet-diagnostics.test.mjs` |
| A | `tryton_modules/health_midnight_disclosure/COPYING` |
| A | `tryton_modules/health_midnight_disclosure/encoding.py` |
| M | `tryton_modules/health_midnight_disclosure/patient.py` |
| A | `tryton_modules/pyproject.toml` |
| A | `tryton_modules/tests/test_encoding.py` |
| M | `verifier/server/package.json` |
| A | `verifier/server/src/app.ts` |
| A | `verifier/server/src/diagnostics.ts` |
| M | `verifier/server/src/index.ts` |
| M | `verifier/server/src/midnight.ts` |
| A | `verifier/server/src/security.ts` |
| A | `verifier/server/test/api.test.mjs` |
| M | `verifier/web/package.json` |
| M | `verifier/web/src/App.css` |
| M | `verifier/web/src/components/PrivacyInspector.tsx` |
| M | `verifier/web/src/components/VerifierView.tsx` |
| A | `verifier/web/src/lib/bundle.ts` |
| M | `verifier/web/src/lib/identity.ts` |
| A | `verifier/web/test/input.test.mjs` |
| M | `verifier/web/vite.config.ts` |

A = added, M = modified, D = removed. The remaining 31 inherited source files are unchanged. The final proposed tree contains 97 tracked files.

## Review commands

```sh
git status --short
git log -1 --format=fuller
git diff eef30142de5563d296c86df7056a199d2d5c90a4 HEAD --name-status
git show --stat HEAD
npm run check:release
```

## Known limits

The twelve moderate runtime package findings trace to one upstream cookie advisory; no reachable cookie-writing sink was found in current usage, and no compatible non-breaking upstream fix is available. The earlier finalization timeout has not been conclusively explained; timing/public-transaction diagnostics and unknown-outcome guidance remain. This is a local synthetic research demonstration, not clinical or production software. Remote CI and public-network deployment are not validated by these local checks.
