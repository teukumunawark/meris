'use client';

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body className="bg-background text-foreground flex min-h-screen items-center justify-center px-6 antialiased">
        <title>Kendala Sistem | Meris</title>
        <div className="glass-panel rounded-glass w-full max-w-xl border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 sm:p-10">
          <p className="font-mono text-sm font-medium tracking-[0.24em] uppercase opacity-40">
            Kendala Sistem
          </p>
          <h1 className="mt-4 font-serif text-2xl font-semibold tracking-tight">
            Halaman gagal dimuat.
          </h1>
          <p className="mt-3 font-sans text-sm leading-6 opacity-60">
            Peramban gagal memproses data halaman ini. Coba muat ulang halaman atau kembali ke beranda.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button 
              onClick={() => reset()}
              className="rounded-glass-sm bg-sage text-background cursor-pointer px-5 py-2.5 font-sans text-xs font-bold tracking-wider uppercase transition-all active:scale-[0.98]"
            >
              Muat Ulang Halaman
            </button>
            <Link 
              href="/"
              className="rounded-glass-sm text-foreground/80 flex cursor-pointer items-center justify-center border border-[var(--glass-border)] bg-[var(--glass-bg)] px-5 py-2.5 text-xs font-bold tracking-widest uppercase transition-all hover:bg-[var(--glass-highlight)] active:scale-95"
            >
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
