## Task-first home verification — 22 October 2026

Core runner passed:22 backend,10 reliability, PDF,5/10/20 synthetic clients,20 school/onboarding (including admin-only database link) and2000-student recovery scenario. Both Chromium browser suites passed with admin-home and teacher-home assertions. The general browser suite had one intermittent conflict-control timeout; it passed after adding failure diagnostics and again with the new home assertions. Real authenticated Google integration remains untested. Live deployment version4 public login page verified. See tests/artifacts/admin-home.png, teacher-home.png and task-home-core-results.txt; these are synthetic fixtures.

# QA report — v1.0.3-rc.1,21 October2026

All tests use fictional school data and isolated Google-service doubles. No production Google integration, actual Microsoft Excel editing, Safari device or school PIN was used. The application source is the current workspace v1.0.2 RC plus targeted additions; that baseline remains separately preserved.

## Executed evidence

| Suite | Expected coverage | Actual |
|---|---|---|
| tools/verify.cjs | Server/client/inline syntax, doGet/rpc-only public surface, exact14-table schema, unchanged PDF vendor, shared workbook/parser/backend contract and identical embedded/standalone template bytes | PASS |
| v1.0.2 backend.test.cjs | Grading0–100/TH/TB/EMPTY,12/14-subject preparation, RBAC, versions, atomic batches, multi-role teacher, submission/TB acknowledgement, remarks/finalization/snapshots, analytics, reopen, receipt actor/payload binding, WAL interruptions/corruption, auth/aliases/cooldown/expiry/revocation, archive/rollover |22/22 PASS; extended leading-zero student ID check through actual mocked archive/year-copy paths |
| v1.0.2 reliability.test.cjs |10 pending changes, disconnect, committed response lost, edits while saving, navigation guard, session expiry, stale independent clients, runtime-loss restoration, watchdog/late response and corrupt drafts |10/10 PASS |
| pdf.test.cjs | Actual bundled parser on synthetic PDF objects: A4/page count, wrong paper/count/corruption; Docs doubles: zero/F,TH,TB omission, bounds and EMPTY rejection | PASS; not Google Docs export |
| concurrency.test.cjs |5/10/20 authorized synthetic actors, disjoint writes, same-ID retries, shared-record conflicts, grid expansion | PASS all3 sizes; one shared-record winner and4/9/19 conflicts, mocked lock execution |
| school.test.cjs | Import/onboarding tests listed below |19/19 PASS |
| school-scale.test.cjs |2000 text-ID students,60 classes,20 teachers,780 subject assignments; interrupted whole-import PREPARED journal, no core writes before recovery, repeated recovery and same-ID replay | PASS; full20-teacher600000-iteration PBKDF2 computation included |
| workbook.test.py | Real shipped XLSX structure/types/headers/validation/protection, text025849 and IDs, editable inputs, no PIN/hash/token/code columns or formulas; XML validity and unchanged read-only hash | PASS via bundled openpyxl reader |
| browser.test.mjs | Full prior UI regression: login, marks, keyboard/search, save/disconnect/retry/conflict, submit, remarks/finalize, analytics, every admin entity tab, grades/legacy import/audit/health and responsive views | PASS, with existing legacy-import click routed through preserved CSV/history button |
| school-browser.test.mjs | Real shipped XLSX parsed in Chrome; exact normalized-document equality to independent read-only XLSX extraction; malformed workbook cases; full wizard; response dropped after actual mocked commit; same-ID retry; private code issuance/hide; first-login/PIN confirmation/session gating; desktop1440×1000, iPad820×1180 and phone390×844; no page errors | PASS, actual candidate rpc/backend via synthetic service bridge |
| Workbook visual review | Render all10 sheets, inspect opening regions/content/style/headers | Completed; native Excel application verification still required |

Saved outputs are in tests/artifacts, including all-core-results.txt, browser-results-v103.txt, school-browser-results.json, workbook-results.txt and school-scale-results.json. Screenshots contain synthetic names/identifiers and were captured only after private code display was cleared.

## 19 school/onboarding cases

1. Valid complete preview is read-only for core school rows.
2. Missing sheets/headers, numeric six-digit identity, duplicate student IDs and invalid references rejected.
3. Preview ownership, expiry, confirmation and changed-database safeguards.
4. One commit creates classes, students/enrolments, pending teachers, assignments and two DRAFT exams.
5. Exact re-import skips stable records and preserves authentication.
6. Safe name correction updates matching record; omitted workbook row is retained.
7. Existing enrolment transfer/history and class-teacher replacement conflicts rejected.
8. Pending user cannot receive normal login session or use a forged stale normal session record.
9. Admin-only issuance, one-time response/replay and no plaintext activation code anywhere in mocked Sheets/WAL.
10. Invalid and expired activation codes rejected/audited.
11. Code+temporary proof yields restricted hashed capability, not normal session.
12. Expired restricted ticket cannot set permanent PIN.
13. Declared permanent PIN length policy and generation binding; code reissue revokes tickets.
14. Successful permanent activation consumes capability, bumps auth version, invalidates temporary proof, rejects duplicate activation and enables ordinary login; later import preserves the permanent digest.
15. Canonical optional-subject TB, complete readiness, explicit preparation and rejection of a late cohort addition.
16. Repeated invalid activation reaches cooldown with no workspace session.
17. Leading-zero request/actor journal receipt matches correctly.
18. Active archive freeze blocks onboarding writes; private rollback suspension disables pending users and preserves activated credentials.

19. Native Sheets Date/UTC representation changes do not cause duplicate enrolments or false history/exam updates.

## Browser parser rejection cases

Actual ZIP/XLSX variants tested: missing required worksheet, formula input, external relationship and XML DOCTYPE. All rejected. Additional malformed headers/types/duplicate IDs/cross-sheet references are covered by backend fixtures. ZIP64/encryption/path-traversal/declared/actual byte caps/CRC/date1904/duplicate XML references and shared-string bounds were code-reviewed, not exhaustively fuzzed. An independent fixture comparison caught and fixed ISO-typed Excel dates (t=d); ordinary numeric serial conversion is also implemented but not separately exercised through native Excel saving.

## Limits and acceptance

These tests establish local behaviour, not live quotas/latency/permissions/lock fairness or cloud durability. The large-import elapsed value is a single local observation, not median/P95 or an Apps Script SLA. Actual Google HTMLService iframe, private code distribution, account onboarding, Microsoft Excel round-trip editing, iPad/iPhone Safari, accessibility, two-client Google races, trigger jobs and real combined PDFs must pass DEPLOYMENT_GUIDE before rollout. Rollback safety must be rehearsed in staging. A derived proof cannot cryptographically attest malicious-client PIN length; this preserved-protocol boundary is documented in SECURITY_REVIEW.


## 24 October 2026: participation and performance

Core suites pass, including nine new participation/index/cache tests and an autosave queue of 125 changes drained as 60/60/5. A local browser using the actual bundled UI and backend service doubles verified synthetic teacher login, one eligible PI pupil, autosave of 87/A (version 2), preservation of the other pupil's TB (version 1), successful submit/locking, and extended-template import preview. A new subject read fetched 2 fixture rows rather than the class's complete 28-mark block. This is structural and synthetic evidence, not a measured live latency guarantee. No school marks were entered during testing.

School setup changes were verified separately by export/readback. Real import still requires valid teacher identification codes. Existing prepared exams retain legacy participation until explicitly reviewed; this release does not rewrite their marks or cohorts.
