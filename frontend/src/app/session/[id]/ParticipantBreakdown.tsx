"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ReceiptItem, calculateParticipantBreakdowns } from "@/utils/calculations";

interface ParticipantBreakdownProps {
  participants: Array<{ id: number; name: string }>;
  items: ReceiptItem[];
  totalSubtotal: number;
  tax: number;
  serviceCharge: number;
  userName: string;
  isJoined: boolean;
  isPayer: boolean;
  payerName: string;
  onRemoveParticipant: (id: number) => void;
  formatRupiah: (val: number) => string;
  getAvatarBg: (name: string) => string;
  getInitials: (name: string) => string;
}

export default function ParticipantBreakdown({
  participants,
  items,
  totalSubtotal,
  tax,
  serviceCharge,
  userName,
  isJoined,
  isPayer,
  payerName,
  onRemoveParticipant,
  formatRupiah,
  getAvatarBg,
  getInitials,
}: ParticipantBreakdownProps) {
  const participantNames = participants.map((p) => p.name);
  const breakdowns = calculateParticipantBreakdowns(
    participantNames,
    items,
    totalSubtotal,
    tax,
    serviceCharge
  );

  return (
    <div className="glass-panel rounded-glass p-4 sm:p-6 space-y-6 border-white/5 relative overflow-hidden bg-white/[0.01]">
      <div className="absolute top-0 right-0 w-48 h-48 bg-orb-sage blur-[100px] opacity-10 pointer-events-none" />
      
      <div className="flex items-center justify-between border-b border-white/5 pb-3 sm:pb-4 relative z-10">
        <h2 className="text-xl sm:text-2xl font-sans text-foreground font-normal">Breakdown</h2>
        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.4em] text-foreground/20">{participants.length} Active</span>
      </div>

      {breakdowns.length === 0 ? (
        <p className="text-sm sm:text-base text-foreground/30 font-sans relative z-10 text-center py-6 sm:py-10">No data to display yet.</p>
      ) : (
        <ul className="space-y-4 relative z-10" role="list">
          <AnimatePresence mode="popLayout">
            {breakdowns.map((p, idx) => {
              const isCurrentUser = isJoined && p.name === userName.trim();
              const percentOfReceipt = totalSubtotal > 0 ? Math.round((p.subtotal / totalSubtotal) * 100) : 0;

              return (
                <motion.li
                  key={p.name}
                  layout
                  initial={{ opacity: 0, x: 25 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.08, duration: 0.6 }}
                  className={`p-4 sm:p-5 rounded-glass border transition-all duration-700 ${
                    isCurrentUser
                      ? "bg-sage/5 border-sage/30"
                      : "bg-white/[0.03] border-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4 gap-3">
                    <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 ${getAvatarBg(p.name)}`}>
                        {getInitials(p.name)}
                      </div>
                      <span className="font-sans text-base sm:text-xl text-foreground tracking-tight font-normal truncate">
                        {p.name} {isCurrentUser && <span className="inline-block text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-sage not-italic ml-2 sm:ml-4">(You)</span>}
                      </span>
                      {(() => {
                        const match = participants.find((part) => part.name === p.name);
                        const isTargetPayer = p.name.trim().toLowerCase() === payerName.trim().toLowerCase();
                        if (isPayer && match && !isTargetPayer) {
                          return (
                            <button
                              onClick={() => onRemoveParticipant(match.id)}
                              className="text-foreground/30 hover:text-rose-400 p-1 cursor-pointer transition-colors shrink-0"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    <span className="text-lg sm:text-xl font-sans font-bold text-sage text-glow-sage shrink-0">
                      {formatRupiah(p.total)}
                    </span>
                  </div>

                  {/* Proportional details */}
                  <div className="space-y-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.1em] sm:tracking-[0.2em] text-foreground/30 border-t border-white/5 pt-4">
                    <div className="flex justify-between items-baseline gap-2">
                      <span>subtotal ({percentOfReceipt}%)</span>
                      <span className="text-foreground/60 shrink-0">{formatRupiah(p.subtotal)}</span>
                    </div>
                    {p.subtotal > 0 && (
                      <>
                        <div className="flex justify-between items-baseline gap-2">
                          <span>tax</span>
                          <span className="text-foreground/40 shrink-0">{formatRupiah(p.tax)}</span>
                        </div>
                        <div className="flex justify-between items-baseline gap-2">
                          <span>service</span>
                          <span className="text-foreground/40 shrink-0">{formatRupiah(p.serviceCharge)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Items claimed details */}
                  {p.claimedItems.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-dashed border-white/10 space-y-1.5 sm:space-y-2">
                      <span className="text-[9px] sm:text-[10px] text-foreground/15 uppercase font-bold tracking-[0.3em] sm:tracking-[0.5em] block mb-2">Selections</span>
                      {p.claimedItems.map((item, ciIdx) => (
                        <div key={ciIdx} className="flex justify-between text-xs sm:text-sm font-sans gap-3">
                          <span className="text-foreground/50 truncate">{item.shares}x {item.name}</span>
                          <span className="font-mono text-xs sm:text-sm text-foreground/40 shrink-0">{formatRupiah(item.totalPrice)}</span>
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
    </div>
  );
}
