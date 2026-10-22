# Pemasangan repositori sekolah

Repositori ini menyimpan kod MPS e-Assessment v1.0.3-rc.1. GitHub Actions menjalankan binaan dan ujian teras sahaja; push ke GitHub tidak mengubah Google Sheets atau melakukan deployment automatik.

Web App kekal di Google Apps Script dengan deployment sedia ada. Tetapan manifest semasa termasuk Asia/Singapore (UTC+8), execute-as dan audience dikekalkan daripada projek asal.

Fail .clasp.json tempatan diabaikan Git. Token Google, Script Properties dan sandaran kod asal disimpan di luar repositori. Tiada data murid sebenar atau sandaran pangkalan data diterbitkan di sini. Fail Excel mengandungi contoh rekaan DEMO; pengisian/import ke Sheets ialah langkah pentadbir yang berasingan. Jangan gantikan murid sedia ada secara automatik dengan dummy.

## Pengesahan

python3 tools/build.py diikuti npm test. Semakan CI menggunakan data sintetik dan bukan ujian integrasi Google sebenar. Sila baca DEPLOYMENT_GUIDE.md dan ROLLBACK_GUIDE.md sebelum deployment seterusnya. Jangan jalankan installer pada pangkalan data sedia ada.

## Status

Kod asal telah ditarik sebagai sandaran tempatan. Deployment asal ialah versi 2. Status deployment baharu akan direkodkan selepas operasi berjaya.
