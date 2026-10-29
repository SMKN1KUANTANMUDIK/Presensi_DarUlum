# Laporan Debug & Optimasi — Presensi SMKN 1 Kuantan Mudik

**File hasil:** `kode.gs` (versi v7)
**File lama:** `kode.gs.txt` (tidak diubah, disimpan sebagai pembanding)

Semua perbaikan backend tetap memakai nama action, bentuk request, dan bentuk respons
yang sudah dipakai aplikasi React. Versi v4 menambah dua action baru
(`getRekapGuruSemester`, `sinkronKasusDariAbsensi`) dan field `kasusDibuat` pada
`simpanAbsensi`; frontend versi baru memakai action tersebut untuk laporan semester
pertemuan 1–24 dan notifikasi kasus otomatis.

Versi **v5** menambah tiga action apel pagi (`getApelPagi`, `simpanApelPagi`,
`hapusApelPagi`) dan sheet baru **`Apel`**. Sheet ini sengaja terpisah dari `Absensi`
agar rekap mapel dan kasus otomatis tidak terpengaruh. Frontend juga menambah portal
orang tua dengan login **NISN atau nama anak**, penanda **Sabtu/Minggu + libur
nasional 2026**, dan kartu **apel pagi** di Dashboard Piket.

Versi **v6** memperluas `getApelPagi` agar bisa difilter per **bulan** dan **NISN**
(tanpa mengubah pemanggilan lama `tanggal + kelas`), lalu memakainya untuk **laporan
keterlambatan di dashboard orang tua**. Tombol/CTA install juga dihapus dari seluruh
antarmuka; pemasangan PWA hanya lewat pop-up pertama dan menu browser.

---

## 1. Bug yang diperbaiki

### Bug fatal (aplikasi error / data salah)

| # | Masalah pada kode lama | Perbaikan |
|---|---|---|
| 1 | `tutupKasusPembinaan` tidak punya `break` di router, sehingga hasilnya selalu ditimpa `catatTindakanKasus`. Kasus tidak pernah benar-benar ditutup. | Router diganti dari `switch` menjadi tabel aksi (`GET_ACTIONS` / `POST_ACTIONS`). Fall-through tidak mungkin terjadi lagi. |
| 2 | `const sh` di-assign ulang di `getKasusPembinaan` dan `simpanKasusPembinaan` → runtime error *Assignment to constant variable* saat sheet `Kasus` belum ada. | Pembuatan sheet dipusatkan di `ensureKasusSheet()`; variabel tidak di-assign ulang. |
| 3 | Sheet `Kasus` dibuat dengan header 11 kolom, padahal kode membaca/menulis 18 kolom (`level`, `tindakan_*`, `escalated_to`, `catatan_*`). Kolom 12–18 tanpa nama. | Header 18 kolom otomatis dilengkapi (`ensureHeader`). Data lama tetap aman; kolom yang kosong diisi nama header. |
| 4 | `formatDate()` memanggil `Utilities.formatDate` untuk **setiap baris** pada setiap request. Ratusan ribu panggilan Java → lambat/timeout. | Diganti formatter lokal `dateKey()` (string + objek `Date`), tanpa panggilan layanan. |
| 5 | Cek bentrok jadwal ikut membandingkan `mapel`, sehingga satu kelas bisa diabsen dua guru berbeda pada jam yang sama. | Bentrok dicek per **kelas + jam**. Satu kelas tidak bisa punya dua sesi di jam yang sama. |
| 6 | `updateAbsensi` menulis sel satu per satu dan menerima `rowIndex` di luar jangkauan sheet. | Baris divalidasi (`2..lastRow`), lalu ditulis **sekali** dalam satu `setValues`. |
| 7 | `hapusAbsensi` memanggil `deleteRow` per baris (ratusan operasi). | Baris berurutan digabung, lalu dihapus per blok dari bawah (`deleteRows`). |
| 8 | `getKasusPembinaan` / `simpanKasusPembinaan` memberi level default `kepsek` bila `role` kosong. | Default menjadi `wali_kelas` (hak paling kecil). |
| 9 | `importGuru` tidak mendeteksi username yang sudah dipakai NIP lain → dua guru bisa punya username sama. | Username dicek unik terhadap data lama **dan** terhadap baris lain di file impor. |
| 10 | Ada `break;` ganda dan `case` tanpa `break` di router GET/POST. | Router tabel aksi, tidak ada lagi `switch`. |

