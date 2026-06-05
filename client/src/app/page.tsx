"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, Variants, AnimatePresence } from "framer-motion";
import CreateSessionForm from "@/features/create-session/ui/CreateSessionForm";
import JoinSessionForm from "@/features/join-session/ui/JoinSessionForm";

interface RecentSession {
  id: string;
  payerName: string;
  grandTotal: number;
  joinedAt: number;
}

const words = ["moment", "dinner", "trip", "experience"];

export default function Home() {
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("meris_recent_sessions");
      if (stored) {
        try {
          const list = JSON.parse(stored) as RecentSession[];
          const now = Date.now();
          const valid = list.filter(s => now - s.joinedAt < 7 * 24 * 60 * 60 * 1000);
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setRecentSessions(valid);
          localStorage.setItem("meris_recent_sessions", JSON.stringify(valid));
        } catch {}
      }
    }
  }, []);

  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1, ease: [0.19, 1, 0.22, 1] },
    },
  };

  return (
    <div className="bg-background relative min-h-screen overflow-x-hidden font-sans">
      <div className="bg-orb-sage pointer-events-none absolute top-[10%] left-[-5%] h-[50vw] w-[50vw] rounded-full opacity-45 blur-[140px]" />
      <div className="bg-orb-slate pointer-events-none absolute right-[-5%] bottom-[10%] h-[45vw] w-[45vw] rounded-full opacity-35 blur-[120px]" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 lg:grid lg:grid-cols-12 lg:gap-16 lg:px-12">
        
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex min-h-max flex-col justify-center gap-12 pt-10 pb-6 lg:sticky lg:top-0 lg:col-span-6 lg:min-h-screen lg:gap-16 lg:py-12"
        >
          <div className="space-y-6">
            <motion.div variants={itemVariants} className="space-y-6">
              <h1 className="text-foreground text-left font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl">
                Share the{" "}
                <span className="relative inline-block h-[1.1em] min-w-[4.5ch] align-bottom">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={words[wordIndex]}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="text-sage/80 absolute bottom-0 left-0 font-sans font-light italic"
                    >
                      {words[wordIndex]},
                    </motion.span>
                  </AnimatePresence>
                </span>{" "}
                <br />
                <span className="text-sage text-glow-sage">split the cost.</span>
              </h1>
              <p className="text-foreground/50 max-w-xl text-left font-sans text-base leading-relaxed sm:text-lg">
                A calm, intuitive platform for proportional expense sharing. 
                Upload your receipt and let our AI handle the nuances.
              </p>
            </motion.div>
          </div>

          <motion.div 
            variants={itemVariants}
            className="hidden max-w-xl space-y-4 border-t border-white/5 pt-8 text-left lg:block"
          >
            <h2 className="text-foreground/30 font-sans text-xs font-bold tracking-[0.2em] uppercase">Philosophy</h2>
            <div className="relative pl-6">
              <div className="from-sage absolute top-0 left-0 h-full w-0.5 bg-linear-to-b to-transparent opacity-60" />
              <p className="text-foreground/40 font-serif text-base leading-relaxed italic sm:text-lg">
                &ldquo;Derived from the Ancient Greek word &mu;&tilde;&epsilon;&rho;&iota;&sigmaf; (M&eacute;ris), meaning &apos;portion&apos;. We believe that shared experiences shouldn&apos;t be burdened by the friction of math. Meris ensures every share is accounted for with absolute fairness.&rdquo;
              </p>
            </div>
          </motion.div>
        </motion.div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex min-h-max flex-col justify-center pt-6 pb-6 lg:col-span-6 lg:pt-14 lg:pb-12"
        >
          <motion.div variants={itemVariants} className="mx-auto w-full max-w-lg lg:ml-auto">
            <div className="glass-panel rounded-glass group relative overflow-hidden p-8 sm:p-10">
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/1 to-transparent opacity-0 transition-opacity duration-1000 group-hover:opacity-100" />
              
              <div className="space-y-8">
                {/* Tab Selectors (Segmented Control style) */}
                <div className="rounded-glass-sm flex border border-white/5 bg-black/20 p-1 font-sans">
                  <button
                    type="button"
                    onClick={() => setActiveTab("create")}
                    className={`rounded-glass-sm flex-1 cursor-pointer py-2.5 text-center text-xs font-bold tracking-wider uppercase transition-all ${
                      activeTab === "create"
                        ? "bg-sage/10 text-sage"
                        : "text-foreground/40 hover:text-foreground/60"
                    }`}
                  >
                    Create Session
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("join")}
                    className={`rounded-glass-sm flex-1 cursor-pointer py-2.5 text-center text-xs font-bold tracking-wider uppercase transition-all ${
                      activeTab === "join"
                        ? "bg-sage/10 text-sage"
                        : "text-foreground/40 hover:text-foreground/60"
                    }`}
                  >
                    Join Session
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {activeTab === "create" ? (
                    <motion.div
                      key="create"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CreateSessionForm />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="join"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <JoinSessionForm />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {recentSessions.length > 0 && (
              <div className="glass-panel rounded-glass mt-6 p-6 text-left sm:p-8">
                <h3 className="text-foreground/30 mb-4 font-sans text-xs font-bold tracking-[0.2em] uppercase">Recent Sessions</h3>
                <ul className="space-y-3">
                  {recentSessions.map((session) => (
                    <li key={session.id} className="flex items-center justify-between gap-4 border-b border-white/5 py-2">
                      <div className="flex min-w-0 flex-col">
                        <Link 
                          href={`/session/${session.id}`} 
                          className="text-sage block truncate font-mono text-xs hover:underline"
                          title={session.id}
                        >
                          {session.id}
                        </Link>
                        <span className="text-foreground/40 truncate font-sans text-[10px]">Payer: {session.payerName || "Anonymous"}</span>
                      </div>
                      <span className="text-foreground/60 shrink-0 font-mono text-xs font-bold">
                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(session.grandTotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="mt-8 text-center lg:text-right">
              <p className="text-foreground/15 text-[9px] font-bold tracking-widest uppercase">
                Meris // Simplicity in every byte
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Mobile Philosophy Section */}
        <div className="mx-auto mt-6 mb-12 w-full max-w-lg space-y-6 border-t border-white/5 px-6 pt-10 text-left lg:hidden">
          <h2 className="text-foreground/30 font-sans text-xs font-bold tracking-[0.2em] uppercase">Philosophy</h2>
          <div className="relative pl-6">
            <div className="from-sage absolute top-0 left-0 h-full w-0.5 bg-linear-to-b to-transparent opacity-60" />
            <p className="text-foreground/40 font-serif text-base leading-relaxed italic">
              &ldquo;Derived from the Ancient Greek word &mu;&tilde;&epsilon;&rho;&iota;&sigmaf; (M&eacute;ris), meaning &apos;portion&apos;. We believe that shared experiences shouldn&apos;t be burdened by the friction of math. Meris ensures every share is accounted for with absolute fairness.&rdquo;
            </p>
          </div>
        </div>

      </div>

      <footer className="bg-background/50 relative z-10 w-full border-t border-white/5 py-3 sm:py-5 text-center backdrop-blur-xs">
        <p className="text-foreground/10 text-[9px] font-bold tracking-[0.4em] uppercase">
          Meris &copy; 2026
        </p>
      </footer>
    </div>
  );
}
