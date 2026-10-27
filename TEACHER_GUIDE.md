# Panduan Guru v1.0.3

Guru baharu: ikuti [panduan pengaktifan](TEACHER_ONBOARDING_GUIDE.md). Akaun sedia ada terus menggunakan PIN individu; jangan gunakan BBB8307 untuk akaun yang sudah aktif.

Log masuk melalui workspace rasmi menggunakan kod guru (contoh AHMAD; kod angka akaun lama juga disokong), alias jika diberikan dan PIN individu. Pilih tugasan kelas/subjek yang betul.

## Isi dan simpan markah

Masukkan nombor bulat0–100, TH, TB atau kosong.0 ialah markah sah. Gred dipratonton serta-merta. Enter/ArrowDown/ArrowUp bergerak antara murid; carian menapis nama. Tampalan kelompok memerlukan satu nilai setiap murid dalam susunan penuh dan pengesahan bilangan.

Autosave bermula selepas kira-kira650ms tanpa input baharu. Anda boleh terus menaip ketika batch terdahulu disimpan. Status “Menyimpan…” belum bermakna berjaya; tunggu “Semua perubahan disimpan” selepas backend mengesahkan. Nilai tidak sah mesti dibetulkan. Pengisian tidak menggunakan overlay penuh; loader digunakan semasa log masuk/pertukaran paparan.

Jika terputus/timeout, server mungkin sudah menyimpan. Kekalkan tab dan tekan Cuba Simpan; sistem menggunakan ID permintaan asal. Jangan masukkan semula rekod secara tergesa-gesa. Navigasi menunggu pending save. Jika server lebih lambat, amaran muncul; selepas45s UI membenarkan tindakan pemulihan tanpa menganggap operasi gagal di server.

## Draf dan konflik

Refresh tab biasa boleh memulihkan pending/in-flight/invalid dari sessionStorage. Semak draf, kemudian Cuba Simpan. Draf lama diberi amaran dan masih diperiksa terhadap versi server. Jika sesi tamat, log masuk akaun yang sama untuk memulihkan kerja. Jangan tutup tab sebelum simpanan disahkan; penutupan tab/browser crash tidak dijamin pulih.

Jika konflik, nilai server tidak ditulis ganti secara senyap. Eksport/catat nilai anda, semak rekod terkini, kemudian buang draf dengan pengesahan dan masukkan pembetulan selepas semakan. Eksport Draf ialah fail peribadi untuk rujukan/manual recovery, bukan fail yang boleh dimuat naik automatik. Jika draf rosak, eksport dahulu sebelum Buang Draf Rosak. Jangan berkongsi fail draf di ruang awam.

Keluar memerlukan semua draf pengguna ini diselaraskan, termasuk tugasan yang belum dibuka selepas refresh. Buka tugasan tersebut untuk sync atau buang secara nyata selepas eksport/semakan. Pada peranti bersama, jangan meninggalkan sesi terbuka. Jika storage browser gagal, kekalkan tab terbuka dan log masuk akaun asal; jangan bertukar pengguna sebelum menyelamatkan kerja.

## Penghantaran dan guru kelas

Semak bilangan markah angka/TH/TB/EMPTY. EMPTY menghalang penghantaran. Sahkan bahawa semua default TB telah disemak, termasuk subjek yang semua murid TB. Selepas penghantaran, pengisian biasa dikunci; pembetulan melalui aliran yang dibenarkan.

Guru kelas: semak matriks, subjek belum dihantar, murid EMPTY dan ulasan wajib. Ulasan maksimum300 aksara, satu perenggan; autosave/retry/export/discard tersedia. Templat ulasan hanya diterapkan pada ulasan kosong selepas pengesahan. Pindaan markah memerlukan sebab dan direkod dalam audit.

Semak Kesiapsiagaan sebelum SAHKAN & JANA SLIP. Backend menyemak penghantaran, markah, ulasan, coverage dan revision sekali lagi. Selaraskan draf subjek lain dalam tab sama dahulu; tab/peranti lain juga perlu disemak oleh guru sendiri.

PDF dijana di latar belakang: QUEUED → PROCESSING → COMPLETED atau FAILED. Bilangan snapshot diproses ialah kemajuan sebenar, bukan peratus jaminan. Refresh semakan untuk status baharu. Muat turun PDF gabungan kelas terkini selepas COMPLETED. Jika FAILED/lapuk, hubungi pentadbir; jangan guna slip revision lama selepas pembetulan rasmi.


## Login emel dan PIN enam digit
Selepas pentadbir mengaktifkan migrasi akaun, gunakan emel yang diisi dalam tab USERS. Akaun belum aktif menggunakan BBB8307, kemudian wajib menetapkan dan mengesahkan PIN enam digit. Akaun yang telah aktif menggunakan credential semasa sekali sebelum menetapkan PIN enam digit. Sifar di hadapan PIN dikekalkan. PIN disimpan sebagai hash, bukan teks biasa.

Guru kelas mengesahkan kelas selepas semua subjek dihantar. Penjanaan dan muat turun PDF kini diurus oleh pentadbir sahaja.
