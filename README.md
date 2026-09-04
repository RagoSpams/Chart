# Chart

Chart adds zero-knowledge, scoped disclosure on top of GNU Health, a real open-source Hospital and Health Information System (GPL-3.0, a UN-recognized Digital Public Good, in production use in national health systems). Built for the "Integrate Midnight" track of a Midnight hackathon.

## The problem

GNU Health stores full electronic health records, but sharing that data across institutional boundaries — a specialist, an insurer, a clinical trial recruiter, a researcher — is currently binary: the requesting party gets full record access, or none at all. There's no way to prove a narrow claim, like "this patient's vaccination status meets requirement X" or "this lab result is within range," without exposing the entire record.

Chart adds that missing piece: proving one narrow fact about a patient record to exactly the party who needs it, without ever exposing the record itself.

## How it works

- **GNU Health (Tryton, Python)** — the existing app. A new module adds a "Request Disclosure" action to the patient record view.
- **Bridge service (Node/TypeScript)** — wraps the Midnight SDK, receiving requests to commit record data, issue disclosure tokens, and verify scoped claims.
- **Midnight ledger** — stores commitments to hashed record bundles and scoped, expiring, revocable disclosure tokens. Zero-knowledge verification circuits prove a narrow predicate (e.g. "vaccination status meets requirement") without revealing the underlying record.
- **Standalone verifier app** — lets an outside party (a regulator, a researcher) check a disclosure token independently, with their own identity, without needing any access to the hospital system itself.

Three disclosure categories are implemented: vaccination status, lab results, and critical patient flags — each with its own typed verification circuit (7 Compact circuits total, 52 passing tests).

## What's real

This isn't a mockup layered on sample data. It runs against a real, live GNU Health 5.0.5 instance with the official demo dataset, and every step — the Tryton button, the bridge service, the on-chain contract calls, the standalone verifier — is exercised end-to-end against a real local Midnight devnet, including real transaction hashes and block heights.

## A technical obstacle worth mentioning

GNU Health's official Docker demo images turned out to be outdated and version-mismatched against the current stable release, so before any of the actual integration work could start, I had to work out a real deployment path myself — a Debian 13 container matching GNU Health's tested OS list, the official demo database dump imported directly, and targeted module activation (rather than activating all 56 bundled modules, which never completed) to get a working instance with real synthetic patient data.

Another one: getting the bridge service to talk to the deployed contract surfaced a dependency conflict — two copies of the same WASM module loaded from different package versions, which broke `instanceof` checks between them. Fixed with a package.json override forcing a single resolved version across the whole dependency tree.

## Status

Actively continuing development post-hackathon, including conversations with the Midnight team about the project.

## Tech stack

Python/Tryton, Node.js/TypeScript, Compact (Midnight's smart contract language), React (verifier frontend), Docker.
