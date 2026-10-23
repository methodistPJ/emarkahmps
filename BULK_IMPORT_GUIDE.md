# Panduan Import Sekolah Sekali Upload

## Sediakan workbook

1. Dalam Pentadbiran → Import, tekan Muat Turun Template Excel. Fail yang sama juga dibekalkan bersama pakej.
2. Baca00_START_HERE. Semua baris DEMO, nama Contoh, kod pengenalan dan tarikh ialah data rekaan. Ganti semua contoh sebelum import sekolah sebenar. Jangan tinggalkan baris contoh pada worksheet lain apabila mengganti kelas/murid.
3.01_SCHOOL: satu rekod sahaja; tahun mesti tahun database aktif. Ganti nama Guru Besar contoh. Pilih versi gred yang sudah berdaftar dan replacement-v1. Workbook tidak menukar tahun aktif, infrastruktur, secrets atau Script/Spreadsheet IDs.
4.02_CLASSES: gunakan class_id teks yang stabil, nama kelas, tahun1–6 dan TRUE/FALSE. Jangan tukar ID selepas digunakan.
5.03_STUDENTS: student_id teks stabil, nama, class_id, tarikh mula, status murid/enrolmen. Satu baris mencipta/memadankan murid dan enrolmen. Nama bukan identiti. ID seperti000001 mesti disimpan sebagai teks, bukan hanya dipaparkan dengan format enam digit. Jangan pad semula nilai yang sudah hilang sifar tanpa menyemak identiti asal.
6.04_TEACHERS: teacher_ref stabil, nama, enam digit teks, alias jika perlu, active dan role. Alias boleh kosong. Kod+alias menentukan padanan akaun sedia ada; teacher_ref menghubungkan worksheet tugasan. Tiada kolum PIN. Akaun baharu menerima verifier BBB8307 dan ditandakan pending activation; akaun sedia ada tidak ditukar PINnya.
7.05/06: rujuk class_id/teacher_ref yang betul. Satu guru boleh mengajar banyak kelas/subjek. Seorang guru kelas aktif bagi setiap kelas. Co-teaching subjek yang sudah disokong backend dikekalkan: sekurang-kurangnya satu guru subjek diperlukan; rekod tuple yang sama tidak boleh berulang. Menambah guru subjek tidak membuang guru lama.
8.07_SUBJECTS: kekalkan semua14 kod, coverage dan lima default TB backend. Nama/susunan boleh dikemas kini; semua subjek mesti aktif.08_EXAMS: UPSA/UASA tahun aktif, tarikh yang disemak, versi sedia ada dan niat DRAFT/PREPARE/OPEN. Niat bukan arahan membuka secara automatik.

Header tepat pada baris4, data bermula baris5. Semua kolum wajib kecuali nilai account_alias boleh kosong. Header/rujukan dilindungi untuk mengelakkan suntingan tidak sengaja; data dibuka untuk suntingan sehingga baris2004. Perlindungan tanpa kata laluan bukan kawalan keselamatan. Jika perlu Unprotect Sheet untuk menambah ruang, jangan ubah header atau menambah kolum yang tidak disokong. Had workbook tetap terpakai.

Gunakan tarikh Excel biasa atau ISO. Tarikh serial/ISO-typed Excel dinormalisasi kepada tarikh/tempatan Malaysia; datetime ISO eksplisit Z/+08:00 dihormati. Tarikh tutup pada tengah malam tidak secara automatik bermaksud akhir hari: semak masa tarikh exam sebelum membuka, gunakan datetime dengan masa yang diperlukan. Contoh UPSA yang sudah lepas perlu diganti. Excel date1904, macro, encryption, formula dalam data input, ralat sel, external link/hyperlink dan embedded object ditolak. Import membaca semua baris, termasuk baris ditapis/disembunyikan; filter bukan arahan mengecualikan data.

## Enam peringkat wizard

Muat turun → Upload Excel → Validasi → Pratonton → Sahkan → Selesai.

Pilih/seret satu .xlsx. Parser berjalan dalam browser; tiada perkhidmatan parser luar. Data ternormal hanya dihantar ke RPC sekolah. Ralat dipaparkan mengikut worksheet, baris dan medan; `*` bermaksud semakan seluruh rekod/hubungan, dengan medan berkaitan diterangkan dalam mesej. Validasi tidak menulis rekod sekolah. Backend menyimpan receipt pratonton/audit sahaja; butiran penuh dibaca melalui endpoint berizin agar tidak melebihi had sel journal.

Semak jumlah Cipta/Kemas Kini/Kekal/Konflik dan100 perubahan pertama. Pratonton luput15 minit, terikat kepada pentadbir, kandungan workbook dan fingerprint database setup. Tanda pengesahan selepas mengganti/menyemak contoh, kemudian Sahkan. PBKDF2 bagi guru baharu disediakan di browser dengan bilangan sebenar, tanpa peratus kemajuan rekaan. Kekalkan tab sehingga backend mengesahkan commit.

