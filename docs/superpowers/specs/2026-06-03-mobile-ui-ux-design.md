# Design Specification: Mobile UI/UX Improvements for Landing Page (/)

## Objective
Meningkatkan kemudahan penggunaan (UX) dan keindahan visual (UI) halaman utama (`/`) aplikasi Meris pada perangkat mobile, dengan fokus pada optimasi ruang layar (space efficiency), kegunaan elemen input, dan kerapihan estetika.

## Design Decisions

### 1. Tabbed Interface for Session Card
Mengganti layout vertikal bertumpuk ("Create New Session" dan "Join Existing Session" dengan pembatas "OR") menjadi antarmuka tabbed modern.
* **UI Element**:
  - Segmented control pills di bagian atas formulir.
  - Pilihan Tab: **Create Session** dan **Join Session**.
  - Gaya visual: Latar belakang gelap transparan (`bg-black/20` atau `bg-white/[0.01]`), tab aktif menggunakan warna sage transparan (`bg-sage/10 text-sage`).
* **UX Benefit**:
  - Mengurangi tinggi kartu di mobile lebih dari 50%.
  - Seluruh alur kerja muat dalam satu layar tanpa perlu melakukan scroll (zero scroll landing page).

### 2. Proportional Layout for Settlement Inputs
Mengatur proporsi lebar input Bank/E-Wallet dan Nomor Rekening agar tidak bertumpuk dan pas di layar kecil.
* **Layout**: Mengubah kolom grid dari `grid-cols-2` (lebar sama 50-50) menjadi kolom proporsional **`grid-cols-[2fr_3fr]`** (atau perbandingan 40% - 60%).
* **Placeholders**:
  - Bank input: `"Bank (e.g., BCA)"`
  - Account input: `"Account / Phone"`
* **UX Benefit**:
  - Nama Bank/E-wallet (seperti "BCA", "OVO", "GoPay") biasanya sangat pendek, sedangkan nomor rekening/nomor HP lebih panjang. Distribusi proporsional ini mencegah placeholder terpotong dan mempermudah penulisan data yang lebih panjang.

### 3. Progressive Animation (Framer Motion)
* Mengintegrasikan transisi antar tab menggunakan animasi pemudaran (fade-in) bawaan Framer Motion agar perpindahan dari tab **Create** ke **Join** terasa organik dan premium.

## Path for Changes
* [page.tsx](file:///C:/Users/munawar/Development/meris/frontend/src/app/page.tsx):
  - Tambahkan state `activeTab` (`'create' | 'join'`).
  - Ubah struktur card utama agar menampilkan segmented tabs.
  - Ubah kontainer input Bank & Account No menjadi `grid grid-cols-[2fr_3fr] gap-3`.
  - Kondisikan render elemen input berdasarkan `activeTab`.

---

## Spec Self-Review
* **Placeholder Scan**: Bersih, menggunakan data konkret dan relevan.
* **Internal Consistency**: Semua class Tailwind sejalan dengan sistem visual glassmorphism Meris.
* **Scope Check**: Sangat terfokus pada landing page `/` dan dapat langsung diimplementasikan dalam 1 plan.
