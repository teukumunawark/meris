# Architecture & Tech Stack Decision Record (ADR)
**Project:** Split Bill Automation
**Date:** 2026-06-02

## 1. Overview
Dokumen ini menguraikan tumpukan teknologi (*tech stack*) yang dipilih untuk proyek otomasi *Split Bill*. Mengingat sistem ini membutuhkan sinkronisasi data antar pengguna secara kolaboratif (*real-time/near real-time*) dan akan di-host secara mandiri (*self-hosted/homelab*), arsitektur dirancang agar modular, hemat memori, dan mudah di-*deploy* menggunakan kontainerisasi.

## 2. Frontend (Client-Side)
- **Framework:** Next.js (App Router)
- **Bahasa:** TypeScript
- **UI & Styling:** Tailwind CSS dipadukan dengan **shadcn/ui**.
- **Alasan Pemilihan:** Next.js sangat matang untuk *routing* dan pengembangan UI secara cepat. TypeScript memastikan keamanan tipe data antara respons backend dan komponen UI. shadcn/ui memberikan komponen yang indah, *accessible*, dan bisa dikustomisasi penuh tanpa terikat pada pustaka eksternal (*npm package*) yang kaku.
- **Komunikasi Real-time:** Menerima aliran pembaruan dari backend menggunakan *Server-Sent Events (SSE)*.

## 3. Backend (Server-Side)
- **Bahasa:** Golang (Go)
- **Komunikasi Klien-Server:**
  - REST API standar untuk operasi sekali jalan (*upload* struk, membuat sesi).
  - **Server-Sent Events (SSE)** untuk sinkronisasi *real-time* ke sisi klien (mendorong *update* ketika seseorang mengklaim item).
- **Database:** PostgreSQL
- **Alasan Pemilihan:** Golang sangat efisien dalam menangani koneksi konkuren (SSE) dengan memori yang sangat kecil berkat *Goroutines*. Ini sangat cocok untuk *self-hosting* di server lokal/homelab dengan sumber daya terbatas. Seluruh logika bisnis sensitif (kalkulasi pajak proporsional) dikunci secara aman di server Go (otoritatif), tidak di klien.

## 4. Layanan AI (Receipt Extraction)
- **Layanan:** Xiaomi MiMo (khususnya seri V2.5 / Omni) yang sangat tangguh untuk memproses input multimodal (gambar struk).
- **Peran:** Backend Golang akan menerima unggahan gambar struk, mengirimkannya ke layanan MiMo API dengan instruksi (Prompt) yang ketat untuk mengembalikan struktur JSON berisi daftar item, harga, subtotal, dan total pajak/layanan.

## 5. Deployment Strategy (Homelab / Self-Hosted)
- **Containerization:** Docker & Docker Compose.
- **Topologi Lokal:**
  - 1 Container untuk Database PostgreSQL.
  - 1 Container untuk Golang Backend API.
  - 1 Container untuk Next.js Frontend.
- **Keuntungan:** Mudah dinyalakan dan dipindahkan ke mesin *homelab* mana saja (Linux/Proxmox/Raspberry Pi) hanya dengan satu perintah `docker-compose up`.