Commit menggunakan global lock dan WAL sedia ada. Profil sekolah disimpan dalam _STATE, kemudian dua Script Properties paparan sekolah diselaraskan selepas commit; secrets/infrastruktur tidak disentuh. Jika database berubah selepas pratonton, commit ditolak sepenuhnya dan perlu validasi semula. Readiness dimuat semula selepas simpanan; jika refresh status gagal, import yang sudah committed tetap dianggap disimpan, bukan dibatalkan.

## Import semula dan konflik

Fail sama tidak mencipta pendua. Padanan stabil menggunakan IDs, kod+alias dan teacher_ref; enrolmen menggunakan murid/tahun/kelas/tarikh/status. Baris yang tiada tidak dipadam. Pembetulan nama medan yang selamat boleh dikemas kini. Import tidak memadam markah, menukar PIN sedia ada, menutup enrolmen lama secara tersirat, menukar guru kelas aktif, menyahaktifkan akaun/kelas sedia ada atau mengubah konfigurasi exam yang telah disediakan. Pemindahan kelas/tarikh/status enrolmen sedia ada mesti melalui semakan manual. Cohort yang disediakan tidak menerima enrolmen baharu secara senyap.

Guru subjek tambahan ialah tugasan tambahan; jika mengganti guru lama, tamatkan tugasan lama melalui pentadbiran dengan semakan berasingan. Import tidak menyimpulkan pemadaman daripada ketiadaan baris. ID database rosak/pendua ditolak untuk semakan manual.

Jika respons hilang/timeout, tekan butang commit sama untuk menggunakan request ID asal. WAL/replay mengelakkan write berganda. Selepas refresh, status mungkin belum diketahui: semak readiness/audit, kemudian validasi workbook semula. Jika transaction committed, rekod dipadankan/skip. Jangan padam RECOVERY_ROW atau _OPS. Jika recovery gagal, hentikan operasi dan ikut panduan pemulihan.

## Selepas import

Readiness menunjukkan kelas, murid, enrolmen, guru, pending activation, tugasan, subjek dan perkara hilang mengikut kelas/subjek. Gunakan tab pentadbiran biasa untuk membetulkan perkara tertentu, kemudian Semak Semula Readiness; tidak perlu mendaftarkan semua orang semula. Keluarkan kod pengaktifan secara peribadi selepas mengesahkan identiti guru.

Import tidak menyediakan/membuka exam secara automatik, termasuk niat OPEN. Setelah struktur lengkap dan tarikh disemak, tekan Sediakan & Buka Selepas Semakan. Ini membekukan cohort/subjek melalui prepareExam_ asal dan membuka mengikut tarikh backend. Pending activation ditunjukkan sebagai amaran; guru pending masih tidak boleh menggunakan workspace. Pengaktifan guru, semakan akhir cohort dan penerimaan PDF tetap tindakan manusia yang diperlukan.

Had setiap workbook:8MB compressed,40MB expanded,12MB satu bahagian ZIP,10,000 rekod input,2000 murid,300 guru,60 kelas. Setiap kelas untuk preparation:1–60 murid aktif. Had ini bukan jaminan masa Google; uji salinan staging mengikut saiz sekolah.

Import CSV roster dan sejarah lama masih tersedia melalui butang Import CSV / Sejarah Lama.


## Pilihan subjek murid

Dalam `03_STUDENTS`, tambah dua kolum pada baris header 4: `religion_subject` dan `elective_subject`. Setiap murid ACTIVE dengan enrolmen ACTIVE mesti mempunyai tepat satu PI/PM dan satu BA/BC/BT jika kolum ini digunakan. Murid LEFT/ENDED boleh dibiarkan kosong. Kedua-dua kolum perlu hadir bersama. Template baharu mengandungi kolum tersebut; workbook lama enam kolum masih diterima tanpa memadam pilihan yang pernah diimport.

Pilihan diimport ke metadata tahun/kelas, kemudian dibekukan ketika menyediakan setiap peperiksaan. Hanya murid yang mengambil subjek muncul kepada guru subjek. Rekod subjek lain kekal TB dalam semakan kelas/slip. Peperiksaan sedia ada tidak diubah secara automatik. Selepas peperiksaan disediakan, pertukaran pilihan ditolak oleh import dan memerlukan semakan khusus pentadbir.

Sheet pengisian tidak diselaraskan secara automatik: selepas edit, muat turun XLSX dan import semula dengan pratonton. Tarikh pengisian peperiksaan boleh dikemas kini melalui admin Web App. Kod pengenalan guru perlu teks enam digit; alias menggunakan huruf kecil, angka, `_` atau `-`. PIN tidak boleh diisi dalam kolum identification_code.
