## 2026-10-25 — Stable import preview and RPC retries

- Canonicalize object keys when hashing import workbooks and mutation payloads; preserve array order. Google Apps Script RPC transport can reorder map keys between requests, which previously invalidated otherwise identical previews.
- Keep actor, content, expiry and database-snapshot checks. Continue accepting legacy journal fingerprints only when the original raw payload matches.
- Add a visible revalidation control for the currently selected file, without reselecting it after a validation error or expiry.
- All core suites and five canonicalization regressions pass, including reordered preview/commit, changed-content rejection, actor/expiry protection, reordered mutation retries and legacy receipt compatibility.

## 2026-10-25 — Short teacher-name login codes

- Allow canonical uppercase 2–30 character teacher codes (AHMAD, CHONGFL, etc.) while preserving six-digit legacy accounts, salts and existing PINs.
- Normalize case before challenge, authentication and activation; share rate limits across spelling cases. Update login, activation and admin labels/input limits.
- School import accepts name codes, with stable teacher_ref assignment linking. Unique name codes do not require an alias. Individual activation, PIN policy and session authorization remain unchanged.
- Four dedicated authentication/import regressions plus all core suites pass. Synthetic browser login succeeds using lowercase name code with no alias. No production school accounts were imported or reset.

## 2026-10-24 — Student subject participation and faster entry

- Add optional paired religion_subject (PI/PM) and elective_subject (BA/BC/BT) columns to student setup, with strict active-pupil validation. Legacy six-column imports remain supported.
- Store choices by academic year and class in existing _STATE metadata; freeze the cohort separately for each prepared exam. Reimports cannot silently change prepared participation.
- Selected optional subjects start EMPTY. Other optional subjects remain TB in class review, results and PDFs, and are excluded from teacher entry and submission. Server validation blocks writes to non-participants.
- Read contiguous per-subject mark blocks for newly prepared exams, falling back safely for existing exams. Cache immutable grade versions and frozen subject snapshots for up to ten minutes; keep marks, access, sessions and exam status fresh.
- Drain autosave queues in batches of at most 60 while retaining pending edits and the original retry receipts. Zero-participant optional subjects are satisfied during preparation rather than blocking class completion.
- Core regression suites and ten participation/index/cache cases passed with service doubles. Actual browser UI verified synthetic login, filtered entry, saved grade, submission locking and extended-template import preview. School setup Sheet updated separately; production school data was not imported.

## 2026-10-22 — Task-first workspace

- Replace the long landing page with a concise login and school workflow.
- Teachers see class/subject cards and direct marks/review actions; administrators see completeness counts, class progress, analysis and bulk import shortcuts.
- Expose the existing database URL through an administrator-only read action, without exposing Script Properties or secrets.
- Add APA_PERLU_BUAT.md: one-workbook bulk setup, including the explicit Sheets-to-XLSX import step. No automatic synchronization, registration bypass or changes to account security.
- Core regression suites and both Chromium browser suites passed with synthetic data. No real names or account credentials were imported.

# v1.0.3-rc.1 — 21 October 2026

Baseline: latest v1.0.2 Release Candidate in this workspace; preserved separately. Selective extension, not a rebuild.

- Real branded10-sheet Excel template, fictional school data,14 canonical subjects, text IDs/025849, dates, dropdowns and native header/reference protection; identical bytes downloadable from wizard and standalone file.
- Vendored local JSZip3.10.1 and bounded CRC-checked OOXML parser; mandatory fields/sheets, serial and ISO Excel dates, types, duplicate cell/row references, formula/error/external/macro/encryption/ZIP64/size rejection. No external parsing service.
- Admin six-stage import wizard with row/field errors, counts, confirmation, honest progress, safe retries, completion/readiness and preserved CSV/history entry point.
- Admin-only preview/details/commit with ownership/content/expiry/database binding; compact journal receipts support large previews. Deterministic user/ref/student/enrolment/assignment/exam matching, same-workbook re-import and no implicit deletion.
- Existing teacher PINs retained; temporary proof derived locally with existing PBKDF2/HMAC mechanism only for new accounts. Profile fields committed within WAL; only safe display properties synchronized after commit.
- Pending-account module/session enforcement; private per-user activation code issuance/reissue, digest-only persistence, expiry/cooldown/audit, restricted tickets, mandatory permanent PIN UI and session/version revocation.
- Readiness for current classes/rosters, teachers/pending activation, class/subject assignments, subjects and exams. Explicit prepare/open calls original prepareExam_ only after structural readiness. Existing subject co-teaching preserved; one active class teacher still required.
- Generic identifier/code text formatting before transactional writes/year copy, extending the six-digit fix to leading-zero student identifiers.
- Post-import admin master-data/metrics refresh and cleared stale error banner after confirmed retry. No blocking full-page overlay during regular autosave; navigation guard protects an active import.
- Private editor-only pending-account suspension safeguard for controlled rollback; no automatic migration, trigger installation, secret rotation or deployment.
- All v1.0.2 backend/reliability/PDF/concurrency/browser regressions rerun; new workbook, onboarding, actual-browser/synthetic-backend and2000-pupil interrupted-import suites included.

No production data was changed by this engagement. Live Google/Excel/Safari/permissions/PDF/quota acceptance is still required.

Identifier/date consistency checks also cover native Sheets Date/UTC equivalence, archive text formats and leading-zero journal request/actor IDs. These are storage/comparison safeguards, not a change to examination dates or grade policy.
