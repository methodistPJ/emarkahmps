# MPS e-Assessment v1.0.2 — Release Candidate 1

Calon keluaran untuk semakan dan ujian Google staging. **Belum disahkan production-ready dan belum dideploy.** Sumber aplikasi datang daripada ZIP v1.0.2 semasa, bukan binaan semula v1.0.

- `src/`: 18 fail Apps Script termasuk dua modul baharu; schema dan format akaun kekal.
- `client/`: pecahan Workspace.html untuk penyelenggaraan; bukan fail Apps Script berasingan.
- `tools/build.py`: membina semula `src/Workspace.html` secara setempat.
- `tests/`: fixture sintetik, ujian, ukuran sebelum/selepas dan tangkapan skrin tanpa rekod murid sebenar.
- Lapan laporan/panduan di direktori ini menerangkan dapatan, bukti dan batas pengesahan.

Keperluan ujian: Node.js moden (20+), Python 3 untuk build, Playwright + Chrome untuk ujian pelayar pilihan. Aplikasi sendiri tidak menambah dependency luaran. PdfLib.js dikekalkan tepat daripada baseline.

```sh
python3 tools/build.py
npm test
```

Ujian pelayar (gunakan Playwright yang tersedia pada mesin anda):

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_PATH=/absolute/path/to/chrome node tests/browser.test.mjs
```

Lihat DEPLOYMENT_GUIDE.md sebelum membuat sebarang perubahan Google. Jangan jalankan installer pada database sedia ada. `.clasp.json.example` dan `SCRIPT_PROPERTIES.example.json` ialah templat; tiada rahsia sebenar dibekalkan.
