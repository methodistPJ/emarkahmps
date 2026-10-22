# Mulakan di sini

Guru tidak perlu mendaftar murid, guru atau kelas satu demi satu dalam Web App.

## Pentadbir — isi semua data dalam satu fail

1. Log masuk Web App sebagai pentadbir. Pada halaman utama, pilih **Muat Turun Templat Nama Murid & Guru**.
2. Gantikan baris DEMO dalam fail Excel; kekalkan nama tab dan header baris 4. Data bermula pada baris 5.
3. Isi **02_CLASSES** (kelas), **03_STUDENTS** (murid dan kelas), **04_TEACHERS** (guru), **05_CLASS_TEACHERS** (guru kelas) dan **06_SUBJECT_ASSIGNMENTS** (guru-subjek-kelas). Semak profil sekolah di 01_SCHOOL dan tarikh UPSA/UASA di 08_EXAMS. Kekalkan rujukan subjek pada 07_SUBJECTS.
4. Gunakan class_id dan teacher_ref yang sama merentas tab. Simpan kod pengenalan enam digit serta student_id sebagai teks supaya sifar di depan kekal.
5. Pada Web App, pilih **Isi / Import Data Sekolah** → pilih satu fail .xlsx → semak ralat dan pratonton → sahkan import. Sistem menyediakan murid, guru dan tugasan secara pukal. Tiada pendaftaran satu demi satu diperlukan.
6. Semak kelengkapan, pengaktifan guru dan tarikh peperiksaan. Pilih **Sediakan & Buka Selepas Semakan** untuk peperiksaan yang telah bersedia.

Jika mahu mengisi melalui Google Sheets, buka templat ini dalam Google Sheets dan eksport melalui File → Download → Microsoft Excel (.xlsx), kemudian import fail tersebut. Menyunting templat sahaja **belum** menyegerakkan Web App. Jangan sunting markah atau authentication_data terus dalam pangkalan data operasi.

## Guru

Buka Web App dan log masuk menggunakan akaun yang telah disediakan. Guru baharu hanya perlu mengaktifkan akaun sedia ada menggunakan kod peribadi pentadbir dan menetapkan PIN sendiri; ini bukan pendaftaran murid/guru. Akaun lama terus menggunakan PIN sedia ada.

Halaman **Tugasan Saya** menunjukkan kelas dan subjek sendiri. Pilih **Isi Markah**, atau **Semak Kelas & Ulasan** jika bertugas sebagai guru kelas.

## Pentadbir — progress dan analisis

Halaman utama menunjukkan peratus sel lengkap, baki EMPTY dan kelas-peperiksaan yang dimuktamadkan. Peratus merangkumi SCORED, TH dan TB termasuk TB lalai; ia bukan peratus penghantaran atau pengesahan rasmi.

**Progress Terperinci** memaparkan pemantauan mengikut kelas, status semakan dan PDF. **Lihat Analisis** membuka analisis semasa atau rasmi mengikut peperiksaan, kelas, subjek dan tahap.

Pautan **Buka Pangkalan Data (Pentadbir)** hanya muncul selepas log masuk pentadbir. Ia memerlukan kebenaran Google Drive sedia ada dan tidak memberi akses kepada guru secara automatik. Fail persediaan dan pangkalan data operasi adalah dua fail berlainan.
