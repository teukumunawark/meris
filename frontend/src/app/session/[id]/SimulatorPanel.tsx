"use client";

import React from "react";
import { ReceiptItem } from "@/utils/calculations";

interface SimulatorPanelProps {
  items: ReceiptItem[];
  tax: number;
  serviceCharge: number;
  onSimulateClientAction: (actor: string, actionType: "claim" | "reset") => void;
  onSimulateRawMessage: (msg: string) => void;
  onSimulateReceiptUpdate: (simulationItems: ReceiptItem[]) => void;
}

export default function SimulatorPanel({
  items,
  tax,
  serviceCharge,
  onSimulateClientAction,
  onSimulateRawMessage,
  onSimulateReceiptUpdate,
}: SimulatorPanelProps) {
  return (
    <section className="bg-zinc-950/40 border border-zinc-800/60 rounded-3xl p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
        <div>
          <h3 className="text-sm font-bold text-violet-400 uppercase tracking-wider">
            Dev Simulation Panel
          </h3>
          <p className="text-xs text-zinc-500">Simulate incoming Server-Sent Events to test real-time collaboration.</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => onSimulateClientAction("Alice", "claim")}
            className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold transition cursor-pointer"
          >
            + Alice Claim
          </button>
          <button
            onClick={() => onSimulateClientAction("Bob", "claim")}
            className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold transition cursor-pointer"
          >
            + Bob Claim
          </button>
          <button
            onClick={() => {
              onSimulateClientAction("Alice", "reset");
              onSimulateClientAction("Bob", "reset");
            }}
            className="px-3 py-1 rounded bg-zinc-800/50 hover:bg-rose-950/30 hover:text-rose-400 hover:border-rose-900 border border-transparent text-[11px] font-semibold transition cursor-pointer"
          >
            Clear Simulators
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            const customMsg = `Demo Broadcast event fired at ${new Date().toLocaleTimeString()}`;
            onSimulateRawMessage(customMsg);
          }}
          className="px-4 py-2 rounded-xl bg-violet-950/20 border border-violet-900/40 hover:bg-violet-900/30 text-xs font-semibold text-violet-300 transition cursor-pointer"
        >
          Broadcast Mock Text Message
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
          className="px-4 py-2 rounded-xl bg-indigo-950/20 border border-indigo-900/40 hover:bg-indigo-900/30 text-xs font-semibold text-indigo-300 transition cursor-pointer"
        >
          Push Mock Receipt Update
        </button>
      </div>
    </section>
  );
}
