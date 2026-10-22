# v1.0.3 architecture and targeted audit

Authoritative baseline: this workspace's latest v1.0.2 RC, preserved at work/upgrade-v103/baseline. No earlier application source replaced it. Historical detailed audit is in docs/v1.0.2.

| File/module | Targeted change and invariant |
|---|---|
| SchoolSetup.js (new) | Shared workbook contract; validation/cross-sheet plan; actor/content/database-bound preview; stable reconciliation and WAL commit; derived school profile and readiness; original prepareExam_ gate. No schema/installer. |
| Onboarding.js (new) | Private admin issuance, hashed expiring codes/tickets, cooldown, mandatory-PIN capability, version revocation and editor-only rollback suspension. No ordinary session for pending teacher. |
| Auth.js | Pending login/session gates; original salt/PBKDF2/HMAC and existing credentials retained. |
| Code.js | Explicit private-route bindings, original session/admin/RBAC checks and transaction/replay flow. Public activation routes are restricted capabilities, not module access. |
| Database.js | Committed profile reconciliation in locked request; text ID/code formats before writes and journal identity columns. Existing WAL/flush/recovery/lock consistency retained. |
| Archive.js | Text-format all identifier/code columns before archive and next-year copies. A coercing-service regression exposed that leading-zero student IDs could otherwise break archive hash verification; new assertions verify archive/rollover preservation. |
| Workspace/client | Local JSZip/parser,6-stage import, private issuance/readiness, separate first-login; safe rendering; post-import master cache refresh and expired/logout private-code scrubbing. CSV/history import and evaluation modules preserved. |
| Workbook/tools | Exact common contract, real branded XLSX, native reference/header protection, readable editable inputs;20 src deployment files, no extra scopes/infrastructure. |

High-severity risk addressed: shared temporary PIN without a private individual factor would permit takeover. It is never sufficient; per-user code plus restricted capability is mandatory. Rollback remains high risk if pending accounts are not first suspended, because old auth ignores new metadata. This requirement is explicit and locally tested.

Other safeguards: import cannot overwrite permanent PINs, delete missing rows, reassign a stable teacher_ref to another identity, silently transfer enrolment history or mutate prepared cohort/config. Current subject co-teaching is preserved. Code/raw ticket responses never enter the journal/audit. Workbook parsing rejects unsafe containers/active content and server validates again.

Residual limits: derived-proof length cannot be server-attested for a malicious client; native Excel/Safari/Google/permission/concurrency/quota/PDF acceptance outstanding; embedded assets increase initial HTML; preview/ticket history grows. See SECURITY_REVIEW, TEST_REPORT and KNOWN_LIMITATIONS rather than treating local PASS as cloud verification.

Identifier/date consistency checks also cover native Sheets Date/UTC equivalence, archive text formats and leading-zero journal request/actor IDs. These are storage/comparison safeguards, not a change to examination dates or grade policy.
