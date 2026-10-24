"use client";

import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { ReceiptItem } from "@/shared/types";
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
  currentParticipantId: number | null;
  isPayer: boolean;
  payerName: string;
  onRemoveParticipant: (id: number) => void;
}

export default function ParticipantBreakdown({
  participants,
  items,
  totalSubtotal,
  currentParticipantId,
  isPayer,
  payerName,
  onRemoveParticipant,
}: ParticipantBreakdownProps) {
  const mounted = useMounted();
  const [participantToDelete, setParticipantToDelete] = React.useState<{ id: number; name: string } | null>(null);

  return (
    <section
      aria-labelledby="breakdown-title"
      className="rounded-glass border border-[var(--glass-border)] bg-[var(--glass-bg-solid)] p-4 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="breakdown-title" className="text-foreground font-serif text-xl">Bagian tiap orang</h2>
        <span className="text-foreground/65 font-sans text-sm tabular-nums">{participants.length} peserta</span>
      </div>

      {participants.length === 0 ? (
        <p className="text-foreground/75 mt-3 font-sans text-sm leading-relaxed">
          Belum ada peserta. Bagikan link sesi supaya teman bisa bergabung dan memilih pesanannya.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--glass-border)]">
          {participants.map((p) => {
            const isCurrentUser = currentParticipantId !== null && p.id === currentParticipantId;
            const isTargetPayer = p.name.trim().toLowerCase() === payerName.trim().toLowerCase();
            const pSubtotal = p.subtotal || 0;
            const pExtras = (p.tax || 0) + (p.serviceCharge || 0);
            const percentOfReceipt = totalSubtotal > 0 ? Math.round((pSubtotal / totalSubtotal) * 100) : 0;

            // Claims carry the participant's name, so match on it to list what this person picked
            const claimedItems = items
              .map((item) => {
                const shares = item.claims.find((c) => c.name === p.name)?.shares || 0;
                return { id: item.id, name: item.name, shares, totalPrice: item.price * shares };
              })
              .filter((item) => item.shares > 0);

            return (
              <li key={p.id} className="py-4 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-sans text-xs font-bold ${getAvatarBg(p.name)}`}>
                      {getInitials(p.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-foreground truncate font-sans text-base font-semibold">
                        {p.name}
                        {isCurrentUser && <span className="text-foreground/65 font-normal"> (kamu)</span>}
                      </p>
                      <p className="text-foreground/65 font-sans text-xs tabular-nums">
                        {isTargetPayer ? "Membayar struk · " : ""}
                        {pSubtotal > 0 ? `${percentOfReceipt}% dari menu` : "Belum klaim menu"}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 font-sans text-base font-semibold tabular-nums ${isCurrentUser ? "text-sage" : "text-foreground"}`}>
                    {formatRupiah(p.totalOwed || 0)}
                  </span>
                </div>

                {claimedItems.length > 0 && (
                  <dl className="mt-3 space-y-1 pl-12 font-sans text-sm">
                    {claimedItems.map((item) => (
                      <div key={item.id} className="flex justify-between gap-3">
                        <dt className="text-foreground/80 min-w-0 truncate">
                          <span className="tabular-nums">{item.shares}×</span> {item.name}
                        </dt>
                        <dd className="text-foreground/80 shrink-0 tabular-nums">{formatRupiah(item.totalPrice)}</dd>
                      </div>
                    ))}
                    {pExtras > 0 && (
                      <div className="flex justify-between gap-3 border-t border-dashed border-[var(--glass-border)] pt-1">
                        <dt className="text-foreground/65">Pajak + layanan</dt>
                        <dd className="text-foreground/65 shrink-0 tabular-nums">{formatRupiah(Math.round(pExtras))}</dd>
                      </div>
                    )}
                  </dl>
                )}

                {isPayer && !isTargetPayer && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setParticipantToDelete({ id: p.id, name: p.name })}
                      className="rounded-glass-sm min-h-11 cursor-pointer px-3 font-sans text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:text-rose-300"
                    >
                      Keluarkan {p.name}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Konfirmasi Keluarkan Peserta Centered Dialog (Portaled to Document Body) */}
      {mounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {participantToDelete && (
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center p-4"
              onKeyDown={(e) => {
                if (e.key === "Escape") setParticipantToDelete(null);
              }}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setParticipantToDelete(null)}
                className="fixed inset-0 bg-black/70"
                aria-hidden="true"
              />
              <motion.div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="remove-participant-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="bg-background text-foreground relative z-10 w-full max-w-sm rounded-2xl border border-rose-500/25 p-5 shadow-2xl sm:p-6"
              >
                <h4 id="remove-participant-title" className="text-foreground font-sans text-base font-semibold">
                  Keluarkan {participantToDelete.name}?
                </h4>
                <p className="text-foreground/75 mt-1 font-sans text-sm leading-relaxed">
                  Semua menu yang sudah diklaim oleh peserta ini akan dikembalikan ke tagihan bersama.
                </p>

                <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--glass-border)] pt-3">
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setParticipantToDelete(null)}
                    className="text-foreground/80 hover:text-foreground min-h-11 cursor-pointer rounded-xl px-4 font-sans text-sm font-semibold transition-colors hover:bg-[var(--glass-highlight)]"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveParticipant(participantToDelete.id);
                      setParticipantToDelete(null);
                    }}
                    className="min-h-11 cursor-pointer rounded-xl bg-rose-600 px-4 font-sans text-sm font-semibold text-white transition-colors hover:bg-rose-700"
                  >
                    Ya, keluarkan
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </section>
  );
}