### Bug data & ketahanan

| # | Masalah | Perbaikan |
|---|---|---|
| 11 | `getRiwayatAbsensi` membaca seluruh sheet dan mengirim semua sesi. Setelah data menumpuk, request melewati batas 20 detik frontend. | Dibaca **mundur dari baris terakhir**, per potongan 8.000 baris, dengan batas waktu 12 detik (di bawah timeout frontend). Respons tetap berisi `truncated` bila pemindaian berhenti. |
| 12 | `getDetailAbsensi`, `hapusAbsensi`, dan dashboard membaca seluruh sheet untuk mencari 1 tanggal. | Pembacaan hanya pada jendela tanggal yang dibutuhkan (`streamAbsensiRows`), per potongan. |
| 13 | `simpanAbsensi` bisa menyimpan NISN ganda bila data siswa terkirim dua kali. | NISN dideduplikasi; jumlah yang diabaikan dikembalikan sebagai `diabaikan`. |
| 14 | `simpanAbsensi` tidak memvalidasi jam (bisa 0, negatif, atau > 20). | Divalidasi 1–20 dan `jam_selesai >= jam_mulai`. |
| 15 | Eskalasi kasus menimpa catatan wali (`catatan_wali`) dengan catatan eskalasi. | Catatan eskalasi **ditambahkan** sebagai baris baru, catatan sebelumnya tidak hilang. |
| 16 | Import siswa membuat kelas baru satu per satu (banyak tulis sheet). | Semua kelas baru dibuat dalam satu operasi (`tambahKelasBaru`). |
| 17 | Import siswa/guru menulis baris satu per satu. | Ditulis sekali (`setValues`), dengan batas 2.000 baris siswa / 1.000 baris guru per import. |
| 18 | Header sheet yang rusak/kurang tidak pernah diperbaiki. | `ensureHeader()` memperbaiki header yang kosong saat data ditulis. |
| 19 | `uploadFoto` tidak membatasi ukuran; file sangat besar bisa menggagalkan request. | Batas 6 MB + validasi `data:image/...`. Kegagalan set sharing Drive tidak lagi menggagalkan absensi. |
| 20 | Role `wali_kelas` dari sheet tidak dikenali frontend (frontend memakai `wali`). | `normalizeRole()` menyeragamkan `wali_kelas`/`wali kelas` → `wali`, `kepala_sekolah` → `kepsek`. |

---

## 2. Optimasi performa

| Optimasi | Dampak |
|---|---|
| `streamAbsensiRows()` — baca kolom tanggal dulu, lalu hanya blok tanggal yang cocok, per 8.000 baris | Dashboard/riwayat tidak lagi memuat seluruh sheet ke memori. |
| `getRiwayatAbsensi` dibaca mundur (data terbaru dulu) + batas waktu 12 detik | Halaman Riwayat tetap responsif walau data sudah bertahun-tahun. |
| `CacheService` untuk master data (`getConfig`, daftar siswa) selama 10 menit | Dashboard berulang tidak membaca sheet `Siswa`/`Kelas`/`Guru`/`Mapel`/`Jam` terus-menerus. |
| `bumpCache()` dipanggil setiap data guru/siswa/kelas berubah | Cache langsung tidak valid setelah edit/import, jadi data tidak basi. |
| `getAbsensiGuru` mengirim **satu status per siswa per hari** | Data yang dikirim ke halaman Report berkurang drastis (dulu semua baris per jam). Hasil rekap tetap sama karena memakai prioritas C > A > S > I > H. |
| Baca/tulis/hapus batch (satu `setValues`/`deleteRows`) | Operasi edit & hapus jauh lebih cepat dan kecil kemungkinan timeout. |
| `getDashboardKepsek` hanya membaca jendela 12 bulan (trend) + periode terpilih | Tidak lagi memindai seluruh riwayat sekolah. |
| `getDashboardPiket` mengelompokkan siswa & absensi per kelas satu kali jalan | Loop berkurang dari O(kelas × siswa) menjadi O(siswa). |
| `getDashboardAdmin` menghitung status akhir per siswa per hari | Angka hadir/alpha tidak lagi menghitung satu siswa berkali-kali. |
| `setupSpreadsheet()` | Membuat/memperbaiki semua sheet & header dalam sekali jalan. |
| `arsipkanAbsensiLama(bulan)` | Memindahkan absensi lama ke spreadsheet arsip agar sheet utama tetap ringan (dijalankan manual, tidak otomatis). |

