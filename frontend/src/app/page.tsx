"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, Variants } from "framer-motion";

export default function Home() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");

  const handleJoinSession = () => {
    if (sessionId.trim()) {
      router.push(`/session/${sessionId.trim()}`);
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
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background px-4 sm:px-6 py-12">
      {/* Muted Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-orb-sage blur-[120px] rounded-full opacity-40 pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-orb-slate blur-[120px] rounded-full opacity-30 pointer-events-none" />
      
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-5xl text-center flex flex-col items-center"
      >
        <motion.div variants={itemVariants} className="mb-8 sm:mb-16">
          <span className="inline-block px-4 py-1.5 sm:px-6 sm:py-2 rounded-glass-sm border border-sage/20 bg-sage/5 text-sage text-xs sm:text-sm font-semibold tracking-[0.1em] sm:tracking-widest mb-6 sm:mb-10">
            A Better Way to Share
          </span>
          <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-serif text-foreground tracking-tight leading-tight sm:leading-[0.85] mb-6 sm:mb-12">
            Share the <span className="font-sans font-light">moment,</span> <br />
            <span className="text-sage text-glow-sage">split the cost.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-foreground/50 font-sans leading-relaxed px-4">
            A calm and intuitive tool for proportional expense sharing. 
            Upload your receipt and let our AI handle the nuances.
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="flex flex-col items-center gap-6 sm:gap-10 w-full">
          <div className="glass-panel p-6 sm:p-10 md:p-16 rounded-glass w-full max-w-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
            
            <div className="flex flex-col items-center gap-10">
              <div className="w-full">
                <h2 className="text-2xl sm:text-3xl font-serif text-foreground mb-6 sm:mb-8 text-center">Start a Session</h2>
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
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // TODO: Implement actual upload logic
                          console.log("File selected:", file.name);
                        }
                      }}
                    />
                    <div className="w-full border-2 border-dashed border-white/5 group-hover/upload:border-sage/30 bg-white/[0.02] group-hover/upload:bg-sage/[0.03] rounded-glass-sm p-8 sm:p-12 transition-all duration-500 flex flex-col items-center gap-4">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-sage/10 flex items-center justify-center text-sage group-hover/upload:scale-110 transition-transform duration-500">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-foreground text-sm sm:text-base font-sans font-medium">Upload Receipt Photo</p>
                        <p className="text-foreground/30 text-[10px] sm:text-xs uppercase tracking-[0.2em] mt-2">AI Vision Scan System</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full flex items-center gap-4">
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.3em]">OR</span>
                <div className="h-px flex-1 bg-white/5" />
              </div>

              <div className="w-full space-y-6">
                <div className="flex flex-col gap-4">
                  <input 
                    type="text" 
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJoinSession();
                    }}
                    placeholder="Enter Session ID" 
                    className="w-full px-5 py-4 sm:px-8 sm:py-5 rounded-glass-sm bg-white/[0.03] border border-white/10 text-foreground text-base sm:text-lg placeholder:text-foreground/20 focus:outline-none focus:ring-2 focus:ring-sage/40 transition-all font-sans text-center uppercase"
                  />
                  <button 
                    onClick={handleJoinSession}
                    style={{ backgroundColor: '#8ba895' }}
                    className="w-full py-4 sm:py-5 rounded-glass-sm text-background font-bold text-base sm:text-lg uppercase tracking-wider hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                  >
                    Join Existing Session
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[10px] sm:text-xs text-foreground/15 uppercase tracking-[0.2em] sm:tracking-[0.4em] font-bold">
            Meris Protocol // Simplicity in every byte
          </p>
        </motion.div>

        {/* Philosophy Section */}
        <motion.section 
          variants={itemVariants}
          className="mt-24 mb-16 max-w-3xl mx-auto px-6 text-center space-y-8"
        >
          <h2 className="text-xl sm:text-2xl font-serif text-foreground/80 tracking-tight">The Philosophy of Meris</h2>
          <div className="glass-panel rounded-glass p-8 sm:p-12 border-white/5 bg-white/[0.01] relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-12 bg-linear-to-b from-sage/40 to-transparent" />
            <p className="font-serif italic text-lg sm:text-xl text-foreground/50 leading-relaxed">
              &ldquo;Derived from the Ancient Greek word &mu;&tilde;&epsilon;&rho;&iota;&sigmaf; (M&eacute;ris), meaning &apos;portion&apos; or &apos;part&apos;. We believe that every shared moment shouldn&apos;t be burdened by the complexity of numbers. Meris is built to ensure every portion is accounted for with absolute fairness, allowing you to focus on the experience, not the expense.&rdquo;
            </p>
          </div>
        </motion.section>
      </motion.main>

      {/* Subtle Footer */}
      <footer className="mt-auto py-8 text-center relative z-10">
        <p className="text-[10px] text-foreground/10 uppercase tracking-[0.5em] font-bold">
          Meris &copy; 2026
        </p>
      </footer>
    </div>
  );
}
