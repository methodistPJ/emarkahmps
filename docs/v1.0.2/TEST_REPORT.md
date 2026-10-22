# QA evidence and outstanding validation

Date:18 October2026. Candidate1.0.2-rc.1. All automated fixtures are synthetic; no live Google deployment, school PIN or student record used. See tests/artifacts for saved outputs and Chromium screenshots. “PASS” below means local/simulated unless explicitly described otherwise.

## Executed

| Suite | Expected | Actual |
|---|---|---|
| tools/verify.cjs | All server/client inline JS compiles; only doGet/rpc public; manifest valid; baseline schema exact; PdfLib checksum unchanged | PASS |
| backend.test.cjs | Grade0–100 boundaries, invalid/TH/TB/EMPTY; Tahap12/14 preparation; RBAC/version/batch atomicity; multi-role teacher; submissions/TB acknowledgement; audited amendments; remarks/finalization snapshots; official analytics; reopen/PDF invalidation; request actor/payload binding; WAL recovery; auth/collision/cooldown/revocation/expiry; archive/rollover |22/22 PASS |
| Leading-zero regression within backend suite | Create025849 as text; derive real PBKDF2-SHA256 proof600000 iterations; authenticate alias; reject wrong proof/deactivated account; preserve025849 during new-year copy | PASS |
| WAL corruption and admin boundaries | Corrupt PREPARED pieces fail closed until restored; unauthorized health rejected; prepared exam cannot demote; grade payload cannot target existing rows | PASS |
| Four flush-boundary interruptions | Before PREPARED, no data applied; after PREPARED, recover exactly once; repeat recovery creates no duplicate state rows | PASS |
| reliability.test.cjs | Pending/in-flight/invalid persistence; recovery scenarios below; watchdog and late response; corrupt draft protected |10/10 PASS |
| concurrency.test.cjs |5/10/20 actors; disjoint writes; same-ID receipt retries; shared-record version race |3 sizes PASS; one winner,4/9/19 CONFLICTs |
| pdf.test.cjs | Actual bundled PDF parser on synthetic compressed objects: A4, page count, wrong paper/count/corruption. DocumentApp doubles: zero/F,TH,TB omission, name/remark bounds and EMPTY rejection | PASS; no real Docs export |
| browser.test.mjs | Login → marks → keyboard/search/grade/autosave → interrupted save/retry ID → conflict discard → submit lock → remarks → finalize → analytics → admin tab/forms → health/audit/import error → responsive views; no uncaught page error | PASS in isolated headless Chrome |
| Legacy helper | Synthetic CSV0/TH/blank and unchanged source SHA; no real school Excel reread | PASS |
| Layouts |1440×1000 desktop,820×1180 iPad size,390×844 phone size; no document-width overflow in marks; synthetic screenshots reviewed | PASS in Chromium; actual Safari/device/screen-reader tests outstanding |
| performance.cjs |40 ordinary/30 burst observations; request/transfer/payload changes;10k/50k transaction histories | Completed; maxima outliers retained in report |

## Autosave scenarios A–J

| Scenario | Exercised recovery / outcome |
|---|---|
| A: ten marks, refresh before debounce | Serialize and reconstruct all ten pending entries; browser ordinary mark rendering/save separately tested. No claim of durable browser crash recovery. |
| B: disconnect during save | Promise rejection retains in-flight ID/payload in sessionStorage; retry uses same ID. Browser network-failure mock also exercised. |
| C: commit then response lost | Simulated remote receipt commits once, client TIMEOUT retains ID, retry returns receipt without second version increment. Real Google packet loss not injected. |
| D: continue typing during save | Deferred first response; second edit remains pending and receives returned version, subsequent save preserves newest value. |
| E: navigate with pending edits | Guard waits for mark/remark flush; failed save rejects transition. Actual browser navigation exercised after saves. |
| F: session expires | SESSION failure retains payload for same-user reauthentication; backend expiry/deactivation tests reject stale session. Real expiry during Google RPC remains staging test. |
| G: same subject in two tabs | Independent fixture clients share server versions; stale edit rejected. SessionStorage remains tab-local; no draft merging. |
| H: two users edit same row | Real backend mocked-service concurrency suite accepts one version and rejects others; no silent overwrite. |
| I: tab closes in flight | Reconstruct runtime from retained storage and reuse ID; actual tab closure can destroy sessionStorage and is **not guaranteed recoverable**. Keep tab until confirmed or export. |
| J: timeout then retry | Actual client watchdog triggered with fake clock; same mutation ID reused; late callback ignored; committed receipt replay tested. |

## Coverage boundaries

Browser traversed all seven admin entity tabs/new-record forms, grades, import empty-file error, audit, health and monitoring, plus main navigation. It did not submit every combination of CRUD/import/destructive archive/new-year form. Backend tests verify core archive/new-year rules using service doubles; actual permissions/conversion and interactive approvals remain staging acceptance. Native validity, escaped output, role boundaries and private installer were code-reviewed; no full penetration test or WCAG certification is claimed.

Exam late-join/transfer/leave behaviour was code-reviewed: preparation freezes cohort and later enrolments do not silently change it. A full scenario matrix across real dated Google exams, duplicate roster/name cases, incorrect assignments, closing dates/late submissions, simultaneous finalizations and every reopen path must be run in staging. School policy for post-preparation cohort changes is intentionally not invented.

PDF layout tests verify intended content calls and parser contracts, not real font metrics, clipping, missing glyphs or one-page output from Google Docs. Actual school PDF acceptance with long names/remarks and black-and-white printing remains mandatory. Snapshot mismatch/checkpoint/reuse guards were code-reviewed; Drive crash/lease races not end-to-end injected.

No cloud test was marked passed. Release remains a candidate pending the Google smoke checklist and known-limitations gates.