---

## 3. Perubahan perilaku yang perlu diketahui

1. **Konflik jadwal** sekarang per kelas + jam. Mapel berbeda di jam yang sama untuk kelas yang sama akan **ditolak** (sebelumnya lolos).
2. **`getDashboardAdmin` → `hadirPersen`** sekarang dihitung dari status akhir siswa hari itu (prioritas C > A > S > I > H), bukan dari “pernah hadir di satu jam”. Angka bisa lebih kecil, tetapi lebih benar.
3. **Riwayat** mengirim data dari yang terbaru. Bila pemindaian melewati 12 detik, respons berisi `truncated: true` (saat ini belum ditampilkan di UI). Data lama tetap bisa difilter dengan `?tanggal=` atau `?bulan=` di level API.
4. **Eskalasi kasus** menambahkan catatan, tidak lagi menimpa catatan wali.
5. Level kasus default untuk role kosong adalah `wali_kelas` (bukan `kepsek`).
6. **Semester** mengikuti tahun ajaran: Ganjil = 1 Juli–31 Desember, Genap = 1 Januari–30 Juni.
   Parameter `tahun` adalah tahun mulai (mis. `2026` untuk `2026/2027`).
7. **Satu pertemuan** = satu sesi absensi (tanggal + mapel + guru) pada satu kelas; jam
   yang berurutan digabung. Nomor pertemuan diurutkan kronologis dan dibatasi
   maksimal **24 pertemuan pertama** per semester (`MAKS_PERTEMUAN_SEMESTER = 24`).
8. **Kasus otomatis** dibuat saat siswa mencapai **3 hari Alpha atau 3 hari Cabut**
   dalam semester berjalan (satu status terburuk per hari). Kasus masuk level
   `wali_kelas`, status `Open`, dan tidak diduplikasi untuk NISN + jenis yang sama
   pada semester tersebut. Pemicu: `simpanAbsensi` (bila sesi berisi A/C) dan
   `sinkronKasusDariAbsensi` dari halaman kasus.

---

## 4. Cara deploy (wajib)

1. Buka spreadsheet presensi → **Extensions → Apps Script**.
2. Hapus isi `Code.gs`, tempel seluruh isi **`kode.gs`**.
3. Pastikan `SPREADSHEET_ID` dan `FOLDER_FOTO_ID` masih benar (sudah terisi sesuai file lama).
4. Simpan (Ctrl+S). Jalankan fungsi **`setupSpreadsheet`** sekali dari editor untuk memastikan semua sheet/header benar (opsional tetapi disarankan).
5. **Deploy → Manage deployments → pilih deployment yang dipakai → ikon pensil (Edit) → Version: New version → Deploy**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Buka URL `/exec` hasil deploy, tambahkan `?action=getVersion`. Harus muncul `"version":"v6"` dan `fitur` memuat `"apel-pagi"` dan `"apel-bulanan"`.
7. Uji cepat: login, input absensi 1 kelas, buka Dashboard/Piket/Riwayat, edit & hapus 1 sesi, catat 1 siswa terlambat di kartu **Apel Pagi**, lalu cek halaman kasus (jika dipakai).

