> Installation record, 22 October 2026: existing web deployment updated to version 3. See GITHUB_DEPLOYMENT.md for verified scope and limitations. The checklist below was prepared before installation and does not assert completed staging acceptance.

# Controlled v1.0.3 upgrade

No production action was executed. Existing Apps Script project, database and deployment URL must remain. No installer, templateInstall_, database reset, secret rotation or new production deployment is required.

1. Back up current project HEAD, immutable web version/deployment ID, all Script Properties securely, the complete active spreadsheet and required Drive files. Obtain a fresh private clasp clone into a separate backup folder and compare any changes made since the workspace v1.0.2 RC. Do not overwrite newer live fixes.
2. Review SECURITY_REVIEW, MIGRATION_GUIDE and the critical pending-account rollback rule. Establish a quiet window; finish writes/recovery and archive/PDF jobs before changing HEAD, since time triggers use project code independently of versioned web deployment.
3. Extract package, verify SHA256SUMS, run `python3 tools/build.py` and `npm test`. Node20+ is enough for core tests; Playwright/Chrome optional integration commands are in TEST_REPORT. Keep the shipped XLSX unchanged unless regenerating and rebuilding the embedded download with the authoring runtime.
4. Validate first in an isolated Apps Script staging project with synthetic workbook/data and separate staging properties/resources/secret. Do not point any staging installer at production. Exact table headers stay unchanged; metadata is written lazily by normal confirmed operations, not a migration installer.
5. Create private .clasp.json from .clasp.json.example with the verified existing scriptId and rootDir src. Never package .clasprc.json. Inspect `clasp status`: only20 src files should be uploaded; client/tools/tests/assets/docs stay local. Workspace already embeds JSZip/parser/template, so no separate template hosting or new OAuth scopes are needed.
6. Operator-only commands, after approval/staging acceptance:

```sh
clasp status
clasp deployments
clasp versions
clasp push
clasp version "MPS 1.0.3-rc.1 reviewed school setup"
```

Use the installed clasp version's help. Do not force-push or create a new URL. In Apps Script Deploy → Manage deployments, edit the existing web deployment to the reviewed immutable version, preserving execute-as/audience. Record previous and new HEAD/version. No automatic push or redeploy was performed here.

## Staging acceptance before production use

- Existing administrator/teacher credentials, aliases, sessions, mark autosave/recovery, review/finalization/analytics/PDF and archive must still work. Confirm six-digit025849 and leading-zero student IDs physically remain text in Sheets and after year copy.
- Download template from the actual hosted wizard, inspect in Microsoft Excel (Windows/Mac) and verify dropdowns, editable data/protected headers/reference, dates, preserved zeros and all required fields. Replace DEMO data only in the approved test copy. Actual Excel application editing was not exercised locally.
- Upload complete workbook, confirm no school rows change before commit; inspect row/field validation, exact counts, actor/expiry/content/database-bound preview. Test re-import, safe correction, missing-row retention, invalid refs/duplicates, protected histories/prepared exams and interrupted/response-lost saves in staging. Verify no mark/history/PIN overwrite. Test school-sized dataset on real Apps Script and record timings/errors/quota.
- Confirm profile names update only after commit; Script ID, Spreadsheet ID, pepper, infrastructure and active year must not change from workbook.
- Verify new teacher pending cannot use any direct RPC module/session. Issue private code, test wrong/expired/reissued code/ticket/cooldown, then mandatory PIN confirmation and first login. Inspect only digest/metadata in Sheets and absence of codes/tokens/PINs in WAL/audit/logs. Never use actual private credentials in screenshots.
- Verify issuer is admin-only, standard accounts retain PIN and ordinary PIN validation10–64. Keep explicit identity verification before private code distribution. Validate reissue recovery after lost issuance response.
- Readiness must show missing classes/rosters/assignments correctly. Test resolving one missing item through existing forms and refreshing without re-importing everything. Imports must not open exams automatically; explicit preparation must block incomplete setup and preserve the original cohort/default-TB/grade rules.
- Verify normal/activation/import UI in Chrome and actual iPad/iPhone Safari, keyboard/focus/reduced motion, large tables, failed request and loader recovery. Ensure served iframe/WebCrypto/local JSZip works under HTML Service sandbox.
- Keep precisely one existing processQueue_ trigger, verify permissions/health/heartbeat and actual Google Docs combined one-A4-page-per-student PDF. No trigger changes are part of this release.
- Test rollback on a staging copy with both pending and activated teachers before real onboarding. Do not test destructive faults against live school data.

After operator deployment, perform minimal approved smoke checks, monitor errors/audit/queue and retain backups. New feature tests are local/synthetic, not proof of live production readiness.

CLI reference: [Google clasp guide](https://developers.google.com/apps-script/guides/clasp). Current quota details: [Google Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas). Verify installed CLI syntax and current account quotas before executing commands.
