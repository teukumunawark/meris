"use client";

import React from "react";

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
    <section className="bg-zinc-950/80 border border-zinc-900 rounded-3xl overflow-hidden shadow-inner flex flex-col h-64">
      <div className="px-5 py-3.5 bg-zinc-900/50 border-b border-zinc-900 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider font-extrabold text-zinc-400">
          Live SSE Event Logs
        </span>
        <button
          onClick={onClearLogs}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase font-semibold transition cursor-pointer"
        >
          Clear Logs
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] text-zinc-300 space-y-2 select-text">
        {logs.map((log, idx) => (
          <div
            key={idx}
            className={`py-0.5 border-l-2 pl-2 ${
              log.includes("[Error]")
                ? "border-rose-500 text-rose-300 bg-rose-950/10"
                : log.includes("[System]")
                ? "border-violet-500 text-violet-300"
                : log.includes("[SSE]")
                ? "border-emerald-500 text-emerald-300"
                : log.includes("[Simulator]")
                ? "border-amber-500 text-amber-300"
                : "border-zinc-800 text-zinc-400"
            }`}
          >
            {log}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </section>
  );
}
