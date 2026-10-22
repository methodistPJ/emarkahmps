# MPS e-Assessment v1.0.3 Release Candidate 1

One-upload school setup and secure teacher onboarding, implemented as a selective upgrade of this workspace's latest v1.0.2 Release Candidate. Pakej kod untuk repositori methodistPJ/emarkahmps. GitHub menyimpan kod dan menjalankan ujian; Web App dihoskan oleh Google Apps Script. Rujuk GITHUB_DEPLOYMENT.md untuk status pemasangan semasa.

## Included

- `src/`: complete20-file Apps Script project, same manifest/scopes and all14 table headers.
- `client/`: maintainable modules, local vendored JSZip3.10.1, parser/wizard/onboarding and embedded template. `tools/build.py` bundles Workspace.html.
- `assets/MPS-eAssessment-School-Setup-2026.xlsx`: actual10-sheet Excel template with fictional examples, dropdowns, protected headers/reference and text identifiers. It contains no private activation codes, PIN columns or authentication material. BBB8307 appears only as the requested common temporary-PIN instruction.
- `tests/`: original regressions plus new school/onboarding, large import and browser tests; synthetic fixtures and evidence only.
- Required import/mapping/onboarding/security/QA/deployment/rollback guides at the package root. Previous v1.0.2 reports are historical evidence in `docs/v1.0.2`.

```sh
python3 tools/build.py
npm test
```

Core tests require Node20+ and no downloaded packages. Optional browser tests require Playwright/Chrome; see TEST_REPORT. Recreating the Excel template requires the bundled artifact-tool/JSZip authoring runtime and is not a deployment prerequisite. The shipped XLSX and embedded download bytes are identical.

Read BULK_IMPORT_GUIDE before using the template. Replace all fictional DEMO rows; do not upload example records to the real school. Import creates/reconciles setup records, not marks. Exams stay DRAFT on initial import; readiness plus an explicit administrator prepare/open action is required. Existing PINs are preserved. New teachers require private individual activation codes and a new permanent PIN before any workspace session.

This is a locally tested release candidate, not a claim of new live Google integration or production certification. Complete the staging acceptance checklist before the operator updates the existing versioned deployment.
