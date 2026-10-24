# Pengaktifan Guru Baharu

## Pentadbir

Import guru baharu melalui workbook. Kod guru menggunakan singkatan nama unik seperti AHMAD atau CHONGFL. Kod angka enam digit akaun lama masih disokong; alias hanya jika kod bertindih. Jangan mengubah akaun sedia ada untuk memaksa mereka mengaktifkan semula. PIN peribadi mereka kekal.

Pentadbiran → Import → Readiness → Akaun Menunggu Pengaktifan. Sahkan identiti setiap guru melalui rekod sekolah/semakan bersemuka. Pilih1–30 akaun pending dan tekan Keluarkan / Keluarkan Semula Kod Terpilih. Kod berbeza untuk setiap guru, dipaparkan sekali sahaja dan luput48 jam. Edarkan secara peribadi bersama kod pengenalan/alias melalui kaedah sekolah yang diluluskan. Jangan kongsi seluruh skrin senarai kod, menampal kod dalam workbook, kumpulan awam atau log.

Kod mentah tidak disimpan dalam Sheets/WAL. Jika respons asal hilang, retry ID sama mengesahkan issuance tetapi tidak memulangkan kod lama. Tekan keluarkan semula selepas notis untuk menjana kod baharu; kod/tiket terdahulu dibatalkan. Jangan menetapkan PIN peribadi guru atau meminta mereka menghantarnya. Setelah diedarkan, tekan Padam Paparan Kod atau keluar daripada halaman.

Hanya akaun pending boleh menerima kod. Akaun yang sudah menetapkan PIN tidak boleh direset melalui fungsi ini; gunakan aliran akaun sedia ada yang dibenarkan sekolah untuk kes pemulihan lain.

## Guru

1. Buka workspace rasmi dan pilih Guru baharu: Aktifkan Akaun.
2. Masukkan kod guru, alias jika diberikan dan PIN sementara BBB8307.
3. Masukkan kod pengaktifan individu24 aksara daripada pentadbir. PIN bersama sahaja tidak cukup untuk mengambil alih akaun.
4. Selepas disahkan, tetapkan PIN individu10–64 aksara dan sahkan nilai yang sama. Capability ini luput10 minit; tiada akses markah/analitik diberikan pada peringkat ini.
5. Selepas simpanan berjaya, credential sementara, kod/tiket dan sesi lama dibatalkan melalui auth_version. Sistem log masuk menggunakan PIN individu dan membuka workspace.

Log masuk seterusnya menggunakan borang biasa dengan PIN individu, bukan BBB8307. Jika sambungan hilang selepas PIN disimpan, cuba log masuk biasa menggunakan PIN baharu; jangan menganggap perlu mengaktifkan semula. Jika kod/tiket luput atau dikeluarkan semula, mulakan aliran semula dan hubungi pentadbir untuk kod yang betul. Kod hanya dianggap digunakan apabila PIN individu berjaya committed; beberapa percubaan sebelum itu tidak membenarkan lebih daripada satu aktivasi berjaya.

Lima percubaan pengaktifan gagal menyebabkan cooldown15 minit; percubaan global turut dihadkan. Jangan mencuba kod guru lain. Jangan tutup tab semasa menetapkan PIN. PIN individu tidak disimpan sebagai plaintext dalam Sheets atau diletakkan dalam Excel. Sesi kerja biasa hanya dicipta selepas akaun tidak lagi pending.

Akaun sedia ada dengan PIN individu terus menggunakan borang log masuk biasa. Had PIN biasa10–64 aksara tidak dilonggarkan untuk BBB8307; laluan sementara berasingan menerima credential itu sahaja.
