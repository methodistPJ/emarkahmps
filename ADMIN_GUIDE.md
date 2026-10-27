# Pentadbiran v1.0.3

Mulakan persediaan melalui [BULK_IMPORT_GUIDE](BULK_IMPORT_GUIDE.md) dan [TEACHER_ONBOARDING_GUIDE](TEACHER_ONBOARDING_GUIDE.md). Setelah profil diimport, _STATE school-profile ialah authority bagi nama sekolah/Guru Besar; jangan cuba menukar dua nama tersebut hanya melalui Script Properties. Infrastruktur/secret kekal diurus secara persendirian seperti dahulu.

Jangan jalankan installer. Guru pending perlu kod individu, dan akaun pending mesti disuspend sebelum rollback ke v1.0.2.

## Operasi penilaian sedia ada

## UPSA dan UASA

1. Daftar kelas tahun aktif, murid, enrolmen dan tugasan guru. ID murid mesti konsisten; nama bukan identiti. Tamatkan enrolmen lama sebelum perpindahan. Semak peranan guru sepadan dengan tugasan.
2. Semak subjek ditawarkan mengikut Tahun1–6 dan aturan gred versi penuh0–100. PI/PM/BA/BC/BT default TB dikekalkan. Cipta versi gred baharu untuk exam baharu; jangan ubah exam yang telah disediakan.
3. Cipta UPSA/UASA DRAFT dengan tahun, tarikh dan replacement-v1. Sediakan selepas cohort/tugasan disemak. Preparation membekukan nama/kelas/subjek/cohort; perubahan enrolmen kemudian tidak menambah murid pada exam lama.
4. OPEN membolehkan pengisian dalam tempoh yang sah. Guru subjek menyemak TB dan menghantar. Guru kelas menyemak markah/ulasan; readiness menunjukkan EMPTY, penghantaran belum siap, ulasan kosong dan jurang liputan.
5. Selepas finalization, pantau PDF melalui Pemantauan & Arkib. Status QUEUED/PROCESSING/FAILED/COMPLETED datang daripada backend. Guru kelas boleh melihat bilangan snapshot diproses melalui semakan semula. Muat turun hanya revision rasmi terkini.
6. Pembetulan memerlukan Buka Semula dengan sebab yang jelas. Semak implikasi pada penghantaran/finalization/PDF, buat pembetulan, sahkan semula dan jana PDF revision baharu. Jangan guna PDF lama selepas reopen.

## Import

CSV roster: header `full_name,student_id,class_id,start_date`. Gunakan ID sedia ada secara nyata; ID kosong mencipta murid baharu. Semak bilangan dan pratonton sebelum sahkan. Fail besar diproses dalam kelompok100; jika satu kelompok gagal, kelompok terdahulu mungkin telah selesai. Semak audit/rekod sebelum retry.

Import sejarah berasingan: `python3 tools/legacy_import.py source.xlsx --year 2025 --output reviewed.json` memerlukan openpyxl. Helper hanya sesuai struktur asal kelas1H–6H/1J–6J dengan pasangan markah/gred; ia tidak mengubah Excel. Semak issues/discrepancies dan identiti pendua secara manual. Blank tidak ditukar kepada0; keputusan EMPTY/TB/TH perlu disemak. UI meminta keputusan setiap blank sebelum workbook sejarah dicipta. Jangan gunakan import sejarah untuk menulis peperiksaan aktif. Helper diwarisi daripada analisis terdahulu, dan fail Excel sebenar tidak dianalisis semula dalam upgrade ini.

## Operasi dan pemulihan

Kesihatan Sistem menyemak header, konfigurasi dan bilangan trigger processQueue_. Heartbeat menunjukkan execution worker terakhir selesai; ia bukan bukti setiap job berjaya. Trigger perlu tepat satu dan dimiliki akaun operasi. Jika FAILED, baca sebab di queue, semak izin/template, kemudian Cuba PDF. Jangan memasang trigger baharu jika sudah ada.

Jika RECOVERY_ROW kekal atau header rosak, hentikan penulisan pengguna dan buat salinan backup. Request seterusnya cuba recovery sebelum data dipulangkan; jurnal rosak mesti gagal tertutup. Jangan padam pointer/_OPS, sort rows atau ubah header untuk melepasi ralat. Bandingkan journal/backup dengan ICT; simpan bukti tanpa PIN/proof/token. Fail orphan Drive boleh disemak manual selepas core state dikenal pasti.

Buat backup workbook penuh dan sumber sebelum setiap exam, perubahan utama dan arkib; backup harian pada hari pengisian aktif boleh dilakukan oleh penyelaras tanpa menambah trigger automatik pakej ini. Backup penuh mengandungi credential hashes: hadkan akses. Uji pemulihan pada salinan, bukan live.

Arkib hanya selepas kedua-dua exam lengkap mengikut backend, PDF disahkan dan tiada draf guru tertinggal. Pantau hingga COMPLETED dan semak manifest hash. Tahun baharu mengekalkan student/user IDs serta kod guru, tetapi tidak mempromosikan kelas, enrolmen atau tugasan secara automatik. Import senarai sebenar dan semak dahulu. Jangan jadikan arkib yang meredaksi credentials sebagai satu-satunya backup operasi.


## Kemas kini 27 Oktober 2026: emel dan PIN

1. Log masuk menggunakan emel dalam USERS dan kelayakan sedia ada.
2. Buka Pentadbiran Sekolah → Urus Sekolah → Akaun Emel & PIN.
3. Semak pelan akaun, kemudian pentadbir sendiri menekan Terapkan Migrasi & Tetapkan PIN Pentadbir. Operasi ini menetapkan PIN Muhaimin dan Aliyah kepada 000000 tanpa perubahan wajib, mengaktifkan polisi PIN enam digit untuk guru lain, dan menggantikan kolum alias dengan emel. Markah tidak direset.
4. Log masuk semula menggunakan emel dan PIN. Akaun guru yang belum diaktifkan menggunakan BBB8307 sekali, kemudian menetapkan PIN enam digit. Guru yang sudah aktif menggunakan kelayakan lama sekali sebelum menetapkan PIN enam digit.

Selepas migrasi, ubah emel terus dalam kolum email pada tab USERS di spreadsheet operasi; emel disimpan sebagai teks dan PIN sebagai hash dalam authentication_data. Jangan ubah user_id atau hash secara manual. Menu ini juga menyediakan reset PIN sementara untuk akaun terpilih.

Guru kelas mengesahkan kelas selepas semua subjek dihantar. Hanya pentadbir menjana dan memuat turun PDF. Admin yang mengajar melihat Tugasan Saya dahulu dan boleh beralih kepada Pentadbiran Sekolah. Bacaan stabil tidak menunggu kunci tulis global; semakan perubahan ringan mendahului muat semula latar.
