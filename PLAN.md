# GNU Health × Midnight — Project Plan & Claude Code Prompt Library

**Track:** Integrate Midnight ("take an app that already exists and add privacy
with Midnight. Show us the before and after.")

**Tagline (working):** "Full record, or nothing, was never the only option."

---

## 1. Project Framework

### The existing app
[GNU Health](https://www.gnuhealth.org) — a real, actively maintained, GPL-3.0
open-source Hospital and Health Information System. Not a toy or unknown repo:
it's an official GNU project, declared a Digital Public Good, adopted by the
United Nations, and deployed in national public health systems (Argentina,
India, Jamaica, Laos, Cameroon, Suriname). Stable release 5.0.5 (Dec 2025).
Built on the Tryton framework (Python).

### The problem
GNU Health stores full electronic health records — but sharing any of that data
across institutional boundaries (a specialist, an insurer, a clinical trial
recruiter, a researcher) is currently binary: either the requesting party gets
full record access, or they get nothing. There's no native way to prove a
narrow claim — "this patient qualifies for this trial," "this patient's
vaccination status meets requirement X," "this lab result is within range" —
without exposing the entire record.

### The one-sentence reframe (judge-repeatable)
"GNU Health already runs real hospitals — we add the missing piece: proving
one narrow fact about a patient record to exactly the party who needs it,
without ever exposing the record itself."

### Why this scores well against the pattern (cross-referenced against three
prior Midnight hackathon events' actual winners)
- **Genuine "before and after,"** exactly matching this track's own framing —
  not a mockup, a real running instance of software real hospitals use today.
- **The single most repeated winning primitive** (scoped, revocable,
  multi-recipient disclosure) applied to the highest-stakes data category
  reviewed across any event so far.
- **Real, hard cross-stack integration** (Python/Tryton ↔ TypeScript/Compact)
  — genuine engineering depth, not a superficial "add a button."
- **Direct alignment with real research/clinical background** — carries even
  more directly than the pharma-manufacturing framing did previously.

### Critical constraint — read before building anything
**All demo data must be clearly synthetic.** Health record data is a uniquely
sensitive category. Use GNU Health's own built-in demo/sample database only.
Never introduce anything that could be read as real patient information, even
hypothetically. This isn't optional polish — it's a hard requirement.

### Honest complexity note
This is a harder build than a from-scratch app: new framework (Tryton/Python),
a genuine cross-language bridge to the Midnight SDK, and — discovered during
initial research — the official GNU Health Docker demo setups are old and
version-mismatched (some pinned to a decade-old GNU Health/Tryton release
rather than current 5.0.5). **Prompt 1 exists specifically to surface this
risk immediately, before any design work is wasted on assumptions.**

---

## 2. Architecture (conceptual — will be refined after Prompt 1's findings)

```
GNU HEALTH (Tryton, Python) — the existing app
  ├── Real patient/health record models (confirmed 2026-08-27 — see Section 3,
  │     "Prompt 1 Findings": gnuhealth.patient, gnuhealth.patient.disease,
  │     gnuhealth.pathology, gnuhealth.vaccination, gnuhealth.patient.lab.test /
  │     gnuhealth.lab, gnuhealth.patient.evaluation)
  └── NEW: a custom Tryton module adding a "Request Scoped Disclosure" action
        on the patient record view

        │  calls out via REST/RPC
        ▼

BRIDGE SERVICE (Node/TypeScript) — new, built this project
  ├── Wraps the Midnight SDK (same pattern as the prior Assay project)
  ├── Receives: a request to commit record data / issue a disclosure token /
  │   verify a scoped claim
  └── Talks to the Midnight ledger via compiled Compact circuits

        │

MIDNIGHT LEDGER
  ├── Commitments to (hashed) health record bundles
  ├── Scoped, expiring, revocable disclosure tokens
  └── Verification circuits — same proven pattern as before: prove a narrow
      predicate (e.g. "trial-eligible: yes/no") without revealing the
      underlying record
```

This reuses the exact scoped-disclosure-token architecture already proven out
in the prior project (commitments → tokens → scoped verify circuits →
disclose() only the boolean) — the novelty and complexity here is the
integration surface (real Tryton app, real Python↔TS bridge), not the core
ZK design pattern, which is now a known-working template.

---

## 3. Claude Code Prompt Library

**Status as of 2026-08-27: Prompts 1–5 complete**, including an ad-hoc
"Prompt 3.5" that wired the bridge service to the real deployed circuits.
The full Tryton → bridge → Midnight path works end-to-end with real GNU
Health data via one narrow-scope button (screenshotted working in the actual
sao web client, not just JSON-RPC), and a fully separate standalone
verifier app (`verifier/server` + `verifier/web`) proves an outside
regulator/researcher can check a disclosure token with their own
browser-generated identity, talking only to its own server — never to
Tryton or the institution's bridge — with a real PASS screenshotted end to
end. See each prompt's own "Findings" section below for details. Remaining
work (full demo script, before/after README narrative, revocation/expiry UI
polish) is not started.

### Prompt 1 — Spike: validate GNU Health deployment (do this first, alone)
```
I'm starting a new hackathon project integrating Midnight (a ZK-privacy
blockchain platform) with GNU Health, a real open-source Hospital/Health
Information System (gnuhealth.org, GPL-3.0, built on the Tryton framework).

Before any design work, I need you to validate that I can actually get a
working local GNU Health instance running, since the official Docker demo
setups I've found look outdated (some pinned to a decade-old release, health30
database, Tryton 3.8) versus the current stable release (5.0.5, Dec 2025).

Please:
1. Investigate the current recommended installation method for GNU Health
   5.0.x — check their official docs/GitHub, not just old Docker Hub images.
2. Attempt to stand up a working local instance — Docker if a current,
   maintained setup exists; otherwise a direct install via their documented
   method. Use whatever OS/environment makes this most likely to succeed
   (we're on WSL Ubuntu, same as my prior project).
3. Once running, log in with the demo/sample database GNU Health ships with
   and confirm you can see sample patient records.
4. Document the EXACT data model for patient health records: field names,
   types, and structure — specifically anything relevant to things like lab
   results, vaccination/immunization records, diagnoses, or trial-eligibility-
   relevant data. I need real field names to design ZK circuits against later,
   not assumptions.
5. Be completely honest about what worked and what didn't — if the current
   version is genuinely hard to stand up, tell me exactly what broke and try
   one reasonable alternative (e.g., an older-but-still-real stable version)
   rather than silently downgrading or faking success.

Report back with: what's actually running, what version, how you got there,
and the real patient record schema you found.
```

### Prompt 1 Findings (completed 2026-08-27)

**Verdict: GNU Health 5.0.5 is real and deployable.** The plan's suspicion
about outdated official Docker setups was correct, but a working native path
exists.

**Environment that worked:**
- **Debian 13 (Trixie)** Docker container — chosen deliberately over the WSL
  host's native Ubuntu 26.04, whose Python 3.14 is far outside GNU Health's
  tested range (`Python >= 3.10`, tested up to Ubuntu 22.04 LTS). Debian 13 is
  on GNU Health's own tested-OS list and ships Python 3.13 + PostgreSQL 17,
  both within spec.
- `trytond` **7.0.56** (matches docs: GH 5.0.x → Tryton 7.0) + `gnuhealth-all-modules`
  (pulls 56 separate `gnuhealth-*` pip packages: core, lab, immunization,
  disease, dentistry, surgery, imaging, genetics, etc.)
- Database: PostgreSQL 17, database `ghdemo50`, loaded from GNU Health's own
  official dump `gnuhealth-50-demo.sql.gz` (from
  `gnuhealth.org/downloads/postgres_dumps/`) — 438 tables, 10 synthetic
  patients (the documented "Betz family" demo dataset — patient id=1 is
  "Ana Isabel" Betz).

**The official installer doesn't work headlessly.** `gnuhealth-control`
(`ghcontrol`), GNU Health's own documented installer since HIS 5.0, is a
full-screen curses TUI — it hard-fails (`_curses.error: setupterm`) with no
controlling terminal, and piped stdin can't drive a curses UI. This is a real
gap in the official tooling, not something specific to our setup.
**Workaround:** bypass `ghcontrol` and do what it does under the hood
directly — `pip install trytond gnuhealth-all-modules` into a venv, then
import the official demo dump straight via `createdb` + `psql` (this is
exactly what GNU Health's own `install_demo_database.sh` script does — no
`ghcontrol` needed for that part).

**Module activation: target specific modules, don't use `--all`.**
`trytond-admin --all` (activating all 56 installed `gnuhealth-*` modules at
once) did not complete even after a 550-second timeout. Activating only the
modules actually needed — `trytond-admin -u health health_lab
--activate-dependencies` — succeeded. `health` depends only on base Tryton
modules (`party`, `company`, `currency`, `product`); `health_lab` depends only
on `health`; immunization/vaccination data lives in core `health` already (no
separate immunization module needed). **Recommendation: always activate a
targeted module list for this project, never `--all`.**

**Realistic activation time: 15–25 minutes, and it's not a resource problem.**
Investigated explicitly to rule out under-provisioning:
- `.wslconfig`: `memory=16GB`, no CPU cap (WSL2 uses all 12 host logical
  processors) — `free -h` showed 8–13GB free/available throughout, 0 swap
  used. Not memory-constrained.
- `docker stats`: container used ~1.1GB / 15.6GB (7%) memory. Not
  memory-constrained. `trytond-admin` is single-threaded, so it can only
  ever use 1 of 12 available cores regardless — more cores wouldn't help.
- Precise `/proc/[pid]/stat` CPU-tick sampling over fixed wall-clock windows
  confirmed the process was genuinely computing (not blocked on I/O or
  hung) throughout the run.
- **Actual cause of the runtime:** the `health` module ships large bundled
  reference datasets, each loaded as an individual ORM row-upsert:
  **47,526 ICD-10 codes, ~44,056 genes, ~6,740 protein-disease associations**,
  plus WHO essential-medicines/drug data. That volume, loaded row-by-row, is
  legitimately 15–25 minutes of work on this hardware — not a sign of a
  deeper performance problem, and not something more RAM/CPU would fix.

**Operational gotcha: keep the host machine awake during long runs.** During
this spike, the Windows host appears to have gone to sleep/idle for stretches
between check-ins (evidenced by internal process-clock artifacts — e.g.
long-lived `postgres` processes showing impossible jumps in their recorded
start time). This didn't corrupt any data, but it silently killed one
in-progress `trytond-admin` run with no error message, wasting a cycle.
**Disable sleep on the host for the duration of any long unattended
activation or migration run.**

**Password-hash-format fix needed for login.** The demo dump's stored admin
password hash uses a format current `trytond` 7.0.56 can't parse
(`getattr(cls, 'check_' + hash_method)` fails because `hash_method` resolves
empty) — a real incompatibility between the aged dump and current Tryton,
not a credentials typo. **Fix:** `trytond-admin -d ghdemo50 -p` (reads a new
password from `$TRYTONPASSFILE` and sets it directly). **Do not use
`--reset-password`** — that triggers Tryton's email-token reset flow, which
just fails (no SMTP server available) and leaves the account unusable.

**Confirmed live and working end-to-end.** With the fixes above applied,
`trytond` serves JSON-RPC on port 8000, `common.db.login` succeeds, and an
authenticated `model.gnuhealth.patient.read` call returns real (synthetic)
data:
```
{"critical_info":"Severe allergic reactions to β-lactams.","blood_type":"A",
 "crit_dbt":true,"crit_allergic":true,"id":1,"party.":{"name":"Ana Isabel","id":2}}
```
This is the same JSON-RPC interface the bridge service (Node/TypeScript) will
call in later prompts.

**Real patient-record schema** (field names confirmed directly against the
live database — this is what grounds Prompt 3 below):

| Table (Tryton model) | Purpose | Key fields |
|---|---|---|
| `gnuhealth_patient` (`gnuhealth.patient`) | Core patient record — ~124 columns | `party` (FK to identity/name), `blood_type`, `rh`, `deceased`, `family`, `current_insurance`, `primary_care_doctor`; critical-condition flags `crit_dbt`, `crit_cardio`, `crit_allergic`, `crit_cancer`, `crit_immuno`, `crit_mental`, `crit_nutrition`, `crit_social`, `crit_cognitive`; plus dozens of lifestyle/SES fields |
| `gnuhealth_patient_disease` (`gnuhealth.patient.disease`) | Diagnoses | `pathology` (FK), `is_active`, `is_allergy`, `allergy_type`, `status`, `diagnosed_date`, `healed_date`, `is_infectious`, `lab_confirmed`, `pregnancy_warning`, `healthprof`, `institution` |
| `gnuhealth_pathology` (`gnuhealth.pathology`) | ICD-coded condition catalog | `code`, `name`, `category`, `gene`/`protein`/`chromosome` (genetic conditions) — 47,526 real ICD-10 rows loaded |
| `gnuhealth_vaccination` (`gnuhealth.vaccination`) | Immunizations | `vaccine` (FK to medicament), `dose`, `date`, `next_dose_date`, `state`, `admin_route`, `vaccine_lot`, `vaccine_expiration_date` |
| `gnuhealth_patient_lab_test` / `gnuhealth_lab` (`gnuhealth.patient.lab.test` / `gnuhealth.lab`) | Lab orders vs. results (split tables) | order: `test_type`, `state`, `date`, `urgent`; result: `results` (text), `date_analysis`, `diagnosis`, `pathology`, `state`, `specimen_type` |
| `gnuhealth_secondary_condition` (`gnuhealth.secondary_condition`) | Comorbidities per evaluation | `pathology`, `evaluation` (FK) |
| `gnuhealth_patient_evaluation` (`gnuhealth.patient.evaluation`) | Visit/vitals | `bmi`, `glycemia`, `hba1c`, `cholesterol_total`, `ldl`, `hdl`, `systolic`/`diastolic`, `diagnosis` (FK), `related_condition` (FK to patient_disease) |

Row counts in the demo dataset: 10 patients, 4 diagnoses, 7 vaccinations, 15
lab results, 18 lab orders, 47,526 pathology/ICD codes.

### Prompt 2 — Bridge service + Compact workspace scaffolding
```
Now that GNU Health is running locally (from Prompt 1), scaffold the new
project alongside it — do not modify GNU Health's core code yet, just set up
our new components:

1. A Compact contract workspace (contracts/src/) — same structure as my prior
   Midnight project (compiler/SDK versions may have moved on; check current
   versions rather than assuming).
2. A bridge service (bridge/) — a Node/TypeScript service that will wrap the
   Midnight SDK and expose a small REST API for: committing a record bundle,
   issuing a disclosure token, and verifying a scoped claim. Stub the
   endpoints for now with clear TODOs — we'll implement the real logic once
   circuits are designed in Prompt 3.
3. Confirm the bridge service can be reached via HTTP from outside (since
   Tryton/Python will need to call it later) — a simple health-check endpoint
   is enough to prove this for now.
4. Docker setup for the local Midnight devnet (proof server, node, indexer) —
   reuse the midnight-local-dev tool approach from my prior project rather
   than a hand-rolled docker-compose, since that was the more reliable path
   last time.

Don't touch GNU Health's own files yet. Report what's scaffolded and confirm
the bridge service's health check responds.
```

### Prompt 3 — Circuit design, grounded in real schema
```
Using the real GNU Health patient record schema confirmed in Prompt 1 (see
"Prompt 1 Findings" above — models `gnuhealth.patient`,
`gnuhealth.patient.disease`, `gnuhealth.pathology`, `gnuhealth.vaccination`,
`gnuhealth.patient.lab.test` / `gnuhealth.lab`, `gnuhealth.patient.evaluation`),
design (on paper first, then implement) a set of Compact circuits following
this proven pattern from my prior project:

- submitRecordBundle: manufacturer-equivalent-role (a clinician/institution)
  commits hashed bundles of specific record categories. Pick 3-4 meaningful,
  distinct categories grounded in the REAL confirmed fields — strong
  candidates from what's actually in the schema:
    - immunization status, from `gnuhealth.vaccination` (`vaccine`, `dose`,
      `date`, `state`)
    - a lab-result category, from `gnuhealth.lab` (`results`, `pathology`,
      `state`, `date_analysis`) — e.g. "result within range" as the disclosed
      predicate, not the raw value
    - diagnosis/condition status, from `gnuhealth.patient.disease`
      (`pathology`, `is_active`, `status`, `diagnosed_date`) plus the
      `gnuhealth.pathology` ICD code it references
    - trial-eligibility-relevant flags, from `gnuhealth.patient`'s
      critical-condition booleans (`crit_dbt`, `crit_cardio`, `crit_allergic`,
      etc.) and/or vitals in `gnuhealth.patient.evaluation` (`bmi`,
      `glycemia`, `hba1c`)
  Treat this as a grounded starting point, not a final answer — confirm the
  exact field combination during Prompt 3 itself, don't force the prior
  project's categories onto this data
- issueDisclosureToken: scoped to specific bundle(s), expiring, revocable
- verifyBundle (one per category, following the "no polymorphism in Compact"
  lesson from before — separate typed circuits, not one generic one): proves
  a bundle-specific predicate, discloses only a boolean
- revokeToken / a way to mark a record bundle as withdrawn/superseded

Write out the full typed circuit design the way we did last time — real
struct definitions, domain-separated identity derivation, explicit salt
handling — before writing any Compact code. Show me the design for review
before implementing.
```

### Prompt 3 Findings (completed 2026-08-27)

**Design approved, three bundle categories:** vaccination status, lab
results, critical allergy/medical flags. Disease/pathology was considered
and dropped as a fourth category — weaker demo story. `critAllergic` already
lives directly on `gnuhealth.patient`, so critical flags stayed fully
independent of the dropped `gnuhealth.patient.disease`/`gnuhealth.pathology`
tables.

**Full circuit set implemented** in `contracts/src/gnuhealth_disclosure.compact`:
`deriveInstitutionId`, `deriveRecipientPubKey`, `submitRecordBundle`,
`withdrawRecordBundle`, `issueDisclosureToken`, `revokeToken`,
`checkTokenValidity` (internal, shared precondition), and three typed verify
circuits — `verifyVaccinationBundle`, `verifyLabResultBundle`,
`verifyCriticalFlagsBundle`. Critical flags use a selector pattern
(`requestedFlag: Uint<8>`, `assert(requestedFlag <= 8, ...)` before an
if/else-if chain discloses exactly one of nine flags) rather than nine
separate circuits — a deliberate, approved divergence from the prior
project's "no polymorphism in Compact" rule: this is same-typed runtime
branching (all nine fields are `Boolean`), not the differently-typed-witness
problem that actually forced four separate `verify*Bundle` circuits before.

**Compiles clean — 7 circuits, full ZK artifacts** (zkir + prover/verifier
keys) for each.

**Tests: 52 passing across 7 files**, matching or exceeding Assay's
per-circuit depth: happy path, predicate-false, expired, revoked,
out-of-scope grant, wrong recipient, tampered data, tampered salt — plus a
wrong-vaccine/wrong-test-type binding test per category and a full 9-flag
independent-selection sweep for critical flags.

**Two real Compact-language findings** (worth keeping in mind for any future
circuit work):
- Mixing an already-`disclose()`d value (e.g. a `kernel.blockTimeGreaterThan`
  result) with a still-undisclosed witness field in the same boolean
  expression trips the disclosure checker — every operand feeding a
  disclosed expression needs its own `disclose()`, not just the outer
  combination.
- `if`/`else`/`else if` are valid Compact statements (never exercised by the
  prior project, which had no need for them) — but a branch condition
  derived from a witness value needs `disclose()` on the condition itself
  before it can guard a ledger write or a `return`, same rule as everywhere
  else, just not previously documented.

### Prompt 3.5 — Wire bridge service to real circuits (isolated from Tryton)
```
Wire the bridge service's stub endpoints to the real circuits now — but stay
isolated from Tryton entirely for this step. For each endpoint
(/record-bundle, /disclosure-token, /verify): implement the real call into
the compiled circuits via the SDK, using synthetic test data you construct
directly in the bridge service (not pulled from GNU Health yet). Verify each
endpoint works end-to-end via direct HTTP calls (curl or a test script) —
submit a record bundle, issue a token, verify a bundle successfully, verify
an out-of-scope/expired case fails correctly. This proves the
bridge-to-Midnight half of the integration works before we touch the harder,
newer half: getting Tryton to actually call this bridge with real patient
data. Report exactly what you tested and the real responses.
```

### Prompt 3.5 Findings (completed 2026-08-27)

**Real end-to-end deployment achieved** — genesis-seeded local wallet (no
browser wallet, no faucet needed for the local devnet), real sync, real
NIGHT balance (250,000,000,000,000 tNight from genesis), real DUST
registration, genuine on-chain contract deployment via `midnight-js-contracts`'
`deployContract`/`findDeployedContract`, confirmed across multiple runs with
distinct real contract addresses. New bridge files: `network.ts`, `wallet.ts`,
`witnesses.ts`, `midnight.ts`, `syntheticData.ts`.

**Two real bugs found and fixed, neither in our own contract:**
- **`PrivateState = null` can never round-trip through `levelPrivateStateProvider`.**
  `midnight-js-contracts`' internal `getStates()` does
  `assertDefined(privateState, ...)` on whatever the provider returns, and
  `assertDefined` (from `midnight-js-utils`) throws on `null` specifically —
  even though `null` was the correctly-stored value. Fixed by switching
  `PrivateState` from `null` to `{}` (`Record<string, never>`) — functionally
  identical for this contract (neither witness reads or writes it), but
  round-trips cleanly.
- **Duplicate `onchain-runtime-v3` WASM module → `"expected instance of
  StateValue"` on every real circuit call.** `midnight-js-protocol@4.1.1`
  directly pins `onchain-runtime-v3` to exactly `3.0.0` in its own
  `package.json`, independent of our own `compact-runtime@0.16.0`'s
  `^3.0.0` (which resolved to `3.1.0`) — npm couldn't dedupe an exact pin
  against a range that resolved higher, so two separate copies of the WASM
  module loaded, and objects from one copy failed `instanceof` checks
  against classes from the other. **Root cause confirmed against a real
  Midnight forum post** (`forum.midnight.network`, "Dev status update: Aug
  15-21") describing this exact error class; their prescribed fix ("bump
  compact-js to 2.5.3") didn't apply to our pinned `midnight-js-protocol@4.1.1`
  line (its exact pin is independent of `compact-js`'s version, and
  `compact-js@2.5.3`+ is itself currently uninstallable — it depends on
  `@midnight-ntwrk/ledger-v9@^0.1.0-alpha.1`, a version never published to
  npm). **The fix that worked:** a root `package.json` `overrides` entry
  forcing `@midnight-ntwrk/onchain-runtime-v3` to `3.1.0` everywhere,
  including inside `midnight-js-protocol`'s nested `node_modules` — verified
  via `npm ls @midnight-ntwrk/onchain-runtime-v3 --all` and a direct
  filesystem search that only one copy exists post-install. This is a
  general Midnight SDK/npm-workspace gotcha, not specific to this project —
  worth remembering for any future Midnight package upgrades.

**Full real on-chain test, all real transactions (`status: SucceedEntirely`,
real `txHash`/`blockHeight`/fees):**

| Call | Result |
|---|---|
| Deploy | Real contract address (new each run, e.g. `82fd238af7...`) |
| `submitRecordBundle` | `HTTP 200`, real tx, e.g. `blockHeight: 1786` |
| `issueDisclosureToken` | `HTTP 200`, real tx |
| `verifyVaccinationBundle` (valid token) | `HTTP 200`, `pass: true`, real tx |
| `verifyVaccinationBundle` (token scoped without vaccination grant) | `HTTP 500` — `"failed assert: Token does not grant access to the Vaccination bundle"` |
| `verifyLabResultBundle` (expired token) | `HTTP 500` — `"failed assert: Token has expired"` |
| `verifyCriticalFlagsBundle` (requestedFlag=2, critAllergic) | `HTTP 200`, `pass: true`, real tx |

The two failure cases are our contract's own `assert()` messages firing for
real on-chain — not simulated, not caught by validation before reaching the
circuit.

### Prompt 4 — Minimal Tryton module: real "Request Disclosure" button
```
Build a minimal Tryton module that adds a single button/action ("Request
Disclosure") to the GNU Health patient view, which calls the bridge's
/record-bundle endpoint with that patient's real vaccination/lab/
critical-flags data (pulled from GNU Health's own database), instead of the
bridge's synthetic test data. Keep scope narrow — one button, one real data
flow, proving the actual Tryton→bridge→Midnight path works end-to-end with
real GNU Health data. Don't attempt the full disclosure-token/verify UI in
Tryton yet — that's a later step once this first real connection is proven.
```

### Prompt 4 Findings (completed 2026-08-27)

**Full real Tryton → bridge → Midnight path proven end-to-end.** New module
`tryton_modules/health_midnight_disclosure/` (installed into the
`gnuhealth-spike` container's `trytond/modules/`), adding a real "Request
Disclosure" button to the patient view.

**Real button mechanism, not invented.** Searched every one of the 56
installed GNU Health modules for how extension modules add functionality to
the patient view: **none** use XML view-inheritance-with-xpath to inject a
literal `<button>` into the existing patient form — that mechanism exists in
Tryton but isn't how this ecosystem actually extends views. The real,
consistently-used pattern (confirmed in `health_imaging`'s "Generate Result"
button) is `ir.action.wizard` + `ir.action.keyword(keyword='form_action',
model='gnuhealth.patient,-1')` — a wizard bound to the model that renders as
a real action button in the client's form toolbar. Used that pattern
directly rather than the untested xpath route.

**Wizard is a single `StateTransition`** (`start`) that does the real work —
pull this patient's data, POST to the bridge — then transitions straight to
a read-only `StateView` (`result`) showing what was actually submitted.
Errors from the bridge surface as a Tryton `UserError` (dismissible dialog
with the real HTTP status/message), not a silent failure.

**Real data mapping, grounded against the actual demo dataset (not
assumed):**
- Vaccination: most recent `gnuhealth.vaccination` for the patient;
  `completed` maps to `state == 'done'`. **Real finding: only patient id=2
  has any vaccination records** in this demo dataset (7 rows, all patient
  2) — patient 1 (Ana Isabel Betz) has none.
- Lab result: most recent **validated** (`state == 'validated'`)
  `gnuhealth.lab`, then the first `gnuhealth.lab.test.critearea` row with a
  real numeric `result`/`lower_limit`/`upper_limit` — the actual analyte
  values live there, not in `gnuhealth.lab.results` (a free-text field,
  blank in this dataset). **Real finding: only patient id=1 has a validated
  lab** (a Complete Blood Count, id=13) — every other lab in the dataset is
  still `draft`. Values are ×10-scaled before sending (Compact's `Uint<32>`
  is integer-only; real values here carry one decimal, e.g. HGB `10.7` — the
  same offset-scale technique the prior Assay project used for temperature
  readings).
- Critical flags: `gnuhealth.patient`'s own `crit_*` booleans, direct —
  always real, never a placeholder (every patient has these fields, even if
  all `NULL`/false).

**No single demo patient has all three categories** — a real, honest finding
about the dataset, not a design flaw. Since `submitRecordBundle` requires
all three bundles atomically (an approved Prompt 3 design decision), the
module submits an explicit, clearly-labeled "not on file" placeholder
(`bytes32_hex('NO_VACCINATION_ON_FILE')` etc., `completed`/all-zero values)
for whichever category is genuinely absent for that specific patient, and
says so plainly in the result view — rather than fabricating plausible-looking
data. Tested and confirmed both non-placeholder paths for real:

| Patient | Vaccination | Lab result | Critical flags |
|---|---|---|---|
| id=1, Ana Isabel Betz | placeholder (honest) | **real**: HGB = 10.7 (range 11.0–16.0) from `gnuhealth.lab` id=13 | real |
| id=2, Errico | **real**: hepatitis B vaccine, dose 4, done, from `gnuhealth.vaccination` id=7 | placeholder (honest) | real |

Both runs produced a real deployed contract (`0406bb450a...`) and real,
distinct `recordId`s, confirmed by cross-checking the bridge's own log
against the wizard's returned `contract_address`.

**One real networking finding, found and fixed.** `host.docker.internal`
(Docker Desktop's usual container→host route) resolves fine from inside
`gnuhealth-spike` but connects to the **Windows host's** network stack, not
specifically into the WSL2 Ubuntu network namespace where the bridge
service actually listens — confirmed empirically (DNS resolved; connection
was refused even with the bridge running and healthy on the WSL side).
**Fix:** point the module at WSL2 Ubuntu's own `eth0` address instead
(verified reachable via `curl` from inside the container before adopting
it). This address is assigned by WSL2 and can change across reboots — fine
for this local proof, worth a config option before this goes further.

**Exercised via raw JSON-RPC** (`wizard.<name>.create` then
`wizard.<name>.execute` with `active_id`/`active_model` in the call
context) rather than a GUI client — no desktop/web Tryton client was set up
in this project, so this is the same interface a real client would use,
just driven directly. One protocol quirk worth remembering: omitting `"id"`
from the JSON-RPC request body returns the raw result unwrapped (no
`{"result": ...}` envelope) — caused one throwaway parsing mistake during
testing, not a real bug.

### Live UI confirmation (completed 2026-08-27)
Before moving to Prompt 5, confirmed the "Request Disclosure" button by hand
in the real sao (Tryton web client) UI, not just via raw JSON-RPC — screenshot
captured via Playwright driven inside the `gnuhealth-spike` container (root
access there avoids the WSL host's missing-sudo-password blocker for
Playwright's system-dependency install).

**One real UI finding, found and fixed.** Clicking a patient's name text in
the Patients list view does **not** open the `gnuhealth.patient` record —
that name field renders as a many2one link and follows it straight to the
underlying `party.party` form instead (confirmed via the URL hash:
`#.../model/party.party/2...`), a different model whose own keyword-action
toolbar (Check VIES / Erase / Replace) is what was actually visible, while
the correctly-registered "Request Disclosure" item sat inert in a dropdown
whose containing tab-pane happened to be hidden. **Fix:** double-click the
list row itself (outside the name cell) — standard Tryton list-open
behavior — which lands on the real `gnuhealth.patient` record
(`#.../model/gnuhealth.patient/1...`), where the "Launch action" dropdown
correctly shows "Request Disclosure" as a visible, clickable item. Not a bug
in the module or in sao — a many2one-link-vs-row-open distinction that only
surfaces when driving the UI programmatically instead of by hand.

With that fixed, the full click produced the real wizard result for Ana
Isabel Betz: Record ID `ef715eb226712e431c...`, Contract Address
`f074df00b3a3c4aa39...`, an honest "not on file" vaccination placeholder, the
real lab result `HGB = 10.7 (range 11.0-16.0) from gnuhealth.lab id=13, test
COMPLETE`, and a real crit_* flags submission note — matching the JSON-RPC
run exactly, now proven through the actual GUI a user would click.

### Prompt 5 — Standalone verifier/consumer web app
Separate from Tryton entirely — this is what an outside regulator or
researcher uses to check a disclosure token, since they shouldn't need
hospital-system access. Reuses the Verifier/Consumer view pattern from the
prior Assay project. Institution side (Tryton + bridge) and verifier side
(this app) stay cleanly separated: the verifier talks only to its own
`verifier/server`, never to `bridge/`, and generates its own recipient
identity client-side rather than sharing one with the institution.

### Prompt 5 Findings (completed 2026-08-27)

**Complete and proven end-to-end, standalone from both Tryton and bridge.**
`verifier/server` (Express + real Midnight SDK calls: `joinAsRecipient` via
`findDeployedContract`, the three `verify*Bundle` circuits, and a genuinely
public `getRecordStatus` read with no wallet/witness/proof involved) and
`verifier/web` (React, ported design system and Verifier/Consumer split from
the prior Assay project) are both built, installed, and tested against the
real local devnet.

**One real architectural gap, found and fixed.** The bridge's
`/disclosure-token` endpoint always issued tokens to its own fixed internal
synthetic recipient identity (`client.deriveRecipientPubKey()`) — there was
no way to issue to an external identity at all, which defeats the entire
point of a standalone verifier with its own independent identity. **Fix:**
`bridge/src/index.ts`'s `/disclosure-token` now accepts an optional
`recipientPubKey` (hex) in the request body, falling back to the old
internal default only when omitted — a minimal, backward-compatible change.
Verified by generating a fresh identity in `verifier/server`
(`/derive-pubkey`), issuing a token to its real pubkey from the bridge, and
confirming the on-chain committed cell matches exactly what was sent (not
the bridge's own default).

**Full real-circuit round trip confirmed** via `verifier/server`, completely
isolated from bridge/Tryton (own process, own privateStateId scoped by
secret, own `findDeployedContract` join rather than the deploy-time binding
bridge uses): a fresh 32-byte identity generated on the spot → real
`/verify` call against a real token → `pass:true` on correct lab-result data
(`HGB`-style bundle) with a genuine ZK proof and transaction; a repeat call
with tampered `testTypeId` correctly threw a hard commitment-hash assertion
failure (`Supplied lab result data does not match the record's committed
bundle`) rather than silently passing — confirms the commitment check is
real, not a rubber stamp. The public `/record-status` read returned
`{exists:true, withdrawn:false}` with no wallet/proof involved at all,
confirmed fast (no proof-generation delay).

**Confirmed live in the browser, not just via curl** — Playwright inside the
`gnuhealth-spike` container (same tooling as the Tryton UI screenshot)
loaded `verifier/web`, filled in the real contract/token/record IDs and
pasted bundle JSON, selected "Lab result", and clicked Verify: real ~25s
proof generation, then a genuine **PASS** stamp with the Privacy Inspector
correctly showing the raw lab values as redacted/private and only the
PASS boolean as disclosed. A first attempt using the browser's own
freshly-generated identity (not the one the token was issued to) correctly
failed instead of silently passing — confirms the app enforces identity
scoping, not just UI happy-path theater. Consumer check tab confirmed
separately: real contract/record ID → **ACTIVE** stamp via the plain public
ledger read.

**Two real environment findings, found and fixed, both worth remembering
for any future WSL work in this project:**
1. **WSL PATH silently resolves `npm`/`node` to Windows' own
   `/mnt/c/Program Files/nodejs`**, not a Linux-native binary — this distro
   has no native Node on PATH by default (only via `nvm`, which requires
   explicitly `source ~/.nvm/nvm.sh` in a non-interactive shell). Running
   `npm install` through Windows' npm.exe against a `\\wsl.localhost\...`
   UNC-mounted cwd works for simple one-level workspaces but throws a
   doubled-path `EISDIR` on `npm`'s own relative-symlink computation for a
   nested two-level workspace path (`verifier/web`) — confirmed reproducible
   twice. **Fix:** `source ~/.nvm/nvm.sh` before any npm operation in this
   project from now on, so it runs as a genuine Linux binary against the
   native filesystem.
2. **Editing a file via its `\\wsl.localhost\...` UNC path from a
   Windows-side tool does not reliably trigger `tsx watch`'s (or Vite's)
   inotify-based hot reload** on the Linux side — confirmed by editing
   `bridge/src/index.ts`, waiting well past any reasonable debounce, and
   finding zero reload log output before manually restarting. Any edit made
   this way to a file backing a running dev-mode process needs a manual
   process restart to actually take effect, not just a wait.

### Contract address stability fix (completed 2026-08-27)

**Real bug, found by the user cross-checking two live sessions.** The
contract address shown from a fresh Tryton "Request Disclosure" click didn't
match the address handed out earlier for the verifier demo. Root cause:
`GnuhealthDisclosureClient.deploy()` in `bridge/src/midnight.ts`
unconditionally called `deployContract(...)` — every fresh bridge process
(new `clientPromise`) minted a brand-new contract address on its first
request, with no persistence at all. Confirmed the Tryton module itself
plays no part in this — `patient.py` only ever echoes back whatever
`contractAddress` the bridge's response contains that call; it never
deploys or caches an address of its own.

**Fix:** `bridge/src/midnight.ts` now persists the deployed address to
`bridge/deployed-contract.json` (local file, not committed — it's only
valid for this specific local devnet's chain state) immediately after the
first real `deployContract`. On every subsequent `deploy()` call — i.e.
every bridge restart — it reads that file and, if present, calls
`findDeployedContract` to rejoin the existing contract as the institution
role instead of deploying a new one.

**Verified by two real restarts, not just reading the code back:**
- 1st restart (no persisted file yet, expected one-time transition): logged
  `no persisted contract found — deploying...`, deployed
  `57c09ed7a7cab1b4411ce05368e9bd8678430b1a0c5d4023432af9df0fdd50a8`, wrote
  `deployed-contract.json`.
- 2nd restart: logged `reusing persisted contract at
  57c09ed7a7cab1b4411ce05368e9bd8678430b1a0c5d4023432af9df0fdd50a8...` —
  same address, confirmed both in the log and in a real `/record-bundle`
  response's `contractAddress` field.
- The rejoined institution binding isn't just read-only: a real
  `submitRecordBundle` call through it after the 2nd restart returned
  `status: SucceedEntirely` — proves `findDeployedContract` genuinely
  restores write capability, not just address bookkeeping.

**Current canonical contract address for this demo session:**
`57c09ed7a7cab1b4411ce05368e9bd8678430b1a0c5d4023432af9df0fdd50a8`. It will
now stay fixed across any number of bridge restarts, for as long as this
local devnet's chain state persists (a `docker compose down -v` / fresh
devnet would invalidate it same as any other on-chain state, at which point
deleting `bridge/deployed-contract.json` lets the next restart deploy a new
one cleanly).

**Follow-on addition: `GET /record-bundle/:recordId`.** Needed to hand the
verifier app a real bundle+salt for a record submitted through Tryton's
wizard specifically — the wizard only ever reads back `recordId`/
`contractAddress` from the bridge's response, never the salt, so there was
no way to recover what was actually committed for a *specific* Tryton-driven
record after the fact. This endpoint just exposes the bridge's existing
in-memory `getRecordBundle` store (already used internally by `/verify`)
over HTTP. Verified end-to-end: clicked "Request Disclosure" live for Ana
Isabel Betz, captured the real Record ID
(`fb50e7c82f55a56ed4f7676479964885a539010618aff8e0195dcc3dcb1a81a7`) via
Playwright reading the result form's actual field values (not the
truncated on-screen text), fetched its bundle+salt via the new endpoint,
and issued a Lab-Result-scoped token against it — confirmed on-chain
(`status: SucceedEntirely`, `blockHeight: 9430`).

---

## Notes
- Synthetic demo data only — see Critical Constraint above. Non-negotiable.
- The Tryton module step (Python, XML views, ORM) is genuinely new territory
  for this project — budget real learning time for it, and expect it to need
  more iterative back-and-forth than the Compact circuit work, which now has
  a proven playbook from the prior project.
- If Prompt 1 reveals GNU Health is too unstable to deploy reliably in a
  reasonable timeframe, that's real information, not a failure — the honest
  fallback is documenting that clearly (same discipline as the Preprod
  writeup) and considering a different "known and used" app rather than
  forcing this one.
