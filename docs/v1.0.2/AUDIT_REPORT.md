# Architecture & Risk Assessment — v1.0.2 baseline

Audit date: 18 October 2026. Authoritative input: MPS-eAssessment-v1.0.2-current.zip, SHA-256 `b47bdc62394345f587973a44bbae3f8ed9436faa206b5c7ce22932a00d8278b5`. All 16 members were inventoried and inspected. Baseline is preserved separately and never edited. This assessment was recorded before major modifications; implementation outcomes and validation are appended after testing.

## Architecture recap and file inventory

| File | Responsibility, dependencies and failure boundary |
|---|---|
| Config.js | Exact 12 core + 2 operational schemas; seeds; Script Properties; hashes/HMAC, validation, roles. year fallback is 2027 despite engagement's 2026 initial year. Existing property takes precedence. |
| Code.js | doGet and rpc dispatcher. All requests, including reads, enter locked_. Sessions and per-action permissions protect operational endpoints. Routing uses inherited object lookup; needs own-property allowlisting. |
| Database.js | Request-local read cache, staged fixed-row plans, class/exam mark block index, PREPARED write-ahead journal and replay. Leading-zero USERS formatting fix is present and must survive. All RPC reads are serialized to avoid partially applied transactions. |
| Auth.js | Deterministic identifier/alias salt; PBKDF2 browser proof protected by server HMAC; cooldown; absolute session expiry/revocation; multi-role onboarding. Proof is a reusable credential, not a one-time nonce challenge. Preserve existing account format. |
| Domain.js | Exam/class lookups, assignments, permissions, integer grading, writable-state guards, counts/averages and percentage denominators. |
| Admin.js | Admin CRUD, grade versions, exam configuration/preparation and public aggregates. Preparation has expensive append loops. Grade-rule payload can carry _row; strip internal coordinates. Prepared exam can currently be demoted to DRAFT and later have its grading configuration replaced. |
| Marks.js | Task dashboard; scoped mark retrieval; versioned batch saves; audited class amendments and subject submissions. Dashboard rereads a full class block for each assigned subject. |
| ClassReview.js | Remarks, readiness hash, immutable per-student snapshots + one CLASS finalization, reopen. Readiness checks EMPTY but does not prove complete rectangular student×subject coverage. |
| Analytics.js | Authorized current/official queries, A–F counts and matched student/subject comparison. Always returns detailed dataset even when only summary is needed. |
| PDFGenerator.js | Controlled combined Docs layout; four students/checkpoint; leases; A4/page-count parser; revisioned access/download. Hash currently checks bytes but does not bind existing output to snapshot fingerprint. Long download conversion occurs under global lock. |
| PdfLib.js | Bundled PDF-LIB parser. Full vendor source read and checksum inspected; no network loading. Retain unchanged; not part of application refactoring. |
| Archive.js | Verified core-table archive, credential redaction, retries and new workbook/year activation. USERS copying in newYear bypasses the plain-text formatting fix used in writePlan_. External file effects precede journal commit. |
| Import.js | Roster batch import and reviewed historical import to separate workbook. External workbook creation can leave orphans/repeated outputs after interruption before commit. Original values are retained. |
| Setup.js | Private initialization plus public runInstallation wrapper. The wrapper has no actor check and is remotely callable via HTML Service. Must not run initializer on production during upgrade. |
| Workspace.html | Full editorial UI, eight inline script modules, storage, autosave/remarks, admin, analytics, loader and nav patches. No external credential embedded. Some performance/UX patch integration is incomplete. |
| appsscript.json | V8; existing scopes; deploy-as-owner; ANYONE_ANONYMOUS audience; Asia/Singapore timezone. No deployment changes are executed. |

## Findings supported by source

