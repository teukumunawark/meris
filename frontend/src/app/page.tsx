"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
import imageCompression from "browser-image-compression";

interface RecentSession {
  id: string;
  payerName: string;
  grandTotal: number;
  joinedAt: number;
}

export default function Home() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [payerName, setPayerName] = useState("");
  const [payerBank, setPayerBank] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("meris_recent_sessions");
      if (stored) {
        try {
          const list = JSON.parse(stored) as RecentSession[];
          const now = Date.now();
          const valid = list.filter(s => now - s.joinedAt < 7 * 24 * 60 * 60 * 1000);
          setRecentSessions(valid);
          localStorage.setItem("meris_recent_sessions", JSON.stringify(valid));
        } catch (e) {}
      }
    }
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
        formData.append("payerBank", payerBank.trim());

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
    <div className="relative min-h-screen bg-background overflow-x-hidden font-sans">
      <div className="absolute top-[10%] left-[-5%] w-[50vw] h-[50vw] bg-orb-sage blur-[140px] rounded-full opacity-45 pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-5%] w-[45vw] h-[45vw] bg-orb-slate blur-[120px] rounded-full opacity-35 pointer-events-none" />

      <div className="min-h-screen w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:grid lg:grid-cols-12 lg:gap-16">
        
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="lg:col-span-6 py-12 lg:py-24 flex flex-col justify-between min-h-max lg:min-h-screen lg:sticky lg:top-0"
        >
          <div className="space-y-6 sm:space-y-10">
            <motion.div variants={itemVariants} className="text-left">
              <span className="inline-block px-4 py-1.5 rounded-glass-sm border border-sage/20 bg-sage/5 text-sage text-xs font-semibold tracking-widest uppercase">
                Meris Protocol
              </span>
            </motion.div>
            
            <motion.div variants={itemVariants} className="space-y-6">
              <h1 className="text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-serif text-foreground tracking-tight leading-[1.05] text-left">
                Share the <span className="font-sans font-light italic text-sage/80">moment,</span> <br />
                <span className="text-sage text-glow-sage">split the cost.</span>
              </h1>
              <p className="max-w-xl text-left text-base sm:text-lg text-foreground/50 font-sans leading-relaxed">
                A calm, intuitive platform for proportional expense sharing. 
                Upload your receipt and let our AI handle the nuances.
              </p>
            </motion.div>
          </div>

          <motion.div 
            variants={itemVariants}
            className="mt-16 lg:mt-auto border-t border-white/5 pt-10 text-left space-y-6 max-w-xl"
          >
            <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-foreground/30">Philosophy</h2>
            <div className="relative pl-6">
              <div className="absolute top-0 left-0 w-0.5 h-full bg-gradient-to-b from-sage to-transparent opacity-60" />
              <p className="font-serif italic text-base sm:text-lg text-foreground/40 leading-relaxed">
                &ldquo;Derived from the Ancient Greek word &mu;&tilde;&epsilon;&rho;&iota;&sigmaf; (M&eacute;ris), meaning &apos;portion&apos;. We believe that shared experiences shouldn&apos;t be burdened by the friction of math. Meris ensures every share is accounted for with absolute fairness.&rdquo;
              </p>
            </div>
          </motion.div>
        </motion.div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="lg:col-span-6 py-12 lg:py-24 flex flex-col justify-center min-h-max"
        >
          <motion.div variants={itemVariants} className="w-full max-w-lg mx-auto lg:ml-auto">
            <div className="glass-panel p-8 sm:p-10 rounded-glass relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
              
              <div className="space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-sage" />
                    <h2 className="text-lg font-serif text-foreground font-medium uppercase tracking-wider text-xs">Create New Session</h2>
                  </div>
                  
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      placeholder="Your Name (Payer)" 
                      className="w-full px-4 py-3 rounded-glass-sm bg-white/[0.02] border border-white/5 text-foreground text-sm placeholder:text-foreground/20 focus:outline-none focus:border-sage/40 transition-colors font-sans"
                    />
                    <input 
                      type="text" 
                      value={payerBank}
                      onChange={(e) => setPayerBank(e.target.value)}
                      placeholder="Payment Info (e.g., BCA 1234567890)" 
                      className="w-full px-4 py-3 rounded-glass-sm bg-white/[0.02] border border-white/5 text-foreground text-sm placeholder:text-foreground/20 focus:outline-none focus:border-sage/40 transition-colors font-sans"
                    />
                  </div>

                  <div className="flex flex-col gap-4">
                    <div 
                      className="relative group/upload cursor-pointer"
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
                      <div className={`w-full border border-dashed ${isUploading ? 'border-sage/50 bg-sage/5' : 'border-white/10 bg-white/[0.01] group-hover/upload:border-sage/30 group-hover/upload:bg-sage/[0.02]'} rounded-glass-sm p-8 transition-all duration-300 flex flex-col items-center gap-3`}>
                        <div className={`w-12 h-12 rounded-full bg-sage/10 flex items-center justify-center text-sage ${!isUploading && 'group-hover/upload:scale-105'} transition-transform duration-300`}>
                          {isUploading ? (
                            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="2" x2="12" y2="6" />
                              <line x1="12" y1="18" x2="12" y2="22" />
                              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                              <line x1="2" y1="12" x2="6" y2="12" />
                              <line x1="18" y1="12" x2="22" y2="12" />
                              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-foreground text-sm font-sans font-medium">
                            {isUploading ? "Reading Receipt..." : "Upload Receipt Photo"}
                          </p>
                          <p className="text-foreground/20 text-[9px] uppercase tracking-widest mt-1">AI Scan Engine</p>
                        </div>
                      </div>
                    </div>
                    
                    {errorMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="p-4 rounded-glass-sm bg-rose-950/20 border border-rose-500/25 text-rose-300 text-sm font-sans flex items-start gap-3 text-left"
                      >
                        <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <p className="font-semibold text-rose-200">Unable to Start Session</p>
                          <p className="text-rose-300/80 text-xs mt-1 leading-relaxed">{errorMsg}</p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 py-2">
                  <div className="h-px flex-1 bg-white/5" />
                  <span className="text-[9px] font-bold text-foreground/15 uppercase tracking-[0.25em]">OR</span>
                  <div className="h-px flex-1 bg-white/5" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-muted" />
                    <h2 className="text-lg font-serif text-foreground font-medium uppercase tracking-wider text-xs">Join Existing Session</h2>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <input 
                      type="text" 
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleJoinSession();
                      }}
                      placeholder="Enter Session ID" 
                      className="w-full px-4 py-3 rounded-glass-sm bg-white/[0.02] border border-white/5 text-foreground text-sm placeholder:text-foreground/20 focus:outline-none focus:border-sage/40 transition-colors font-sans text-center uppercase tracking-wider"
                    />
                    <button 
                      onClick={handleJoinSession}
                      style={{ backgroundColor: '#8ba895' }}
                      className="w-full py-3.5 rounded-glass-sm text-background font-bold text-xs uppercase tracking-wider hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer font-sans"
                    >
                      Join Session
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {recentSessions.length > 0 && (
              <div className="glass-panel p-6 sm:p-8 rounded-glass mt-6 text-left">
                <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-foreground/30 mb-4">Recent Sessions</h3>
                <ul className="space-y-3">
                  {recentSessions.map((session) => (
                    <li key={session.id} className="flex justify-between items-center py-2 border-b border-white/5">
                      <div className="flex flex-col">
                        <Link href={`/session/${session.id}`} className="font-mono text-xs text-sage hover:underline">
                          {session.id}
                        </Link>
                        <span className="text-[10px] text-foreground/40 font-sans">Payer: {session.payerName || "Anonymous"}</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-foreground/60">
                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(session.grandTotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="mt-8 text-center lg:text-right">
              <p className="text-[9px] text-foreground/15 uppercase tracking-widest font-bold">
                Meris Protocol // Simplicity in every byte
              </p>
            </div>
          </motion.div>
        </motion.div>

      </div>

      <footer className="w-full py-8 border-t border-white/5 text-center relative z-10 bg-background/50 backdrop-blur-xs">
        <p className="text-[9px] text-foreground/10 uppercase tracking-[0.4em] font-bold">
          Meris &copy; 2026
        </p>
      </footer>
    </div>
  );
}
