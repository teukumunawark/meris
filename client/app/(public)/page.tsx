"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CreateSessionForm } from "@/features/create-session";
import { JoinSessionForm } from "@/features/join-session";
import { ThemeToggle } from "@/features/theme-toggle";
import { formatRupiah } from "@/shared/lib";
import { GlassPanel } from "@/shared/ui/GlassPanel";

interface RecentSession {
  id: string;
  payerName: string;
  grandTotal: number;
  joinedAt: number;
}

export default function LandingPage() {
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
    <div className="bg-background text-foreground relative min-h-screen overflow-hidden font-sans antialiased">
      {/* Decorative Orbs */}
      <div className="bg-orb-sage pointer-events-none fixed top-[-15%] right-[-10%] h-[70%] w-[70%] rounded-full opacity-20 blur-[140px]" />
      <div className="bg-orb-slate pointer-events-none fixed bottom-[-10%] left-[-10%] h-[60%] w-[60%] rounded-full opacity-15 blur-[120px]" />

      {/* Top Header Row for ThemeToggle */}
      <header className="relative z-20 mx-auto flex max-w-7xl justify-end px-6 pt-6 sm:px-10">
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 pt-8 pb-24 sm:px-10 sm:pt-12">
        <div className="grid grid-cols-1 items-start gap-16 lg:grid-cols-12 lg:gap-24">

          {/* Left Side: Branding and Context */}
          <div className="space-y-10 lg:col-span-6 lg:pt-10">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div
                  className="rounded-glass-sm bg-sage text-background flex h-10 w-10 items-center justify-center font-mono text-lg font-bold"
                >
                  M
                </div>
                <span className="text-foreground font-sans text-xl font-medium tracking-[0.2em] uppercase">Meris</span>
              </div>

              <h1 className="text-foreground font-serif text-5xl leading-[1.1] tracking-tight sm:text-7xl lg:text-8xl">
                Elegance in <br />
                <span className="text-sage font-sans font-light italic">Sharing.</span>
              </h1>

              <p className="text-foreground/45 max-w-md font-sans text-lg leading-relaxed font-light tracking-wide sm:text-xl">
                A minimal, zero-account split billing experience powered by AI and aesthetic precision.
              </p>
            </div>

            {recentSessions.length > 0 && (
              <div className="space-y-6 pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-px w-8 bg-[var(--glass-border)]" />
                  <h3 className="text-foreground/25 font-mono text-[10px] font-bold tracking-[0.3em] uppercase">Recent Sessions</h3>
                </div>
                <div className="flex flex-col gap-3">
                  {recentSessions.map((session) => (
                    <Link
                      key={session.id}
                      href={`/session/${session.id}`}
                      className="glass-panel group rounded-glass-sm hover:border-sage/30 flex items-center justify-between border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 transition-all duration-500 hover:bg-[var(--glass-highlight)]"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-foreground/70 group-hover:text-foreground font-sans text-sm font-medium transition-colors">
                          {session.payerName}&apos;s Bill
                        </span>
                        <span className="text-foreground/25 font-mono text-[10px] uppercase">
                          ID: {session.id}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sage text-glow-sage block font-sans text-sm font-bold">
                          {formatRupiah(session.grandTotal)}
                        </span>
                        <span className="text-foreground/20 font-mono text-[9px] uppercase">
                          {new Date(session.joinedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Action Panel */}
          <div className="lg:col-span-6">
            <GlassPanel className="p-8 sm:p-12">
              <div className="mb-10 flex gap-8 border-b border-[var(--glass-border)] pb-2">
                <button
                  onClick={() => setActiveTab("create")}
                  className={`relative pb-4 font-sans text-xs font-bold tracking-[0.2em] uppercase transition-all duration-300 ${
                    activeTab === "create" ? "text-sage" : "text-foreground/25 hover:text-foreground/50"
                  }`}
                >
                  Create
                  {activeTab === "create" && (
                    <div className="bg-sage absolute bottom-[-1px] left-0 h-0.5 w-full shadow-[0_0_10px_rgba(139,168,149,0.5)]" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("join")}
                  className={`relative pb-4 font-sans text-xs font-bold tracking-[0.2em] uppercase transition-all duration-300 ${
                    activeTab === "join" ? "text-sage" : "text-foreground/25 hover:text-foreground/50"
                  }`}
                >
                  Join
                  {activeTab === "join" && (
                    <div className="bg-sage absolute bottom-[-1px] left-0 h-0.5 w-full shadow-[0_0_10px_rgba(139,168,149,0.5)]" />
                  )}
                </button>
              </div>

              <div className="min-h-[320px]">
                {activeTab === "create" ? (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
                    <CreateSessionForm />
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
                    <JoinSessionForm />
                  </div>
                )}
              </div>

              <div className="mt-12 border-t border-[var(--glass-border)] pt-8 text-center">
                <p className="text-foreground/20 font-sans text-[10px] leading-relaxed font-light tracking-[0.15em] uppercase">
                  No accounts. No passwords. <br />
                  Just upload, claim, and settle.
                </p>
              </div>
            </GlassPanel>
          </div>

        </div>
      </main>

      <footer className="relative z-10 border-t border-[var(--glass-border)] py-10 opacity-30">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-10 text-[10px] font-bold tracking-[0.3em] uppercase sm:flex-row">
          <p>Meris Studio &copy; 2026</p>
          <div className="flex gap-6">
            <span className="hover:text-sage cursor-help transition-colors">Privacy</span>
            <span className="hover:text-sage cursor-help transition-colors">Github</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
