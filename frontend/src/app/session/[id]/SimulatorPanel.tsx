"use client";

import React from "react";
import { ReceiptItem } from "@/utils/calculations";
import { motion } from "framer-motion";

interface SimulatorPanelProps {
  items: ReceiptItem[];
  onSimulateClientAction: (actor: string, actionType: "claim" | "reset") => void;
  onSimulateRawMessage: (msg: string) => void;
  onSimulateReceiptUpdate: (simulationItems: ReceiptItem[]) => void;
}

export default function SimulatorPanel({
  items,
  onSimulateClientAction,
  onSimulateRawMessage,
  onSimulateReceiptUpdate,
}: SimulatorPanelProps) {
  return (
    <motion.section 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-panel rounded-glass p-5 sm:p-8 space-y-6 sm:space-y-8 border-white/5 bg-white/5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <h3 className="text-[10px] font-bold text-gold uppercase tracking-[0.3em] mb-2">
            Developer Simulation
          </h3>
          <p className="text-xs text-white/30 font-sans">Test real-time collaboration with simulated events.</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => onSimulateClientAction("Alice", "claim")}
            className="px-4 py-2 rounded-glass-sm bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            + Alice
          </button>
          <button
            onClick={() => onSimulateClientAction("Bob", "claim")}
            className="px-4 py-2 rounded-glass-sm bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            + Bob
          </button>
          <button
            onClick={() => {
              onSimulateClientAction("Alice", "reset");
              onSimulateClientAction("Bob", "reset");
            }}
            className="px-4 py-2 rounded-glass-sm bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/20 hover:text-rose-400 hover:border-rose-400/30 transition-all cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={() => {
            const customMsg = `Demo Broadcast event fired at ${new Date().toLocaleTimeString()}`;
            onSimulateRawMessage(customMsg);
          }}
          className="px-6 py-3 rounded-glass-sm glass-panel glass-panel-hover text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-gold transition-all cursor-pointer"
        >
          Broadcast Text Message
        </button>

        <button
          onClick={() => {
            const simulationItems = items.map((it) => {
              const rand = Math.random();
              const simulatedClaims = [...it.claims];
              const totalClaimed = it.claims.reduce((sum, c) => sum + c.shares, 0);
              if (rand > 0.6 && totalClaimed < it.quantity) {
                simulatedClaims.push({ name: "David", shares: 0.5 });
              }
              return {
                id: it.id,
                name: it.name,
                price: it.price,
                quantity: it.quantity,
                claims: simulatedClaims,
              };
            });
            onSimulateReceiptUpdate(simulationItems);
          }}
          className="px-6 py-3 rounded-glass-sm glass-panel glass-panel-hover text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-emerald transition-all cursor-pointer"
        >
          Push Receipt Update
        </button>
      </div>
    </motion.section>
  );
}