| ID | Severity/type | Evidence and root cause | User impact / planned action |
|---|---|---|---|
| S01 | Critical / security | Setup.js public `runInstallation()` invokes install_ without session/owner checks. Public HTML-service functions can be called directly. | Unauthenticated installer invocation can authorize owner-side file/trigger effects. Make wrapper private; normal accounts and login format unchanged. |
| F01 | High / correctness | Workspace enter() reads `prefetched`; it is neither a parameter nor declared in its lexical scope. openDashboard(prefetched) still ignores its argument. | Supplied export's login/session-restoration path raises ReferenceError. This is a finding about ZIP, not a claim that the deployed version was tested failing. Fix scoping and remove redundant dashboard call. |
| F02 | High / integrity | Workspace sets M.context before marksGet/reviewGet succeeds. An unsuccessful screen transition leaves previous rendered inputs with a new save target. | Old inputs can be saved against wrong context or fail inconsistently. Publish new context only after successful retrieval; serialize navigations and flush before transition. |
| F03 | High / reliability | JSON.parse/sessionStorage writes unguarded; empty drafts retained; class-review recovered mark drafts not clearly displayed; invalid input is omitted from stored draft. | Corrupt/quota/disabled storage or refresh can prevent recovery, while invalid values can disappear or be replaced by an earlier pending valid value. Introduce fail-visible scoped draft storage and guarded save state. |
| F04 | High / workflow | Admin.examSave_ permits OPEN/CLOSED/FINALIZED → DRAFT; subsequent DRAFT edit bypasses immutable grading/version guard. readiness_ only counts marks present. | Prepared-exam rules may become inconsistent, or missing records could pass finalization after data corruption. Enforce existing lifecycle intent, coverage and snapshot validation. |
| F05 | High / security/integrity | gradesSave_ copies arbitrary rule properties including `_row` into Db.put; router uses prototype-inherited action lookups. | Internal row targeting is accepted from payload; unknown RPC actions not strictly rejected. Strip coordinates; explicit allowlist. |
| F06 | High / regression | Leading-zero fix exists in writePlan_ and install_, but Archive.newYear_ copies USERS with raw setValues. | Next-year rollover can regress six-digit identifiers on coercing Sheets paths. Apply the same text format/string invariant to every account copy. |
| P01 | High / measured opportunity | replay_ reads all _OPS rows×7 columns per mutation; journal grows permanently. | Save latency and payload work grow with history. Use validated request-row hint plus bounded reverse scans on cache miss; retain complete fallback and recovery metadata. |
| P02 | Medium / measured opportunity | dashboard_ invokes db.marks once per assignment; db.marks fetches entire class block even for a single subject. Db.put does getLastRow/reduce per appended record. | Redundant service calls and quadratic preparation. Memoize blocks within request; validated subject range hints; append cursors. No shared mark/permission cache. |
| P03 | Medium / consistency trade-off | locked_ serializes all reads and writes, including PDF blob conversion; this protects against partially applied transactions. | Contention is real but removing read locks is unsafe without a stronger isolation design. Retain lock for data snapshots, move PDF file I/O outside it, measure wait/hold. |
| U01 | Medium / UX | Loader hide uses a clearable timeout whose Promise may remain unresolved; late hide can hide a later operation. Buttons in inner modules are not uniformly covered. | Overlapping operations can stick/hide loader incorrectly; repeated actions lack feedback. Reference-counted completion scopes and per-button processing; autosave stays non-blocking. |
| U02 | Medium / UX/performance | adminData + full dashboard + jobs fetched on every admin entry; analytics calls dashboard just to populate exam selector; raw foreign IDs used in forms. | Repeated mark reads and avoidable navigation cost. Lazy admin monitoring, lightweight session context and named selections. |
| O01 | Medium / operations | File creation in archive/import precedes core journal commit; PDF output reuse validates count/size but no snapshot identity. | Orphan files or insufficient reuse provenance after crash. Record deterministic fingerprint/lease/checkpoint metadata; document unavoidable external-service boundary. |
| L01 | Low / configuration | year fallback 2027 and Singapore timezone while school context is 2026/Malaysia. | Correct fallback/manifest without overwriting existing Script Properties or examination rules. |

## Implementation sequence and invariants

1. Reproduce findings with baseline fixtures and preserve archive hashes.
2. Targeted backend fixes and instrumentation; preserve schema, authentication digest, actual account IDs, scores, audit and WAL ordering/flushes.
3. Bound data reads safely; no shared cache of marks, permissions or exam states; keep read consistency under lock.
4. Harden draft/autosave and loader/navigation, then refine existing UI rather than replace it.
5. Validate finalization/PDF provenance, source-compatible archive/import and health diagnostics.
6. Run regression/failure-injection, browser/device-size and simulated performance/concurrency tests; package clasp source with controlled upgrade/rollback guide.

No live production operation, credential request, install_, clasp push or deployment is authorized/executed in this engagement. Local tests and code review do not establish Google production performance or actual Docs pagination.


## Implemented outcomes and residual risks — RC1

All sixteen authoritative files were reviewed before modifications. Vendor PdfLib remains byte-identical; server/client syntax and exact schema equality were checked. Two additive server files (Views.js, Diagnostics.js) do not introduce new tables. Baseline is retained in work/upgrade-v102/baseline and the original ZIP is unchanged.

F01–F06 integrity/security findings were addressed through targeted source edits: private installer, corrected prefetched dashboard integration, protected pending/in-flight/raw-invalid drafts, complete coverage validation, own-property routing/grade coordinates, prepared-state guards and text-formatted year copy. The undefined prefetched finding describes the supplied ZIP code; no claim is made that the user's deployed login currently fails, and no live deployment was inspected.

P01 uses server TextFinder on request ID, not the originally considered reverse-scan implementation. Optional cache contains only a validated row hint, never response/private data. P02 uses request-local full-class memoization plus append cursors, not a persistent subject index. P03 retains consistent locked reads and moves blob I/O outside with revision/session recheck. Measurements and unresolved full reads are documented in PERFORMANCE_REPORT.

U01/U02 are integrated into the existing baseline UI: completion-scoped loaders, processing state, safe view context, one login dashboard, lazy monitoring, small selectors, named foreign selections, drafts/recovery, tablet/phone mark layout and keyboard/focus states. Browser exercises do not certify every form or accessibility criterion.

O01 PDF output gains immutable snapshot fingerprint/provenance and actual checkpoint counts. Archive/import external-service atomicity remains a documented limitation; orphan creation and manual reconciliation cannot be solved by the Sheets WAL alone. No claim of exactly-once Drive side effects is made. L01 changes only fallback year/timezone, not existing properties or examination policy.

Leading-zero regression covers real600000-iteration PBKDF2 proof construction for025849, login, alias/deactivation and new-year copying with a coercing Sheets double. Every WAL flush barrier was failure-injected; PREPARED replay remains mandatory before request snapshots, including fail-closed piece/plan validation.

No credentials were requested or copied. doGet/rpc are the only public helpers; existing scopes/audience and authentication verifier format are preserved. Diagnostics exclude payloads/auth material. Local tab storage is not encrypted or durable; reusable PBKDF2 proof and service quotas are residual architecture constraints, explicitly documented.

The package is a reviewed and locally tested release candidate, not a verified production deployment. TEST_REPORT and KNOWN_LIMITATIONS separate simulated success, code review and live Google work still required. No install, trigger creation, clasp push, secret rotation or production data operation was executed.
