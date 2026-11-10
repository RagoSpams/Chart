# Runtime dependency advisory audit

Date: 2026-11-10. Scope: the locked dependency graph and Chart's actual runtime usage. No advisory is suppressed.

## What the 12 findings mean

The full `npm audit` and `npm audit --omit=dev` both report **12 moderate affected-package entries, all caused by one distinct advisory**, [GHSA-chp3-j5qr-2vfr / CVE-2026-115779](https://github.com/advisories/GHSA-chp3-j5qr-2vfr). These are **runtime dependencies**, not development-only findings. The advisory applies to `@effect/platform` before 0.97.1: untrusted cookie names, domains or paths can inject extra Set-Cookie attributes. The unrelated Effect 4 beta range in the same advisory does not apply to Chart's Effect 3.22.1.

## Affected packages

| Package | Installed version(s) | Classification / reason npm flags it |
| --- | --- | --- |
| `@effect/platform` | 0.95.0, 0.96.3 | Vulnerable cookie implementation; two installed copies |
| `@midnight-ntwrk/compact-js` | 2.5.1 | Transitive runtime dependency; inherits vulnerable platform code |
| `@midnight-ntwrk/midnight-js-contracts` | 4.1.1 | Direct runtime dependency; inherits vulnerable platform code transitively |
| `@midnight-ntwrk/midnight-js-http-client-proof-provider` | 4.1.1 | Direct runtime dependency; inherits vulnerable platform code transitively |
| `@midnight-ntwrk/midnight-js-indexer-public-data-provider` | 4.1.1 | Direct runtime dependency; inherits vulnerable platform code transitively |
| `@midnight-ntwrk/midnight-js-level-private-state-provider` | 4.1.1 | Direct runtime dependency; inherits vulnerable platform code transitively |
| `@midnight-ntwrk/midnight-js-node-zk-config-provider` | 4.1.1 | Direct runtime dependency; inherits vulnerable platform code transitively |
| `@midnight-ntwrk/midnight-js-protocol` | 4.1.1 | Direct runtime dependency; inherits vulnerable platform code transitively |
| `@midnight-ntwrk/midnight-js-types` | 4.1.1 | Direct runtime dependency; inherits vulnerable platform code transitively |
| `@midnight-ntwrk/midnight-js-utils` | 4.1.1 | Direct runtime dependency; inherits vulnerable platform code transitively |
| `@midnight-ntwrk/platform-js` | 2.2.4 | Transitive runtime dependency; inherits vulnerable platform code |
| `@midnight-ntwrk/wallet-sdk-prover-client` | 1.2.3 | Transitive runtime dependency; inherits vulnerable platform code |

Dependency paths:

- bridge/verifier → midnight-js-protocol 4.1.1 → compact-js 2.5.1 → @effect/platform 0.95.0.
- bridge/verifier → midnight-js-protocol 4.1.1 → platform-js 2.2.4 → @effect/platform 0.95.0.
- bridge/verifier → wallet-sdk 1.2.0 → wallet-sdk-prover-client 1.2.3 → @effect/platform 0.96.3.
- Other flagged Midnight packages depend on the protocol/types/utils packages above; they do not contain twelve independent cookie vulnerabilities.

## Reachability in Chart

**Assessment: no exploitable path was found in Chart's current usage. This is a reachability assessment, not a claim that the installed dependency is patched.**

Chart's inbound HTTP endpoints are Express; authentication uses an Authorization bearer header. There is no cookie-based login/session feature, no Set-Cookie construction and no imports or calls to Cookies.makeCookie, unsafeMakeCookie, serializeCookie or HTTP-server cookie setters in Chart or the three immediate Midnight consumers of @effect/platform.

The installed compact-js/platform-js modules import the platform Error facilities. The wallet prover client imports FetchHttpClient, HttpBody, HttpClient and HttpClientRequest to POST binary proof/check requests to the configured local proof server. It does not construct response cookies or feed request data into cookie name/domain/path fields. Chart's proof server is a trusted local service that already receives proving material; this is not an untrusted cookie-issuing web server.

An exploit would require additional code or a changed deployment that takes attacker-controlled input into the affected cookie-writing functions. If cookie/session handling is added to the Effect runtime, reassess this conclusion immediately. Loopback bindings are an additional deployment constraint, not the basis for concluding the cookie-writing path is absent.

## Fix decision

The upstream patched version is 0.97.1 (0.97.2 and 0.97.3 also exist). Installed consumers declare `^0.95.0` or `^0.96.0`; npm registry inspection found no patched 0.95.x or 0.96.x release. In 0.x semver, forcing 0.97.1 crosses those declared compatibility ranges. Matching its Effect peer range alone would not prove SDK API compatibility.

Therefore **no non-breaking upstream dependency fix is currently available for these twelve entries**. No forced override, ad-hoc node_modules edit, postinstall patch, vulnerability exclusion or SDK/ledger major upgrade was applied. Existing safe patch updates remain locked. The remaining finding is documented with its runtime scope and unreachable current sink. A coordinated upstream backport or a separately tested SDK/ledger migration is the appropriate removal path.

This finding does not prevent publishing accurately labelled experimental source code. It prevents advertising a clean dependency audit or a production-secure deployment. Release reviewers should explicitly accept the documented residual dependency risk before publication.

## Reproduction

```sh
npm ci --ignore-scripts
npm audit --json
npm audit --omit=dev --json
npm ls @effect/platform effect --all
```

Inspect the installed source in `@midnight-ntwrk/compact-js/dist/esm`, `@midnight-ntwrk/platform-js/dist/esm` and `@midnight-ntwrk/wallet-sdk-prover-client/dist/effect/HttpProverClient.js`, along with Chart's bridge/verifier HTTP routes. The audit JSON is retained locally under ignored `.validation/`; its absence from a clone does not affect the commands above.
