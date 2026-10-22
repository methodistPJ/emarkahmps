# Controlled upgrade and rollback — operator runbook

Nothing in this guide has been executed against Google. Do not run install_, runInstallation_, templateInstall_ or newYear_ as part of this upgrade. No migration is needed: all fourteen table headers are unchanged. Existing Script Properties, AUTH_PEPPER, accounts and IDs must remain intact.

## 1. Preserve and review

- Keep the authoritative ZIP (SHA-256 in RELEASE.json), this package and an independent current `clasp clone`/pull backup. Record current script ID, web deployment ID, immutable version, access settings and trigger owner/count in a private operations record.
- Copy the complete active spreadsheet and required Drive/template outputs under restricted school access; securely preserve Script Properties through the school's private process. Archived redacted credentials are not a full operational backup.
- Compare any changes made in Google after the supplied ZIP. Reconcile them before pushing; do not overwrite newer fixes. Check SHA256SUMS after extracting this package.
- Arrange a quiet window, finish pending teacher saves, allow workers to finish, and confirm no recovery pointer remains. Do not clone production triggers/secrets into a publicly accessible staging project.

## 2. Validate locally and in isolated staging

```sh
python3 tools/build.py
npm test
```

Optional browser tests use Playwright/Chrome as described in README. Before/after data lives in tests/artifacts; it is synthetic. `.clasp.json.example` contains only a placeholder; create a private `.clasp.json` with the intended **staging** scriptId and rootDir `src`. Never add .clasprc.json to the package/repository.

Use an isolated Apps Script project, synthetic or approved anonymized Sheets/Drive copies and separate staging secret/accounts. Set properties deliberately to staging resources. This package does not automate staging installation because installer side effects must never target production. The existing baseline installer remains private for a genuinely new isolated project; review its inputs and editor execution explicitly if using it.

Run the Google smoke checklist below before approving the existing project upgrade. Retain the current scopes and deploy-as-owner audience unless separately approved. The health check is configuration evidence, not proof of Drive access or PDF correctness.

## 3. Controlled existing-project push

Only after review/staging approval, map a private `.clasp.json` to the verified existing script ID with `rootDir: "src"`. Use the approved clasp version on the operator's machine. Check `clasp --help`/subcommand help because syntax differs by major version. Do not use force push or automated deployment.

```sh
clasp status
clasp deployments
clasp versions
clasp push
clasp version "MPS 1.0.2-rc.1 reviewed upgrade"
```

Inspect `clasp status` first: only the 18 src files (including manifest/Workspace/vendor) should be selected. Tests/client/tools/docs are not Apps Script files. The push updates project HEAD; it may also change code executed by time triggers before a versioned web deployment is updated, so use the quiet window and check running executions. Preserve the actual existing source backup before this step.

Record the newly returned immutable version number. Prefer Apps Script **Deploy → Manage deployments → Edit existing web app → select new version**, preserving the deployment URL, execute-as and audience. The official clasp guide also describes `clasp redeploy <deploymentId> <version> <description>`; use only when the installed CLI's help confirms that syntax. Do not accidentally create a new deployment URL. No command in this document is authorization for an agent to deploy automatically.

## 4. Google smoke checklist and acceptance

- Verify account creation/login with a synthetic025849 account and alias, incorrect PIN/cooldown, expiry and deactivation. Existing accounts must still authenticate. Never reset production users for testing.
- Verify role boundaries through direct RPC as well as hidden UI: teacher cannot access unrelated classes/admin/official PDFs; runInstallation is unavailable publicly.
- Prepare both Tahap1 (12 subjects) and Tahap2 (14), all five default TB subjects, zero/100/TH/EMPTY and two-role teacher. Compare actual marks/grades and analytics denominators with a hand-checked fixture. Test deadline, late submission, reopen and duplicate finalize.
- Test A–J recovery scenarios from TEST_REPORT on separate browsers/devices, including a lost response after actual commit and 5/10/20 authorized clients. Check Sheets versions, one audit/receipt effect and no overwrites. Use staging fault injection only, never interrupt live writes deliberately.
- Verify RECOVERY_ROW replay and no partial reads in staging; malformed journal must fail closed. Never delete pending WAL rows to unblock a classroom.
- Confirm precisely one processQueue_ trigger under the intended owner; authorize required services. Health heartbeat must advance, and QUEUED/PROCESSING/FAILED/retry/COMPLETED must behave correctly. Inspect trigger failures independently of heartbeat.
- Generate actual Google Docs PDFs: exactly one A4 page per student, 12/14 subjects, optional subjects, long140-character names/300-character remarks, zero/F,TH,TB omission, correct headmistress/class/year. Inspect every page for clipping/blank/duplicate/glyphs; print B&W. Verify checksum/download authorization/revision invalidation and retry output reuse.
- Check Chrome desktop and Safari on actual iPad/iPhone, keyboard/focus/screen reader/reduced motion, all CRUD/import/audit controls, mobile overflow and failure recovery.
- On copies only, verify archive manifest and new-year IDs/025849 preservation. Validate backup restore before production archiving.
- Enable DIAGNOSTICS_ENABLED=`true` temporarily if needed; logs contain route/timings/cell counts/size/result code, not payloads. Collect at least30 representative observations per action for median/P95/max, Sheets operations, lock wait, errors/retries and actual PDF completion time. Some non-core direct service calls are not instrumented. Disable when sufficient; do not log browser token/proof/PIN or mark payloads.

After the actual existing deployment is updated, conduct minimal approved smoke checks and monitor executions/queue/audit. Do not claim production readiness until the school accepts data, PDFs, device behaviour and real performance.

## 5. Rollback

Stop new writes and allow or inspect pending WAL recovery first; capture the current workbook/source/execution state. Re-select the previous immutable web version in Manage deployments. Restore matching project HEAD from the verified pre-upgrade source backup with a deliberate reviewed `clasp push`, since time triggers execute project code independently of the web deployment version. Do not restore/reset data merely because code is rolled back. No schema migration is involved; added JSON fingerprint fields are ignored by baseline readers.

The baseline public runInstallation wrapper is a known security finding. Restrict workspace access/operation during rollback and retain its private-function correction or produce a reviewed rollback patch before reopening; reverting blindly reintroduces that risk. If source/data reconciliation or journal recovery is unclear, remain stopped and use copies/backups for investigation. Do not delete audit/WAL or rotate pepper as a rollback shortcut.

References: [official clasp guide](https://developers.google.com/apps-script/guides/clasp), [Apps Script service quotas](https://developers.google.com/apps-script/guides/services/quotas). CLI behaviour and quota are verified by operator before changes.
