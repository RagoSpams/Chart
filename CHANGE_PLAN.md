# Chart improvement plan

This file documents follow-up work, not verified defects.

## P0 - correctness and trustworthy verification
- Test valid proof, incorrect value, wrong verifier, expired token, revoked token, replay, stale record, and wrong record commitment.
- Define source authenticity and provenance: a proof of a committed fact is not proof that a clinician entered the correct fact.
- Document all public inputs, metadata leakage, and commitment-binding assumptions.
- Ensure private fields never enter logs or ledger transaction payloads.

## P1 - reproducible local demo
- Provide `.env.example` with dummy values and an explicit quickstart.
- Seed exactly one synthetic scenario per predicate and display the expected result.
- Provide `docker compose` health checks and an end-to-end script with a bounded timeout.
- Pin toolchains/SDK/compiler versions and keep lockfiles synchronized.

## P2 - open-source experience
- Add diagrams describing GNU Health -> bridge -> Midnight -> verifier and trust boundaries.
- Publish standalone examples for vaccination, laboratory threshold, and critical flag.
- Add API examples, concise error messages, and troubleshooting guidance.
- Explain when selective FHIR access or an off-chain signed credential is sufficient instead.

## P3 - evidence
- Report test coverage and real local devnet results separately from mocked tests.
- Benchmark proof generation, verification, latency, and overhead on documented hardware.
- Add dependency scanning, release tagging, and project license checks.


## Implemented in this revision
- Block later verification of withdrawn records (contract plus regression test).
- Opt-in only raw bundle export, default loopback service/network binding, restricted verifier CORS origin.
- Cryptographic random record IDs and salts, strict 32-byte hex and integer/boolean parsing.
- Remove workstation-specific Tryton bridge URL; document environment settings.
- Add basic Node tests, CI, a MIT license, and detailed trust-boundary README.

## Current validation status

See VALIDATION_REPORT.md for current evidence. Compact compilation, circuit tests, Node/API/browser-input tests, Python encoding and Tryton wizard/security checks, workspace builds, and a real synthetic GNU Health-to-Midnight-to-independent-verifier run have now been executed. Remaining work includes the 12 moderate Midnight dependency advisories, production identity/consent architecture, clinical provenance/units/freshness, public-network migration and browser interaction coverage. This remains a local synthetic demonstration.
