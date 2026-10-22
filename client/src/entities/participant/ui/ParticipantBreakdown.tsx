"use client";

import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { ReceiptItem } from "@/shared/types";
import { GlassPanel } from "@/shared/ui/GlassPanel";
import { formatRupiah, getAvatarBg, getInitials } from "@/shared/lib";
import { useMounted } from "@/shared/hooks";

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
  const mounted = useMounted();
  const [participantToDelete, setParticipantToDelete] = React.useState<{ id: number; name: string } | null>(null);

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
                              type="button"
                              onClick={() => setParticipantToDelete({ id: p.id, name: p.name })}
                              className="flex min-h-[32px] shrink-0 cursor-pointer items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-400 transition-all hover:bg-rose-500/20 hover:text-rose-300 active:scale-95"
                              title={`Keluarkan ${p.name}`}
                              aria-label={`Keluarkan ${p.name}`}
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                              <span>Keluarkan</span>
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

      {/* Konfirmasi Keluarkan Peserta Centered Dialog (Portaled to Document Body) */}
      {mounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {participantToDelete && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setParticipantToDelete(null)}
                className="fixed inset-0 bg-black/70 backdrop-blur-xs"
                aria-hidden="true"
              />
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="bg-background text-foreground relative z-10 w-full max-w-sm rounded-2xl border border-rose-500/25 p-5 shadow-2xl sm:p-6"
              >
                <div className="mb-4 flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-foreground font-sans text-base font-semibold">
                      Keluarkan {participantToDelete.name}?
                    </h4>
                    <p className="text-foreground/60 mt-1 font-sans text-xs leading-relaxed">
                      Semua menu yang sudah diklaim oleh peserta ini akan dikembalikan ke tagihan bersama.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-[var(--glass-border)] pt-3">
                  <button
                    type="button"
                    onClick={() => setParticipantToDelete(null)}
                    className="text-foreground/70 hover:text-foreground min-h-[38px] cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold transition-all hover:bg-[var(--glass-highlight)] active:scale-95"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveParticipant(participantToDelete.id);
                      setParticipantToDelete(null);
                    }}
                    className="min-h-[38px] cursor-pointer rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-rose-600 active:scale-95"
                  >
                    Ya, Keluarkan
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </GlassPanel>
  );
}
