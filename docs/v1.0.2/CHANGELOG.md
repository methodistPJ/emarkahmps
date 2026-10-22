# 1.0.2-rc.1 — 18 October 2026

## Keselamatan dan integriti

- `runInstallation` awam ditukar kepada `runInstallation_` persendirian; doGet/rpc sahaja entry point awam.
- RPC/table allowlist menggunakan own-property lookup; koordinat `_row` dibuang daripada payload aturan gred.
- Format teks enam digit USERS dikekalkan dalam transaksi dan dipanjangkan kepada salinan tahun baharu. Ujian 025849 meliputi PBKDF2 sebenar dan log masuk.
- Pengesahan tamat sesi menolak expiry rosak. Format HMAC/PBKDF2, pepper dan akaun sedia ada tidak diubah.
- Peperiksaan yang disediakan tidak boleh diturunkan semula ke DRAFT. Readiness mengesahkan setiap pasangan murid-subjek, termasuk pendua dan rekod di luar kohort.
- Pemulihan WAL memeriksa bilangan/bahagian jurnal, identiti operasi dan bentuk rancangan sebelum menulis. Urutan flush dan journal tidak dibuang.

## Prestasi

- Cache metadata/config hanya dalam execution; markah kelas hanya dalam request. Tiada cache kebenaran/markah merentas pengguna.
- Sheet handles, header validation dan append cursor digunakan semula. Grid dibesarkan sebelum kelompok besar.
- Replay mencari request melalui TextFinder dan optional cache row hint yang disahkan semula; sejarah _OPS tidak dipadam.
- Dashboard menghantar exam fields yang diperlukan; login menggunakan satu dashboard fetch. Analitik menggunakan sessionContext; pemantauan pentadbir dimuatkan bila dipilih.
- Pemindahan blob PDF dilakukan di luar global lock dengan semakan sesi/revision sekali lagi sebelum respons.

## Autosave dan pengalaman pengguna

- Timeout 45s dan amaran lambat 12s; retry menggunakan ID sama apabila keputusan belum diketahui, late callback diabaikan.
- Draf menyimpan pending, in-flight dan nilai mentah tidak sah; storage gagal/rosak menghasilkan amaran dan laluan eksport/pemulihan. Draf lama tidak dibuang senyap.
- Navigation menunggu flush. Logout tidak memadam draf tugasan lain yang belum diselaraskan. Finalization mengesan draf subjek lain dalam tab sama.
- Konteks markah/dashboard hanya ditukar selepas fetch berjaya. Loader berbilang skop menunggu render dan fade 300ms; autosave kekal tidak menghalang input.
- Processing state, active navigation/tabs, fokus heading, named selectors, carian senarai dan susun atur markah telefon ditambah tanpa mengganti identiti visual.
- Ulasan mempunyai retry, export, discard dengan pengesahan dan conflict guard.

## PDF dan operasi

- Fingerprint snapshot/revision mengikat checkpoint dan fail baharu; reuse memerlukan provenance yang sepadan. Snapshot rosak menghasilkan FAILED, bukan kitaran lease tanpa penjelasan.
- Readiness memaparkan bilangan snapshot diproses daripada checkpoint, bukan peratus rekaan.
- Health endpoint admin-only, worker heartbeat dan diagnostics opt-in tanpa payload/credentials.
- Timezone Malaysia dan fallback tahun 2026; Script Properties sedia ada sentiasa diutamakan.
- Helper legacy_import.py read-only yang dirujuk UI disertakan semula sebagai alat pilihan daripada kerja analisis terdahulu; tiada sumber aplikasi lama menggantikan baseline.

## Keserasian

Tiada perubahan header/jadual, tiada migrasi, tiada pemasangan, perubahan secrets, akaun, deployment atau data production. Tambahan fingerprint berada dalam medan JSON yang sudah wujud; legacy snapshot tanpa fingerprint masih diterima dengan semakan bilangan murid. Lihat KNOWN_LIMITATIONS.md sebelum kelulusan operasi.