> **URL deployment (sudah diseragamkan):**
> Semua salinan aplikasi kini memakai deployment ID yang sama:
> `AKfycbzjuoBgMlKE2BVUEU3pwZwWGMyITWZUIaq4f8gWx0fGG7dlS6bWUCKqsIWiZJkVDq8`
>
> - `src/lib/api.js` (sumber `GAS_URL`)
> - `dist/` dan `presensi-modern/publish/`
> - `Default Project/publish/assets/index-*.js` dan `Default Project/publish/kasus.html`
>
> Verifikasi cepat: buka `…/exec?action=getVersion` → harus `{"success":true,"version":"v6",...}`.
> Jika ada salinan/hosting lain, pastikan juga memakai ID di atas.

---

## 5. Fungsi perawatan (jalankan manual dari editor)

| Fungsi | Kegunaan |
|---|---|
| `setupSpreadsheet()` | Membuat sheet yang belum ada & melengkapi header (termasuk Kasus 18 kolom). |
| `arsipkanAbsensiLama(12)` | Memindahkan absensi lebih tua dari 12 bulan ke spreadsheet arsip. Data yang diarsipkan tidak lagi muncul di dashboard/riwayat. **Backup spreadsheet dulu.** |
| `testLogin()` | Cek login `admin` / `admin123`. |
| `testGetConfig()` | Cek daftar kelas, guru, mapel, jam. |
| `testDashboardAdmin()` | Uji dashboard admin. |
| `testDashboardPiket()` | Uji dashboard piket hari ini. |
| `testDashboardKepsek()` | Uji dashboard kepsek. |
| `testRiwayat()` | Uji 5 sesi riwayat terbaru. |

Spreadsheet arsip dibuat otomatis pada pemanggilan pertama. ID-nya disimpan di Script Properties (`ARSIP_SPREADSHEET_ID`), atau isi manual konstanta `ARSIP_SPREADSHEET_ID` di bagian atas file.

---

## 6. Hasil pengujian

Pengujian dilakukan dengan simulasi layanan Apps Script (Spreadsheet, Cache, Lock, Drive)
di Node.js, mencakup **116 skenario**:

- login sukses/gagal, config, kelas, jurusan, guru, wali kelas;
- simpan absensi (termasuk NISN ganda, jam tidak valid, bentrok jadwal, mapel beda di jam lain);
- upload foto (valid, format salah, melebihi 6 MB);
- dashboard piket/admin/kepsek (harian, mingguan, bulanan, semester);
- riwayat, detail sesi, update batch, hapus sesi;
- rekap guru per semester (24 kolom pertemuan, filter mapel, batas 24, semester ganjil/genap);
- kasus otomatis 3× Alpha / 3× Cabut (deduplikasi, pemicu simpan absensi & sinkron halaman kasus);
- kasus pembinaan: simpan, tindakan, eskalasi, tutup, filter, peringatan wali;
- CRUD + import guru/siswa (duplikat NIP/NISN/username, role salah, kelas baru);
- `setupSpreadsheet` dan `arsipkanAbsensiLama`;
- uji skala 9.600 baris untuk memastikan pembacaan per potongan, hapus blok, dan update batch benar.

**Hasil: 116 lulus, 0 gagal.**

---

## 6b. Debug pass (audit menyeluruh backend + kontrak frontend)

Audit dua jalur (logika backend & kontrak frontend↔backend) menemukan temuan berikut,
semuanya sudah diperbaiki:

### Backend (`kode.gs`)
1. **`updateAbsensi` tanpa verifikasi identitas baris (kritis).** Nomor baris bisa bergeser
   setelah sesi lain dihapus — edit dari tab Riwayat yang terbuka lama bisa menimpa siswa lain.
   Sekarang tiap baris dicek ulang (nisn/tanggal/kelas/mapel/guru/jam) sebelum ditulis;
   baris yang tidak cocok dilewati (`ditolak`) dan frontend menampilkannya sebagai peringatan.
   Edit juga kini memicu kasus otomatis seperti simpan absensi.
