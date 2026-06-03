"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, Variants, AnimatePresence } from "framer-motion";
import imageCompression from "browser-image-compression";

interface RecentSession {
  id: string;
  payerName: string;
  grandTotal: number;
  joinedAt: number;
}

const words = ["moment", "dinner", "trip", "experience"];

export default function Home() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [payerName, setPayerName] = useState("");
  const [payerBankName, setPayerBankName] = useState("");
  const [payerBankAccount, setPayerBankAccount] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

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

  const handleJoinSession = () => {
    if (sessionId.trim()) {
      router.push(`/session/${sessionId.trim()}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setErrorMsg(null);
      if (!payerName.trim()) {
        setErrorMsg("Please enter your name first");
        e.target.value = "";
        return;
      }

      try {
        setIsUploading(true);
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);

        const formData = new FormData();
        formData.append("receipt", compressedFile);
        formData.append("payerName", payerName.trim());
        formData.append("payerBankName", payerBankName.trim());
        formData.append("payerBankAccount", payerBankAccount.trim());

        const response = await fetch("http://localhost:8080/session", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          localStorage.setItem("meris_username", payerName.trim());
          if (data.payerToken) {
            localStorage.setItem(
              `meris_session_${data.id}_participant`,
              JSON.stringify({
                id: data.payerId,
                name: payerName.trim(),
                token: data.payerToken,
              })
            );
          }
          router.push(`/session/${data.id}`);
        } else {
          const text = await response.text();
          console.error("Upload failed:", text);
          
          let friendlyMsg = "An unexpected error occurred while processing the receipt. Please try again.";
          if (text.includes("401") || text.includes("Invalid API Key") || text.includes("invalid_key")) {
            friendlyMsg = "The receipt scanning service is temporarily unavailable. Please try again later.";
          } else if (text.includes("AI extraction failed")) {
            friendlyMsg = "We couldn't parse the receipt details. Please make sure the photo is clear and contains readable items.";
          } else if (text.includes("Failed to save session")) {
            friendlyMsg = "We couldn't create the split bill session. Please try again later.";
          } else if (text.includes("Invalid receipt image") || text.includes("Failed to read image")) {
            friendlyMsg = "The uploaded file is not a valid image. Please choose another photo.";
          }
          
          setErrorMsg(friendlyMsg);
          setIsUploading(false);
        }
      } catch (error) {
        console.error("Error compressing/uploading image:", error);
        setErrorMsg("Unable to connect to the server. Please check your network connection and try again.");
        setIsUploading(false);
      }
    }
  };
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
          className="flex min-h-max flex-col justify-center gap-12 pt-10 pb-12 lg:sticky lg:top-0 lg:col-span-6 lg:min-h-screen lg:gap-16 lg:py-20"
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
          className="flex min-h-max flex-col justify-center pt-6 pb-12 lg:col-span-6 lg:pt-14 lg:pb-24"
        >
          <motion.div variants={itemVariants} className="mx-auto w-full max-w-lg lg:ml-auto">
            <div className="glass-panel rounded-glass group relative overflow-hidden p-8 sm:p-10">
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/1 to-transparent opacity-0 transition-opacity duration-1000 group-hover:opacity-100" />
              
              <div className="space-y-8">
                {/* Tab Selectors (Segmented Control style) */}
                <div className="rounded-glass-sm flex border border-white/5 bg-black/20 p-1 font-sans">
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className={`rounded-glass-sm flex-1 cursor-pointer py-2.5 text-center text-xs font-bold tracking-wider uppercase transition-all ${
                      activeTab === 'create'
                        ? "bg-sage/10 text-sage"
                        : "text-foreground/40 hover:text-foreground/60"
                    }`}
                  >
                    Create Session
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('join')}
                    className={`rounded-glass-sm flex-1 cursor-pointer py-2.5 text-center text-xs font-bold tracking-wider uppercase transition-all ${
                      activeTab === 'join'
                        ? "bg-sage/10 text-sage"
                        : "text-foreground/40 hover:text-foreground/60"
                    }`}
                  >
                    Join Session
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {activeTab === 'create' ? (
                    <motion.div
                      key="create"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div className="space-y-3">
                        <input 
                          type="text" 
                          value={payerName}
                          onChange={(e) => setPayerName(e.target.value)}
                          placeholder="Your Name (Payer)" 
                          className="rounded-glass-sm text-foreground placeholder:text-foreground/20 focus:border-sage/40 w-full border border-white/5 bg-white/2 px-4 py-3 font-sans text-sm transition-colors focus:outline-none"
                        />
                        <div className="grid grid-cols-[2.5fr_3.5fr] gap-3">
                          <input 
                            type="text" 
                            value={payerBankName}
                            onChange={(e) => setPayerBankName(e.target.value)}
                            placeholder="Bank (e.g., BCA)" 
                            className="rounded-glass-sm text-foreground placeholder:text-foreground/20 focus:border-sage/40 w-full border border-white/5 bg-white/2 px-4 py-3 font-sans text-sm transition-colors focus:outline-none"
                          />
                          <input 
                            type="text" 
                            value={payerBankAccount}
                            onChange={(e) => setPayerBankAccount(e.target.value)}
                            placeholder="Account No / Phone" 
                            className="rounded-glass-sm text-foreground placeholder:text-foreground/20 focus:border-sage/40 w-full border border-white/5 bg-white/2 px-4 py-3 font-sans text-sm transition-colors focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div 
                          className="group/upload relative cursor-pointer"
                          onClick={() => document.getElementById('receipt-upload')?.click()}
                        >
                          <input 
                            type="file" 
                            id="receipt-upload" 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                          />
                          <div className={`w-full border border-dashed ${isUploading ? 'border-sage/50 bg-sage/5' : 'group-hover/upload:border-sage/30 group-hover/upload:bg-sage/2 border-white/10 bg-white/1'} rounded-glass-sm flex flex-col items-center gap-3 p-8 transition-all duration-300`}>
                            <div className={`bg-sage/10 text-sage flex h-12 w-12 items-center justify-center rounded-full ${!isUploading && 'group-hover/upload:scale-105'} transition-transform duration-300`}>
                              {isUploading ? (
                                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                                </svg>
                              ) : (
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                              )}
                            </div>
                            <div className="text-center">
                              <p className="text-foreground font-sans text-sm font-medium">
                                {isUploading ? "Reading Receipt..." : "Upload Receipt Photo"}
                              </p>
                              <p className="text-foreground/20 mt-1 text-[9px] tracking-widest uppercase">AI Scan Engine</p>
                            </div>
                          </div>
                        </div>
                        
                        {errorMsg && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="rounded-glass-sm flex items-start gap-3 border border-rose-500/25 bg-rose-950/20 p-4 text-left font-sans text-sm text-rose-300"
                          >
                            <svg className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                              <p className="font-semibold text-rose-200">Unable to Start Session</p>
                              <p className="mt-1 text-xs leading-relaxed text-rose-300/80">{errorMsg}</p>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="join"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div className="flex flex-col gap-3">
                        <input 
                          type="text" 
                          value={sessionId}
                          onChange={(e) => setSessionId(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleJoinSession();
                          }}
                          placeholder="Enter Session ID" 
                          className="rounded-glass-sm text-foreground placeholder:text-foreground/20 focus:border-sage/40 w-full border border-white/5 bg-white/2 px-4 py-3 text-center font-sans text-sm tracking-wider uppercase transition-colors focus:outline-none"
                        />
                        <button 
                          onClick={handleJoinSession}
                          style={{ backgroundColor: '#8ba895' }}
                          className="rounded-glass-sm text-background w-full cursor-pointer py-3.5 font-sans text-xs font-bold tracking-wider uppercase transition-all hover:brightness-105 active:scale-[0.99]"
                        >
                          Join Session
                        </button>
                      </div>
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

      <footer className="bg-background/50 relative z-10 w-full border-t border-white/5 py-8 text-center backdrop-blur-xs">
        <p className="text-foreground/10 text-[9px] font-bold tracking-[0.4em] uppercase">
          Meris &copy; 2026
        </p>
      </footer>
    </div>
  );
}
