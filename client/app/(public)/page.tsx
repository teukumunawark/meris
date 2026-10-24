"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CreateSessionForm } from "@/features/create-session";
import { JoinSessionForm } from "@/features/join-session";
import { ThemeToggle } from "@/features/theme-toggle";
import { LanguageToggle } from "@/features/language-toggle";
import { intlLocale, useI18n } from "@/shared/i18n";
import { formatRupiah } from "@/shared/lib";
import { GlassPanel } from "@/shared/ui/GlassPanel";

interface RecentSession {
  id: string;
  payerName: string;
  grandTotal: number;
  joinedAt: number;
}

function RecentSessionsList({ sessions }: { sessions: RecentSession[] }) {
  const { locale, m } = useI18n();
  if (sessions.length === 0) return null;

  return (
    <div className="space-y-3 pt-2 sm:space-y-4 sm:pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground/60 font-sans text-xs font-semibold">
          {m.landing.recentTitle}
        </h3>
        <span className="text-foreground/40 font-mono text-[11px]">
          {m.landing.recentCount(sessions.length)}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {sessions.map((session) => (
          <Link
            key={session.id}
            href={`/session/${session.id}`}
            className="group hover:border-sage/40 flex items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3.5 transition-all duration-300 hover:bg-[var(--glass-highlight)] active:scale-[0.99]"
          >
            <div className="flex min-w-0 flex-col gap-0.5 pr-3">
              <span className="text-foreground group-hover:text-sage truncate font-sans text-xs font-semibold transition-colors sm:text-sm">
                {session.payerName ? m.landing.recentBillOf(session.payerName) : m.landing.sharedBill}
              </span>
              <span className="text-foreground/40 font-sans text-[11px]">
                {new Date(session.joinedAt).toLocaleDateString(intlLocale(locale), {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                })}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sage font-mono text-xs font-bold sm:text-sm">
                {formatRupiah(session.grandTotal)}
              </span>
              <svg className="text-foreground/30 group-hover:text-sage h-4 w-4 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { m } = useI18n();
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("meris_recent_sessions");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSessions(parsed.slice(0, 5));
        }
      } catch (err) {
        console.error("Failed to parse recent sessions:", err);
      }
    }
  }, []);

  return (
    <div className="bg-background text-foreground relative flex min-h-screen flex-col overflow-x-hidden font-sans antialiased">
      <div className="bg-orb-sage pointer-events-none fixed top-[-15%] right-[-10%] h-[70%] w-[70%] rounded-full opacity-20 blur-[140px]" />
      <div className="bg-orb-slate pointer-events-none fixed bottom-[-10%] left-[-10%] h-[60%] w-[60%] rounded-full opacity-15 blur-[120px]" />

      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 pt-4 sm:px-8 sm:pt-6">
        <div className="flex items-center gap-2.5">
          <div className="rounded-glass-sm bg-sage text-background flex h-8 w-8 items-center justify-center font-mono text-sm font-bold shadow-xs sm:h-9 sm:w-9 sm:text-base">
            M
          </div>
          <span className="text-foreground font-sans text-base font-semibold tracking-[0.2em] uppercase sm:text-lg">
            Meris
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pt-6 pb-16 sm:px-8 sm:pt-10 sm:pb-24 lg:justify-center lg:py-12">
        <div className="grid grid-cols-1 items-start gap-8 sm:gap-12 lg:grid-cols-12 lg:gap-16 xl:gap-24">

          <div className="space-y-6 lg:col-span-6 lg:space-y-10 lg:pt-8">
            <div className="space-y-3 sm:space-y-5">
              <h1 className="text-foreground font-serif text-3xl leading-[1.15] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                {m.landing.headlineLead} <br />
                <span className="text-sage font-sans font-light italic">{m.landing.headlineAccent}</span>
              </h1>

              <p className="text-foreground/60 max-w-md font-sans text-sm leading-relaxed sm:text-base lg:text-lg">
                {m.landing.intro}
              </p>
            </div>

            <div className="hidden lg:block">
              <RecentSessionsList sessions={recentSessions} />
            </div>
          </div>

          <div className="space-y-6 lg:col-span-6">
            <GlassPanel className="p-4 sm:p-7 md:p-10">
              <div 
                className="mb-6 flex gap-1 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] p-1 sm:mb-8"
                role="tablist"
                aria-label={m.landing.tabsLabel}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "create"}
                  onClick={() => setActiveTab("create")}
                  className={`min-h-[44px] flex-1 cursor-pointer rounded-full py-2.5 font-sans text-xs font-semibold transition-all duration-300 active:scale-[0.98] sm:py-3 ${
                    activeTab === "create"
                      ? "bg-sage text-background shadow-xs"
                      : "text-foreground/60 hover:text-foreground"
                  }`}
                >
                  {m.landing.tabCreate}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "join"}
                  onClick={() => setActiveTab("join")}
                  className={`min-h-[44px] flex-1 cursor-pointer rounded-full py-2.5 font-sans text-xs font-semibold transition-all duration-300 active:scale-[0.98] sm:py-3 ${
                    activeTab === "join"
                      ? "bg-sage text-background shadow-xs"
                      : "text-foreground/60 hover:text-foreground"
                  }`}
                >
                  {m.landing.tabJoin}
                </button>
              </div>

              <div className="min-h-[260px]">
                {activeTab === "create" ? (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CreateSessionForm />
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <JoinSessionForm />
                  </div>
                )}
              </div>
            </GlassPanel>

            <div className="block lg:hidden">
              <RecentSessionsList sessions={recentSessions} />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
