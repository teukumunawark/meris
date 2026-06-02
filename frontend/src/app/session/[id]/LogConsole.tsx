"use client";

import React from "react";
import { motion } from "framer-motion";

interface LogConsoleProps {
  logs: string[];
  onClearLogs: () => void;
  logEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function LogConsole({
  logs,
  onClearLogs,
  logEndRef,
}: LogConsoleProps) {
  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-glass overflow-hidden flex flex-col h-72 border-white/5 bg-black/40"
    >
      <div className="px-6 py-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/30 font-sans">
          Live Event Stream
        </span>
        <button
          onClick={onClearLogs}
          className="text-[9px] text-white/20 hover:text-gold uppercase font-bold tracking-widest transition-all cursor-pointer"
        >
          Clear Stream
        </button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto font-mono text-[11px] space-y-3 selection:bg-gold/30">
        {logs.map((log, idx) => (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            key={idx}
            className={`py-1 px-3 rounded-glass-sm border-l-2 ${
              log.includes("[Error]")
                ? "border-rose-500/50 text-rose-300 bg-rose-500/5"
                : log.includes("[System]")
                ? "border-gold/50 text-gold/80 bg-gold/5"
                : log.includes("[SSE]")
                ? "border-emerald/50 text-emerald/80 bg-emerald/5"
                : log.includes("[Simulator]")
                ? "border-amethyst/50 text-amethyst/80 bg-amethyst/5"
                : "border-white/10 text-white/30"
            }`}
          >
            <span className="opacity-40 mr-2">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
            {log}
          </motion.div>
        ))}
        <div ref={logEndRef} />
      </div>
    </motion.section>
  );
}