2. **Kasus wali kelas gagal-buka.** `getKasusPembinaan`/`getPeringatanWaliKelas`/
   `simpanKasusPembinaan` sebelumnya menampilkan/membuat kasus **seluruh sekolah** bila
   `kelas_wali` kosong. Sekarang selalu dibatasi kelas wali (error bila tidak diketahui).
3. **Tanggal rusak diterima.** `2026-02-31` / `2026-13-05` tersimpan tapi hilang dari semua
   rekap. `dateKey` kini memvalidasi rentang bulan/hari; `monthEndKey`/`monthKey` menolak
   bulan tidak valid.
4. **NISN ganda saat simpan absensi.** Dulu status pertama yang menang; sekarang status
   terburuk (konsisten dengan aturan "terburuk menang" di rekap).
5. **Rekap per semester: sesi mapel sama di tanggal sama.** Dulu digabung hanya dengan
   tanggal+mapel; dua sesi berbeda jadi satu pertemuan palsu. Sekarang kunci sesi = UUID
   yang dibagikan satu kali simpan (`ABS.ID`), dan ID memakai base64 JSON bila mapel/guru
   mengandung karakter `|`.
6. **`semesterRange` untuk semester genap tanpa tahun** memakai tahun acuan yang salah
   (bisa melompat ke masa depan). Kini genap selalu `tahunAcuan − 1`.
7. **Eskalasi & penutupan kasus tanpa validasi.** Eskalasi kini memeriksa level/status saat
   ini; kasus yang sudah ditutup tidak bisa ditimpa lagi.
8. **Dedup kasus otomatis per semester.** Kasus semester lalu (meski masih Open) tidak lagi
   memblokir kasus baru semester berjalan. Siswa yang melewati **kedua** ambang (3 Alpha dan
   3 Cabut) kini mendapat dua kasus.
9. **`getAbsensiGuru`** mengirim metadata (jam/mapel/guru) dari sesi yang menentukan status
   akhir, bukan sesi pertama yang ditemui.
10. **Riwayat terpotong ditandai.** Balasan backend memuat `truncated`; frontend menampilkan
    banner peringatan (juga pada pembacaan mundur tanpa filter).
11. **`importGuru`** tidak lagi mengosongkan `kelas_wali` milik admin/wali saat import
    tanpa kolom tersebut; `trendSemester` diurutkan kronologis.

### Frontend
1. **`kasus.html`: semua aksi tulis mati (CORS).** Empat POST memakai
   `Content-Type: application/json` → preflight `OPTIONS` yang tidak dijawab Apps Script →
   Tambah/Catat/Eskalasi/Tutup Kasus selalu gagal. Sekarang `text/plain` (tanpa preflight).
2. **`kasus.html`: stored XSS.** Nama/kelas/keterangan siswa disisipkan mentah ke `innerHTML`
   dan ke atribut `onclick`. Semua field kini di-escape dan tombol aksi memakai lookup
   berbasis indeks (`kasusData[idx]`), bukan string nama.
3. **`kasus.html`:** pesan error tanpa fallback (`data.error || …`), label role asing
   (`ROLE_LABELS[ROLE] || 'Tamu'`), filter kelas dikunci untuk wali kelas.
4. **Riwayat:** modal detail menyatukan baris list + respons detail (jam tidak hilang);
   edit mengirim identitas baris; toast untuk kasus otomatis & baris yang ditolak.
5. **Kepsek:** insight "alpha tertinggi" sebelumnya memilih jurusan dengan alpha **terendah**.
6. **Input absensi:** kegagalan upload foto kini diberi peringatan (absensi tetap tersimpan).

---

## 6c. Portal Orang Tua / Wali (baru)

Halaman publik `#/ortu`, terpisah dari akun guru/admin. Portal memakai action yang sudah
ada (`getKelas`, `getSiswa`, `getAbsensiGuru`, `getKasusPembinaan`); tidak ada action
khusus portal. Action apel pagi hanya dipakai Dashboard Piket.

