"use client";

import React, { use, useState, useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionProvider, useSession } from "@/entities/session/model/SessionContext";
import { ThemeToggle } from "@/features/theme-toggle";
import { LanguageToggle } from "@/features/language-toggle";
import { useI18n } from "@/shared/i18n";
import ClaimBoard from "@/widgets/claim-board/ui/ClaimBoard";
import BillSummary from "@/widgets/bill-summary/ui/BillSummary";
import { formatRupiah } from "@/shared/lib";
import { useMounted } from "@/shared/hooks";
import { ErrorScreen } from "@/shared/ui/ErrorScreen";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClaimSessionPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.id;

  return (
    <SessionProvider key={sessionId} sessionId={sessionId}>
      <SessionPageContent />
    </SessionProvider>
  );
}

function SessionPageContent() {
  const { loadState, retryLoad, isJoined, participants, participantId } = useSession();
  const mounted = useMounted();
  const { m } = useI18n();
  const [mobileTab, setMobileTab] = useState<"claims" | "settlement">("claims");

  const currentUserTotal = useMemo(() => {
    if (!isJoined || participantId === null) return 0;
    const match = participants.find(p => p.id === participantId);
    return match?.totalOwed || 0;
  }, [isJoined, participantId, participants]);

  if (loadState === "notFound") {
    notFound();
  }

  if (!mounted || loadState === "loading") {
    return (
      <div role="status" className="bg-background flex min-h-screen items-center justify-center">
        <div 
          style={{ borderTopColor: "#8ba895" }}
          className="border-sage/10 h-12 w-12 animate-spin rounded-full border-4"
          aria-hidden="true"
        />
        <span className="sr-only">{m.sessionPage.loading}</span>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <ErrorScreen
        title={m.sessionPage.loadErrorTitle}
        body={m.sessionPage.loadErrorBody}
        retryLabel={m.common.retry}
        onRetry={retryLoad}
        homeLabel={m.common.backHome}
      />
    );
  }

  const handleSwitchTab = (tab: "claims" | "settlement") => {
    setMobileTab(tab);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className={`bg-background text-foreground relative min-h-screen overflow-x-hidden font-sans antialiased ${isJoined ? "pb-24 lg:pb-6" : "pb-6"}`}>
      <div className="bg-orb-sage pointer-events-none fixed top-[-10%] right-[-10%] h-[60%] w-[60%] rounded-full opacity-20 blur-[120px]" />
      <div className="bg-orb-slate pointer-events-none fixed bottom-[-10%] left-[-10%] h-[60%] w-[60%] rounded-full opacity-10 blur-[120px]" />

      <header className="bg-background/80 sticky top-0 z-50 w-full border-b border-[var(--glass-border)] backdrop-blur-xl">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-10">
          <div className="flex items-center md:hidden">
            <Link
              href="/"
              className="text-foreground/75 hover:text-foreground flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] p-2 transition-all duration-300 hover:bg-[var(--glass-highlight)] active:scale-95"
              title={m.common.backHome}
              aria-label={m.common.backHome}
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

            <nav className="text-foreground/35 flex items-center gap-2 font-mono text-[10px] font-bold tracking-wider" aria-label={m.sessionPage.breadcrumbLabel}>
              <Link href="/" className="hover:text-foreground transition-colors">{m.sessionPage.breadcrumbHome}</Link>
              <svg className="text-foreground/15 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
              <span className="text-sage font-sans font-medium tracking-normal uppercase">{m.sessionPage.breadcrumbSession}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="bg-background/90 sticky top-16 z-30 border-b border-[var(--glass-border)] px-4 py-2 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-md gap-1 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] p-1">
          <button
            type="button"
            onClick={() => handleSwitchTab("claims")}
            className={`min-h-[38px] flex-1 cursor-pointer rounded-full font-sans text-xs font-semibold transition-all duration-300 ${
              mobileTab === "claims"
                ? "bg-sage text-background shadow-xs"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {m.sessionPage.tabClaims}
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab("settlement")}
            className={`min-h-[38px] flex-1 cursor-pointer rounded-full font-sans text-xs font-semibold transition-all duration-300 ${
              mobileTab === "settlement"
                ? "bg-sage text-background shadow-xs"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {m.sessionPage.tabPayments}
          </button>
        </div>
      </div>

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-3 pb-4 sm:gap-10 sm:px-10 sm:pt-8 sm:pb-8">
        <div className="hidden items-start lg:grid lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-8">
            <ClaimBoard />
          </div>
          <div className="lg:col-span-4">
            <BillSummary />
          </div>
        </div>

        <div className="block lg:hidden">
          {mobileTab === "claims" ? (
            <div className="animate-in fade-in duration-300">
              <ClaimBoard />
            </div>
          ) : (
            <div className="animate-in fade-in duration-300">
              <BillSummary />
            </div>
          )}
        </div>
      </main>

      {isJoined && (
        <div className="bg-background/90 fixed right-0 bottom-0 left-0 z-40 flex items-center justify-between border-t border-[var(--glass-border)] px-5 py-3 shadow-2xl backdrop-blur-xl lg:hidden">
          <div className="flex flex-col text-left">
            <span className="text-foreground/50 text-[10px] font-medium tracking-wide">{m.sessionPage.yourTotal}</span>
            <span className="text-sage text-glow-sage text-lg font-bold sm:text-xl">{formatRupiah(currentUserTotal)}</span>
          </div>

          {mobileTab === "claims" ? (
            <button
              onClick={() => handleSwitchTab("settlement")}
              className="bg-sage text-background flex cursor-pointer items-center gap-1.5 rounded-full px-5 py-2.5 font-sans text-xs font-bold tracking-wider uppercase shadow-md transition-all active:scale-[0.98]"
            >
              <span>{m.sessionPage.tabPayments}</span>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={() => handleSwitchTab("claims")}
              className="text-foreground flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-5 py-2.5 font-sans text-xs font-bold tracking-wider uppercase transition-all hover:bg-[var(--glass-highlight)] active:scale-[0.98]"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              <span>{m.sessionPage.tabClaims}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
