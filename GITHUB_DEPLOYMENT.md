# Pemasangan repositori sekolah

Repositori ini menyimpan kod MPS e-Assessment v1.0.3-rc.1. GitHub Actions menjalankan binaan dan ujian teras sahaja; push ke GitHub tidak mengubah Google Sheets atau melakukan deployment automatik.

Web App kekal di Google Apps Script dengan deployment sedia ada. Tetapan manifest semasa termasuk Asia/Singapore (UTC+8), execute-as dan audience dikekalkan daripada projek asal.

Fail .clasp.json tempatan diabaikan Git. Token Google, Script Properties dan sandaran kod asal disimpan di luar repositori. Tiada data murid sebenar atau sandaran pangkalan data diterbitkan di sini. Fail Excel mengandungi contoh rekaan DEMO; pengisian/import ke Sheets ialah langkah pentadbir yang berasingan. Jangan gantikan murid sedia ada secara automatik dengan dummy.

## Pengesahan

python3 tools/build.py diikuti npm test. Semakan CI menggunakan data sintetik dan bukan ujian integrasi Google sebenar. Sila baca DEPLOYMENT_GUIDE.md dan ROLLBACK_GUIDE.md sebelum deployment seterusnya. Jangan jalankan installer pada pangkalan data sedia ada.

## Status

Pada 22 Oktober 2026, deployment Web App sedia ada berjaya dikemas kini daripada versi 2 kepada versi 3 (v1.0.3-rc.1). URL dikekalkan. Kesemua 20 fail dimuat naik tanpa installer, import, reset pangkalan data atau perubahan Script Properties.

Halaman Web App langsung dan borang pengaktifan guru berjaya dibuka selepas deployment. Log masuk pentadbir, simpan markah, import, PDF dan worker belum diuji secara langsung; ujian tersebut dalam TEST_REPORT ialah ujian tempatan/sintetik. Tiada ujian staging Google penuh dilakukan semasa pemasangan ini. Pelayar semasa tidak mempunyai akses editor kepada URL /dev; akses clasp kepada projek dan deployment berjaya.

Sandaran tempatan meliputi kod HEAD asal dan rekod deployment versi 2. Ia bukan sandaran data Sheets atau Script Properties. Nama dummy tersedia dalam templat Excel, belum diimport ke Sheets. Sebelum penggunaan data sebenar, jalankan semakan pentadbir dan aliran operasi yang diperlukan.

## Paparan dipermudah — versi 4

Deployment yang sama dikemas kini kepada versi 4 pada 22 Oktober 2026. Halaman awam baharu disahkan pada URL langsung. Paparan guru dan pentadbir, import dan kawalan akses pautan pangkalan data diuji dengan data rekaan, bukan akaun guru sebenar. Semua nama masih perlu diisi melalui templat dan diimport. Tiada Sheet baharu diwujudkan atau data sebenar diimport semasa kemas kini paparan. Lihat APA_PERLU_BUAT.md.


## Gateway GitHub Pages — 26 Oktober 2026

Pintu masuk: https://methodistpj.github.io/emarkahmps/

GitHub Pages menerbitkan folder `/docs` daripada cabang `main`. `docs/index.html` menghala terus ke URL Apps Script sedia ada, dengan pautan **Masuk Sistem** sebagai sandaran dan meta refresh jika JavaScript tidak tersedia. Tiada borang login, data sekolah, token atau PIN disimpan pada gateway. Parameter URL tidak dihantar ke Apps Script. Akaun, pengisian, markah dan pangkalan data kekal pada Web App asal.