**Aturan login (paling sederhana, tanpa password):**
1. Masukkan **NISN anak** (hanya angka) **atau pilih tab “Nama Anak”** lalu tulis nama
   anak. Nama dinormalisasi (huruf besar/kecil, tanda baca, dan spasi tidak berpengaruh).
2. Pilih **kelas anak** dari dropdown (memakai daftar resmi `getKelas`).
3. Bila nama yang dicari cocok dengan lebih dari satu siswa, portal menampilkan daftar
   pilihan (nama + NISN). Memilih dari daftar **tidak** dihitung sebagai percobaan gagal.
4. Opsional: centang **“Ingat perangkat ini selama 30 hari”** (aktif default).
5. Salah 5× → jeda **2 menit** pada perangkat tersebut, dengan hitung mundur.

**Isi dashboard (hanya data anak yang login):**
- Status kehadiran hari ini + persentase hadir bulan berjalan.
- Penanda **Libur** untuk Sabtu, Minggu, dan libur nasional (tidak lagi “belum absen”).
- Rekap H / S / I / A / C per bulan, bisa pindah bulan, plus jumlah **hari efektif** dan
  daftar **libur nasional** bulan tersebut.
- Peringatan otomatis bila Alpha+Cabut ≥ 3× sebulan atau ada kasus pembinaan terbuka.
- Riwayat harian: tanggal, mapel, jam, status.

**Catatan keamanan:** NISN bukan data rahasia dan pembatasan percobaan hanya di sisi
perangkat (localStorage). Login memakai nama anak juga berarti siapa pun yang tahu kelas
dan nama anak dapat membuka portal — konsekuensi dari login tanpa password yang diminta.
Bila perlu lebih ketat, tambahkan faktor kedua (tanggal lahir / kode akses per siswa) dan
filter `nisn` di backend agar data satu kelas tidak ikut terkirim.

**Yang diuji (mock API):** login NISN, login nama (persis & sebagian), nama ambigu
(daftar pilihan, tidak menambah hitungan gagal), kunci 5× (hitung mundur berjalan),
sesi 30 hari, keluar, ganti bulan, penanda libur Sabtu, daftar libur nasional Agustus
(17 & 25 Agustus) dan 19 hari efektif, status “Hari ini” tetap benar saat melihat bulan
lain, peringatan A/C dan kasus, serta tidak ada error konsol.

---

## 6d. Kalender libur & apel pagi (v5)

### Kalender libur
- **Sabtu & Minggu** dihitung libur di Portal Orang Tua, Dashboard Piket, dan form Input
  Absensi (penanda saja; absensi untuk kegiatan khusus tetap bisa disimpan).
- **Libur nasional + cuti bersama 2026** mengikuti SKB 3 Menteri, disimpan di
  `src/lib/libur.js` beserta namanya. Tahun lain tetap memakai aturan Sabtu/Minggu.
- Helper: `liburInfo(tanggal)`, `labelLibur(tanggal)`, `hariEfektifBulan(bulan)`,
  `liburNasionalBulan(bulan)`, `liburBulan(bulan)`.

### Apel pagi (`kode.gs` v5)
- Action baru: `getApelPagi`, `simpanApelPagi`, `hapusApelPagi`.
- Sheet baru **`Apel`** (9 kolom): `id | tanggal | nisn | nama_siswa | kelas |
  jam_datang | keterangan | petugas | timestamp`. Terpisah dari `Absensi` agar rekap
  mapel dan kasus otomatis tidak terpengaruh.
- Satu baris = satu siswa per tanggal. Duplikat (`tanggal` + `NISN`) dilewati dan
  dilaporkan pada field `dilewati`.
- `jam_datang` divalidasi `HH:MM`; bila kosong memakai jam server saat ini.
- Dashboard Piket: kartu daftar siswa terlambat, form pilih kelas + cari siswa +
  centang beberapa siswa + jam datang + keterangan, dan tombol hapus per baris.
  Nama petugas diambil dari akun yang sedang login.

