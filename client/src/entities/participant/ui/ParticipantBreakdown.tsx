"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReceiptItem } from "@/shared/types";
import { GlassPanel } from "@/shared/ui/GlassPanel";
import { formatRupiah, getAvatarBg, getInitials } from "@/shared/lib";

interface ParticipantBreakdownProps {
  participants: Array<{
    id: number;
    name: string;
    totalOwed?: number;
    subtotal?: number;
    tax?: number;
    serviceCharge?: number;
  }>;
  items: ReceiptItem[];
  totalSubtotal: number;
  userName: string;
  isJoined: boolean;
  isPayer: boolean;
  payerName: string;
  onRemoveParticipant: (id: number) => void;
}

export default function ParticipantBreakdown({
  participants,
  items,
  totalSubtotal,
  userName,
  isJoined,
  isPayer,
  payerName,
  onRemoveParticipant,
}: ParticipantBreakdownProps) {
  return (
    <GlassPanel className="space-y-6 p-4 sm:p-6">
      <div className="bg-orb-sage pointer-events-none absolute top-0 right-0 h-48 w-48 opacity-10 blur-[100px]" />
      
      <div className="relative z-10 flex items-center justify-between border-b border-[var(--glass-border)] pb-3 sm:pb-4">
        <h2 className="text-foreground font-sans text-lg font-normal sm:text-xl">Breakdown</h2>
        <span className="text-foreground/20 text-[9px] font-bold tracking-[0.2em] uppercase sm:text-[10px] sm:tracking-[0.4em]">{participants.length} Active</span>
      </div>

      {participants.length === 0 ? (
        <p className="text-foreground/30 relative z-10 py-6 text-center font-sans text-sm sm:py-10 sm:text-base">No breakdown yet. Claim your items to see each person&apos;s share.</p>
      ) : (
        <ul className="relative z-10 space-y-4" role="list">
          <AnimatePresence mode="popLayout">
            {participants.map((p, idx) => {
              const isCurrentUser = isJoined && p.name === userName.trim();
              const pSubtotal = p.subtotal || 0;
              const percentOfReceipt = totalSubtotal > 0 ? Math.round((pSubtotal / totalSubtotal) * 100) : 0;

              // Derive claimed items from global items list for display
              const claimedItems = items
                .filter(item => item.claims.some(c => c.name === p.name))
                .map(item => {
                  const claim = item.claims.find(c => c.name === p.name);
                  const shares = claim?.shares || 0;
                  return {
                    name: item.name,
                    shares,
                    totalPrice: item.price * shares
                  };
                });

              return (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, x: 25 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.08, duration: 0.6 }}
                  className={`rounded-glass border p-4 transition-all duration-700 sm:p-5 ${
                    isCurrentUser
                      ? "bg-sage/5 border-sage/30"
                      : "border-[var(--glass-border)] bg-[var(--glass-bg-solid)]"
                  }`}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-5">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-12 sm:w-12 sm:text-sm ${getAvatarBg(p.name)}`}>
                        {getInitials(p.name)}
                      </div>
                      <span className="text-foreground truncate font-sans text-base font-normal tracking-tight sm:text-xl">
                        {p.name} {isCurrentUser && <span className="text-sage ml-2 inline-block text-[9px] font-bold tracking-[0.2em] uppercase not-italic sm:ml-4 sm:text-[10px] sm:tracking-[0.3em]">(You)</span>}
                      </span>
                      {(() => {
                        const isTargetPayer = p.name.trim().toLowerCase() === payerName.trim().toLowerCase();
                        if (isPayer && !isTargetPayer) {
                          return (
                            <button
                              onClick={() => onRemoveParticipant(p.id)}
                              className="text-foreground/30 shrink-0 cursor-pointer p-1 transition-colors hover:text-rose-400"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <span className="text-sage text-glow-sage shrink-0 font-sans text-lg font-bold sm:text-xl">
                      {formatRupiah(p.totalOwed || 0)}
                    </span>
                  </div>

                  {/* Proportional details */}
                  <div className="text-foreground/30 space-y-2 border-t border-[var(--glass-border)] pt-4 text-xs font-semibold tracking-widest uppercase sm:text-sm sm:tracking-[0.2em]">
                    <div className="flex items-baseline justify-between gap-2">
                      <span>subtotal ({percentOfReceipt}%)</span>
                      <span className="text-foreground/60 shrink-0">{formatRupiah(pSubtotal)}</span>
                    </div>
                    {pSubtotal > 0 && (
                      <>
                        <div className="flex items-baseline justify-between gap-2">
                          <span>tax</span>
                          <span className="text-foreground/40 shrink-0">{formatRupiah(p.tax || 0)}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span>service</span>
                          <span className="text-foreground/40 shrink-0">{formatRupiah(p.serviceCharge || 0)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Items claimed details */}
                  {claimedItems.length > 0 && (
                    <div className="mt-4 space-y-1.5 border-t border-dashed border-[var(--glass-border)] pt-4 sm:space-y-2">
                      <span className="text-foreground/15 mb-2 block text-[9px] font-bold tracking-[0.3em] uppercase sm:text-[10px] sm:tracking-[0.5em]">Selections</span>
                      {claimedItems.map((item, ciIdx) => (
                        <div key={ciIdx} className="flex justify-between gap-3 font-sans text-xs sm:text-sm">
                          <span className="text-foreground/50 truncate">{item.shares}x {item.name}</span>
                          <span className="text-foreground/40 shrink-0 font-mono text-xs sm:text-sm">{formatRupiah(item.totalPrice)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </GlassPanel>
  );
}
