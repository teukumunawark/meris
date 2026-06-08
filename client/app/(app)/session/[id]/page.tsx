"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { SessionProvider, useSession } from "@/entities/session/model/SessionContext";
import { ThemeToggle } from "@/features/theme-toggle";
import ClaimBoard from "@/widgets/claim-board/ui/ClaimBoard";
import BillSummary from "@/widgets/bill-summary/ui/BillSummary";
import { formatRupiah } from "@/shared/lib";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClaimSessionPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.id;

  return (
    <SessionProvider sessionId={sessionId}>
      <SessionPageContent sessionId={sessionId} />
    </SessionProvider>
  );
}

function SessionPageContent({ sessionId }: { sessionId: string }) {
  const { isJoined, participants, userName } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const currentUserTotal = React.useMemo(() => {
    if (!isJoined || !userName) return 0;
    const match = participants.find(p => p.name.trim() === userName.trim());
    return match?.totalOwed || 0;
  }, [isJoined, userName, participants]);

  if (!mounted) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div 
          style={{ borderTopColor: "#8ba895" }}
          className="border-sage/10 h-12 w-12 animate-spin rounded-full border-4" 
        />
      </div>
    );
  }

  return (
    <div className={`bg-background text-foreground relative min-h-screen overflow-x-hidden font-sans antialiased ${isJoined ? "pb-24 lg:pb-6" : "pb-6"}`}>
      {/* Background Ambience */}
      <div className="bg-orb-sage pointer-events-none fixed top-[-10%] right-[-10%] h-[60%] w-[60%] rounded-full opacity-20 blur-[120px]" />
      <div className="bg-orb-slate pointer-events-none fixed bottom-[-10%] left-[-10%] h-[60%] w-[60%] rounded-full opacity-10 blur-[120px]" />

      {/* Navbar */}
      <header className="bg-background/80 sticky top-0 z-50 w-full border-b border-[var(--glass-border)] backdrop-blur-xl">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-10">
          <div className="flex items-center md:hidden">
            <Link
              href="/"
              className="text-foreground/75 hover:text-foreground flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] p-2 transition-all duration-300 hover:bg-[var(--glass-highlight)] active:scale-95"
              title="Back to Home"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 19-7-7 7-7"/>
                <path d="M19 12H5"/>
              </svg>
            </Link>
          </div>

          <Link href="/" className="group absolute left-1/2 flex -translate-x-1/2 cursor-pointer items-center select-none md:hidden">
            <span className="text-foreground group-hover:text-sage font-sans text-base font-semibold tracking-[0.2em] uppercase transition-all duration-300">
              Meris
            </span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <Link href="/" className="group flex cursor-pointer items-center gap-3 select-none">
              <div 
                className="rounded-glass-sm bg-sage text-background flex h-9 w-9 shrink-0 items-center justify-center font-mono text-base font-bold transition-all duration-300 group-hover:scale-105"
              >
                M
              </div>
              <span className="text-foreground group-hover:text-sage font-sans text-lg font-medium tracking-tight uppercase transition-all duration-300">
                Meris
              </span>
            </Link>

            <div className="h-4 w-px bg-[var(--glass-border)]" />

            <nav className="text-foreground/35 flex items-center gap-2 font-mono text-[10px] font-bold tracking-wider" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-foreground transition-colors">HOME</Link>
              <svg className="text-foreground/15 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
              <span className="text-sage font-sans font-medium tracking-normal uppercase">Session</span>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-4 pb-4 sm:gap-12 sm:px-10 sm:pt-8 sm:pb-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-8">
            <ClaimBoard />
          </div>

          <div className="lg:col-span-4">
            <BillSummary />
          </div>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="mt-8 sm:mt-12 border-t border-[var(--glass-border)] py-3 sm:py-6 opacity-40">
        <div className="text-foreground/40 mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 text-[10px] font-bold tracking-[0.3em] uppercase sm:flex-row">
          <p>Meris &copy; 2026</p>
          <p className="font-mono tracking-normal uppercase opacity-50">Session: {sessionId}</p>
        </div>
      </footer>

      {isJoined && (
        <div className="bg-background/80 fixed right-0 bottom-0 left-0 z-40 flex items-center justify-between border-t border-[var(--glass-border)] p-4 shadow-2xl backdrop-blur-xl lg:hidden">
          <div className="flex flex-col text-left">
            <span className="text-foreground/30 font-mono text-[10px] font-bold tracking-[0.2em] uppercase">Your Share</span>
            <span className="text-sage text-glow-sage text-xl font-bold">{formatRupiah(currentUserTotal)}</span>
          </div>
          <button
            onClick={() => {
              const breakdownEl = document.getElementById("bill-summary");
              breakdownEl?.scrollIntoView({ behavior: "smooth" });
            }}
            className="rounded-glass-sm bg-sage text-background cursor-pointer px-5 py-2.5 font-sans text-xs font-bold tracking-wider uppercase transition-all active:scale-[0.98]"
          >
            View Details
          </button>
        </div>
      )}
    </div>
  );
}