**Yang diuji (harness `gas_test.js`, 138 tes):** simpan 2 siswa, baca ulang, urutan jam,
petugas tersimpan, duplikat dilewati, filter kelas, jam tidak valid ditolak, daftar
siswa kosong ditolak, jam kosong memakai jam sekarang, hapus baris, hapus ID asing,
serta filter **bulan**, **bulan + kelas**, **bulan + NISN**, dan **tanggal + NISN**.
Dashboard Piket & portal juga diuji di browser dengan mock API (tanpa error konsol).

---

## 6e. Hapus tombol install & laporan keterlambatan orang tua (v6)

### Tombol install dihapus
- Tombol **Pasang** di topbar HP, item **“Pasang aplikasi”** di sidebar desktop dan
  sheet *Lainnya*, tombol di halaman Login, serta halaman **`/install`** dihapus.
- **Pop-up pertama tetap ada** (mobile, sekali, setelah ~2,6 detik). Pop-up tidak
  muncul lagi bila aplikasi sudah terpasang (standalone) atau sudah pernah ditutup.
- Bila browser menyediakan prompt native, pop-up langsung memanggilnya; bila tidak,
  pop-up menampilkan panduan menu browser (Install aplikasi / Tambah ke layar utama).

### Keterlambatan di Portal Orang Tua
- `getApelPagi(tanggal, kelas, bulan, nisn)`:
  - `tanggal` + `kelas` → perilaku lama (Dashboard Piket),
  - `bulan` + `kelas` (+ `nisn`) → laporan satu bulan untuk portal orang tua,
  - tanpa `tanggal`/`bulan` → tetap default **hari ini** (kompatibel).
- Respons menambah field `bulan` dan `nisn`; `tanggal` berisi tanggal filter atau
  string kosong saat mode bulanan.
- Kartu **Keterlambatan** di portal menampilkan jumlah × terlambat bulan itu, daftar
  tanggal/jam datang/keterangan, dan status hari ini. Bila backend masih lama
  (belum mengembalikan `bulan`), kartu menampilkan keterangan “belum tersedia”
  alih-alih data yang salah.
- Portal memakai filter `nisn` di backend sehingga data siswa lain tidak dikirim.
- **Ramah backend lama (v4):** kartu Keterlambatan menampilkan badge *Belum tersedia*
  (bukan "0 kali") beserta keterangan singkat, sehingga tidak ada angka menyesatkan.
- **Ramah backend lama di Dashboard Piket:** bila action apel belum ada, kartu Apel Pagi
  menampilkan keterangan tenang di dalam kartu + tombol *Catat siswa* dinonaktifkan.
  Tidak ada lagi toast merah saat halaman dibuka.

---

## 6f. Laporan per jam, ringkasan harian, & absensi per guru (v7)

### Rekap harian
- Sel tabel memakai status **jam itu sendiri** (bukan warna status akhir hari):
  `✓` = hadir, `S`/`I`/`A`/`C` = lainnya, `·` = belum ada input.
- Baris kepala kedua menampilkan **mata pelajaran tiap jam** (dari `jamInfo`),
  sehingga jelas jam ke berapa dan mapel apa yang tercatat.
- Kolom **Status** tetap merangkum akhir hari (prioritas `C > A > S > I > H`).

### Rekap bulanan
- Berubah menjadi **ringkasan harian**: satu tanggal hanya dicetak bila ada minimal
  satu siswa dengan status selain hadir pada hari itu.
- Sel berisi status terburuk hari tersebut; `✓` bila seluruh jam hadir; `·` bila siswa
  tidak punya catatan pada hari itu.
- Ditambah kolom **Jumlah hari** (H/S/I/A/C) yang dihitung dari **semua hari yang sudah
  diinput**, bukan hanya hari yang ditampilkan, agar total tetap real.
