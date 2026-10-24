"use client";

import React, { useEffect, useId } from "react";
import { motion } from "framer-motion";
import type { ReceiptItem } from "@/shared/types";
import { formatRupiah, getInitials } from "@/shared/lib";

interface SheetParticipant {
  id: number;
  name: string;
  subtotal?: number;
}

interface ParticipantsSheetProps {
  participants: SheetParticipant[];
  items: ReceiptItem[];
  currentParticipantId: number | null;
  payerName: string;
  isPayer: boolean;
  removingId: number | null;
  copySuccess: boolean;
  copyFailed: boolean;
  onCopyLink: () => void;
  onRequestRemove: (participant: { id: number; name: string }) => void;
  onClose: () => void;
  // Escape belongs to the confirm dialog while it is open
  closeOnEscape: boolean;
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage";

export function ParticipantsSheet({
  participants,
  items,
  currentParticipantId,
  payerName,
  isPayer,
  removingId,
  copySuccess,
  copyFailed,
  onCopyLink,
  onRequestRemove,
  onClose,
  closeOnEscape,
}: ParticipantsSheetProps) {
  const titleId = useId();

  useEffect(() => {
    if (!closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeOnEscape, onClose]);

  const isSamePerson = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

  // You first, so the row you can act on is never below the fold
  const ordered = [...participants].sort((a, b) => {
    if (a.id === currentParticipantId) return -1;
    if (b.id === currentParticipantId) return 1;
    return 0;
  });

  // The session code is the part people recognise; the host is dropped so the code is never the part that gets cut off.
  // The full link is what gets copied.
  const fullLink = typeof window !== "undefined" ? window.location.href : "";
  const sessionLink = (() => {
    if (typeof window === "undefined") return "";
    const [, , code = ""] = window.location.pathname.split("/");
    const shortCode = code.length > 12 ? `${code.slice(0, 8)}…` : code;
    return `…/session/${shortCode}`;
  })();

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60"
        aria-hidden="true"
      />

      {/* Slides up from the bottom edge it is anchored to; a plain tween, no bounce */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="bg-background text-foreground relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-2xl border-t border-[var(--glass-border)] pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:border"
      >
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-foreground font-serif text-2xl leading-tight">Peserta</h2>
            <p className="text-foreground/70 mt-0.5 font-sans text-sm tabular-nums">
              {participants.length} orang di sesi ini
            </p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className={`text-foreground/70 hover:text-foreground rounded-glass-sm -mt-1 -mr-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center transition-colors hover:bg-[var(--glass-highlight)] ${focusRing}`}
            aria-label="Tutup daftar peserta"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Invite: the link itself is shown, so people see what they are sharing */}
        <div className="mx-5 mb-2">
          <p className="text-foreground/75 mb-1.5 font-sans text-xs">Ajak teman lewat link ini</p>
          <div className="rounded-glass-sm flex items-center gap-2 border border-[var(--glass-border)] bg-[var(--glass-bg)] p-1.5 pl-3">
            <span className="text-foreground/85 min-w-0 flex-1 truncate font-sans text-sm" title={fullLink}>
              {sessionLink}
            </span>
            <button
              type="button"
              onClick={onCopyLink}
              className={`bg-sage text-background rounded-glass-sm flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 px-3.5 font-sans text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98] ${focusRing}`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {copySuccess ? (
                  <path d="M20 6 9 17l-5-5" />
                ) : (
                  <>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </>
                )}
              </svg>
              <span aria-live="polite">{copySuccess ? "Tersalin" : copyFailed ? "Gagal menyalin" : "Salin link"}</span>
            </button>
          </div>
        </div>

        <ul className="divide-y divide-[var(--glass-border)] overflow-y-auto overscroll-contain px-5">
          {ordered.map((p) => {
            const isMe = p.id === currentParticipantId;
            const isTargetPayer = isSamePerson(p.name, payerName);
            const canKick = isPayer && !isTargetPayer;
            const claimedCount = items.filter((item) => item.claims.some((c) => c.name === p.name && c.shares > 0)).length;
            const subtotal = p.subtotal || 0;

            const details = [
              isTargetPayer ? "Membayar struk" : null,
              claimedCount > 0 ? `${claimedCount} menu · ${formatRupiah(subtotal)}` : "Belum klaim menu",
            ].filter(Boolean).join(" · ");

            return (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-sans text-xs font-bold ${
                      isMe
                        ? "bg-sage text-background"
                        : "text-foreground border border-[var(--glass-border)] bg-[var(--glass-bg)]"
                    }`}
                    aria-hidden="true"
                  >
                    {getInitials(p.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-foreground truncate font-sans text-base font-semibold">
                      {p.name}
                      {isMe && <span className="text-foreground/70 font-normal"> (kamu)</span>}
                    </p>
                    <p className="text-foreground/70 truncate font-sans text-sm tabular-nums">{details}</p>
                  </div>
                </div>

                {canKick && (
                  <button
                    type="button"
                    disabled={removingId === p.id}
                    onClick={() => onRequestRemove({ id: p.id, name: p.name })}
                    // Neutral until hovered: the red belongs to the confirm step, not to every row
                    className="rounded-glass-sm text-foreground/70 min-h-11 shrink-0 cursor-pointer px-2.5 font-sans text-sm font-semibold transition-colors hover:bg-rose-500/10 hover:text-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-50 dark:hover:text-rose-300"
                    aria-label={`Keluarkan ${p.name}`}
                  >
                    {removingId === p.id ? "Mengeluarkan..." : "Keluarkan"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </motion.div>
    </div>
  );
}
