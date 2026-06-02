# Product Requirements Document: Split Bill Automation

## Problem Statement

Saat berlibur atau makan bersama (misalnya grup berisi 2-4 orang atau lebih), biasanya satu orang akan menalangi pembayaran terlebih dahulu. Mengingat format struk bervariasi, menghitung secara manual siapa yang memesan apa sangat merepotkan. Selain itu, si pembayar sering kali kesulitan membagi beban Pajak (Tax) dan Biaya Layanan (Service Charge) secara adil (proporsional) kepada tiap orang, sehingga terkadang si pembayar harus menanggung selisih biaya tersebut. Proses hitung-hitungan yang rumit ini membuat orang malas menalangi atau menagih kembali uangnya.

## Solution

Sebuah web aplikasi kolaboratif di mana si pembayar cukup memfoto struk, dan sistem berbasis AI akan mengekstrak data item, harga, pajak, dan service charge secara otomatis. Setelah diekstrak, sistem menghasilkan sebuah tautan (URL) sesi yang bisa dibagikan ke teman-teman. Teman-teman dapat membuka tautan tersebut tanpa perlu login, memasukkan nama mereka, dan langsung "mengklaim" pesanan mereka secara mandiri dan *real-time*. Sistem akan menghitung otomatis tagihan akhir masing-masing orang, termasuk pembagian pajak dan service charge secara proporsional berdasarkan total konsumsi masing-masing orang.

## User Stories

1. As a Payer, I want to upload a photo of a receipt, so that I don't have to manually type out all the items and prices.
2. As a Payer, I want the system to automatically extract items, prices, tax, and service charge from the receipt using AI, so that the base data is ready for splitting instantly.
3. As a Payer, I want to create a shareable link for a specific bill session, so that my friends can access it directly.
4. As a Participant, I want to open a link and join the session without creating an account or logging in, so that I can quickly claim my items without friction.
5. As a Participant, I want to enter my name upon joining the session, so that others know who I am.
6. As a Participant, I want to click/claim specific items from the bill, so that they are added to my personal tab.
7. As a Participant, I want to be able to split a single item with another person (e.g., sharing a large portion), so that the cost is divided correctly between us.
8. As a Participant, I want to see my total updated in real-time as I claim items, so that I know exactly how much I owe.
9. As a Payer, I want the system to calculate tax and service charge proportionally based on each person's claimed subtotal, so that the calculation is 100% fair and I don't lose money on taxes.
10. As a Participant, I want to see the payer's bank or e-wallet details on the final summary screen, so that I can easily transfer the money I owe.
11. As a Payer, I want to see a final summary of who owes what, so that I can easily verify if everyone's claims match the grand total.

## Implementation Decisions

- **Modul Pemrosesan Struk:** Menggunakan VLM (Vision Language Model) / AI Vision API untuk mengekstrak teks non-standar dari struk menjadi format JSON terstruktur.
- **Modul Manajemen Sesi:** Penyimpanan data sementara berbasis sesi. Setiap sesi memiliki ID unik yang dijadikan *shareable link*.
- **Modul Kolaborasi & Klaim:** Membutuhkan sinkronisasi data antar klien (real-time/near real-time) agar saat satu orang mengklaim item, layar orang lain (termasuk si Payer) ikut diperbarui untuk mencegah klaim ganda yang tidak diinginkan.
- **Modul Kalkulasi (Inti Logika):** 
  - Pajak dan Service Charge didistribusikan murni berdasarkan persentase subtotal seseorang terhadap subtotal keseluruhan struk.
  - Formula dasar: `(Subtotal_Orang / Subtotal_Keseluruhan) * (Pajak + Service_Charge)`.
- **Modul Rekapitulasi:** Menampilkan *Summary* per individu beserta instruksi pembayaran/nomor rekening si Payer.

## Testing Decisions

- Modul **Kalkulasi Proporsional Pajak** akan menjadi fokus utama *automated testing*.
- Tes yang baik harus berfokus pada hasil akhir fungsi (black-box), bukan pada implementasi internal kodenya.
- Skenario pengujian wajib mencakup:
  - Pembagian satu item untuk beberapa orang secara presisi.
  - Kalkulasi persentase pajak (misal 11% PPN) di mana jumlah seluruh tagihan individu harus akurat dan sama dengan *Grand Total* struk (penanganan *rounding error* pecahan desimal).
  - Validasi bahwa jika satu item dibatalkan klaimnya, kalkulasi total dan pajak secara otomatis menyesuaikan secara proporsional.

## Out of Scope

- Autentikasi/Login pengguna (Guest mode only untuk kemudahan).
- Integrasi Payment Gateway internal (Pembayaran tetap dilakukan secara manual via transfer Bank/E-Wallet oleh pengguna).
- Penyimpanan riwayat jangka panjang yang terikat akun (data bersifat per-sesi).

## Further Notes

Desain difokuskan pada kecepatan dan pengurangan friksi. *UX must be highly responsive and intuitive, requiring zero onboarding for participants.*