- Bila tidak ada ketidakhadiran sebulan, tabel diganti keterangan "seluruh siswa hadir".

### Dashboard Piket
- `getDashboardPiket` (backend) kini mengembalikan:
  - `guruList[].jam` (daftar jam mengajar guru+mapel),
  - `guruList[].absen` (siswa non-hadir: `nisn`, `nama`, `status`, `jam`),
  - `guruList[].totalAbsen`,
  - `jamInfo` per kelas: `{ jam: { mapel, guru } }`.
- Kartu baru **"Absensi per Guru"** menampilkan daftar sesi real sesuai input guru
  (jam, mapel, kelas, guru, jumlah hadir/tidak hadir) beserta chip nama siswa yang
  tidak hadir. Kartu kelas tetap menjadi ringkasan H/S/I/A/C hari itu; baris guru di
  kartu kelas kini menampilkan mapel, jam, dan jumlah absen.
- Bila backend masih v6 (belum ada `absen`/`jam`), kartu menampilkan keterangan
  "rincian belum tersedia" dan meminta deploy ulang - tanpa error.

### Verifikasi
- `gas_test.js`: **143 tes lulus, 0 gagal** (termasuk `guruList.jam`, `guruList.absen`,
  `jamInfo`, dan `getVersion` = v7).
- Uji browser (mock): rekap harian menampilkan mapel per jam dan `✓`/`A` sesuai input;
  rekap bulanan hanya memuat 6 tanggal berisi ketidakhadiran dengan kolom jumlah yang
  benar; kartu "Absensi per Guru" menampilkan chip `Budi Santoso A` pada sesi
  Matematika jam 1-2 dan `✓ Semua siswa hadir` pada sesi Bahasa Indonesia jam 3.

---

## 7. Rekomendasi berikutnya (belum dikerjakan)

### Keamanan
1. **Password masih tersimpan sebagai teks biasa** di sheet `Guru`. Minimal gunakan hash
   (`Utilities.computeDigest`) + salt, atau pindahkan autentikasi ke Google Identity.
2. **Login memakai GET** sehingga password ikut di URL/log. Sebaiknya POST + HTTPS body.
3. **Tidak ada token/sesi.** Frontend hanya menyimpan `role` di browser, jadi siapa pun yang
   tahu URL `/exec` bisa memanggil `simpanAbsensi`, `hapusAbsensi`, `importSiswa`, dll.
   Rekomendasi: buat token acak saat login (simpan di CacheService/Properties dengan masa
   berlaku), lalu wajibkan `token` pada setiap request yang mengubah data.
4. Batasi jumlah percobaan login (mis. 5× per menit per username/IP) untuk mencegah brute force.

### Skalabilitas
5. ~~Tampilkan penanda "data dipotong" di Riwayat~~ — **sudah dikerjakan** (banner `truncated`
   + backend menandai `truncated: true`). Filter tanggal/bulan/kelas tetap disarankan untuk
   data yang sangat besar.
6. Jadwalkan `arsipkanAbsensiLama(12)` sekali setahun (atau jalankan manual) agar sheet
   `Absensi` tidak terus membesar.
7. Pertimbangkan cache 1–2 menit untuk dashboard kepsek (paling berat karena trend 12 bulan),
   dengan invalidasi saat ada input absensi baru.
8. Tambahkan validasi bahwa NISN yang dikirim benar-benar siswa di kelas tersebut.
9. Buat backup otomatis spreadsheet (Google Sheets → File → Version history, atau trigger
   `DriveApp` mingguan).

### Konsistensi
10. Samakan URL deployment antara aplikasi utama dan `kasus.html` (lihat bagian 4).
11. Ganti nama kolom `role` di sheet agar konsisten (`wali`, bukan campuran `wali`/`wali_kelas`).
    Backend sudah menormalkan keduanya, tetapi data yang rapi memudahkan audit.

---

*Dibuat untuk Presensi SMKN 1 Kuantan Mudik · © 2026 · by Waldo Guntala, S.Kom*
