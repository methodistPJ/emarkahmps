# MPS e-Assessment v1.0.3 — paparan tugasan dipermudah

**Pentadbir: mula dengan [Apa Perlu Buat](APA_PERLU_BUAT.md).** Isi semua nama dalam satu templat dan import secara pukal. Guru terus melihat tugasan sendiri; halaman pentadbir menunjukkan progress dan pintasan analisis.

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


### Paparan peranan — 26 Oktober 2026

- Login kod guru + PIN tanpa alias; identiti akaun dan PIN sedia ada dikekalkan.
- Dashboard admin padat, analitik terus peperiksaan semasa, kemajuan guru mengasingkan pengisian daripada penghantaran. TB lalai tidak menaikkan peratus pengisian.
- Kad gred A–F, kad kelas boleh dibuka, graf setempat interaktif dan penapis tersembunyi. CSV hanya untuk admin.
- Guru kelas hanya boleh meminda markah, menulis ulasan dan mengesahkan selepas semua subjek kelas dihantar. Semakan server diwajibkan. Pindaan diaudit dan resit penghantaran asal dikekalkan.
- Nama dan masa pengesah kelihatan kepada guru subjek. Pengesahan semula rekod yang sama tidak menaikkan revisi PDF. Kelas dimuktamadkan masih memerlukan admin membuka semula sebelum pindaan.
- Dialog menyimpan/mengesahkan mengunci interaksi; autosimpan kekal dengan indikator ringan. Markah melebihi 100 dihadkan kepada 100 pada input/tampalan; semakan server dikekalkan.
- Pramuat hanya konteks, dashboard dan analitik semasa dalam memori sesi (20 saat, maksimum lapan entri). Markah/semakan kelas dimuat apabila dibuka. Refresh latar 45 saat ketika tab aktif dan tiada input/draf/dialog; tidak bertindih atau menimpa input.
- Tiada reset markah, murid, guru, tarikh peperiksaan atau PIN melalui kemas kini paparan ini.


### Email/PIN and administrator PDF update — 27 October 2026

The existing USERS table supports the legacy layout with email in K and the upgraded layout with email replacing the unused alias column in D. All account IDs, credentials, assignments and marks are preserved. Administrators review **Akaun Emel & PIN**, then explicitly apply the migration; that operator action sets the two selected administrator PIN verifiers, enables first-login six-digit PIN enrollment, removes the physical alias column, and invalidates affected sessions. Existing activated users authenticate with their existing credential once before setting a six-digit PIN. Pending accounts use the configured temporary credential BBB8307. Email remains directly editable plain text; authentication_data remains a hash/verifier. Never edit authentication_data manually.

Administrators with teaching assignments enter their personal subject/class dashboard first and switch to **Pentadbiran Sekolah** when needed. The welcome greeting uses the account's name. Logout is red. Class finalization freezes results with AWAITING_ADMIN; only an administrator can queue or download a PDF. Existing snapshot revision and hash validation remain in place.

Stable authorized reads use optimistic generation checks and do not hold the shared write lock. Responses overlapping a writer or recovery are discarded and retried under the existing lock. Journalled writes remain serialized. Active-view background refresh first checks a lightweight authenticated revision and only fetches changed data; manual refresh invalidates that marker. Input/draft/focus guards remain enabled. These are tested protocol changes, not a claim of live multi-user latency figures.
