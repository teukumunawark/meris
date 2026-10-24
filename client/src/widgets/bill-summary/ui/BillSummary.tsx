"use client";

import React, { useState } from "react";
import ParticipantBreakdown from "@/entities/participant/ui/ParticipantBreakdown";
import { useSession } from "@/entities/session";
import type { Transfer } from "@/entities/session";
import { useRemoveParticipant } from "@/features/remove-participant";
import { formatRupiah } from "@/shared/lib";
import { MoneyFlowGraph } from "./MoneyFlowGraph";
import { BankInfoForm } from "@/widgets/claim-board/ui/BankInfoForm";
import { useManageItems } from "@/features/manage-items";

// Plain bordered surface: this tab stacks several sections, so none of them get blur or glow
const sectionClass = "rounded-glass border border-[var(--glass-border)] bg-[var(--glass-bg-solid)] p-4 sm:p-6";
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage";

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function CopyButton({ value, label, primary = false }: { value: string; label: string; primary?: boolean }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      // Clipboard is unavailable outside secure contexts (e.g. plain http on a LAN IP)
      setStatus("failed");
    }
    setTimeout(() => setStatus("idle"), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`rounded-glass-sm flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 px-3 font-sans text-sm font-semibold transition-colors active:scale-[0.98] ${focusRing} ${
        primary
          ? "bg-sage text-background hover:brightness-110"
          : "text-foreground border border-[var(--glass-border)] bg-[var(--glass-bg)] hover:bg-[var(--glass-highlight)]"
      }`}
    >
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {status === "copied" ? (
          <path d="M20 6 9 17l-5-5" />
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </>
        )}
      </svg>
      <span aria-live="polite">
        {status === "copied" ? "Tersalin" : status === "failed" ? "Gagal menyalin" : label}
      </span>
    </button>
  );
}

function OutgoingPayment({ transfer, bankName, bankAccount }: { transfer: Transfer; bankName?: string; bankAccount?: string }) {
  const amount = Math.round(transfer.amount);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-foreground/75 font-sans text-sm">
          Kamu transfer ke <strong className="text-foreground font-semibold">{transfer.to}</strong>
        </p>
        <p className="text-foreground mt-1 font-serif text-[2rem] leading-tight tabular-nums sm:text-4xl">
          {formatRupiah(amount)}
        </p>
      </div>

      {bankAccount ? (
        <div className="rounded-glass-sm border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3.5 py-3">
          <p className="text-foreground/70 font-sans text-xs">{bankName || "Rekening tujuan"}</p>
          <p className="text-foreground mt-0.5 font-sans text-base font-semibold tracking-wide break-all tabular-nums">
            {bankAccount}
          </p>
        </div>
      ) : (
        <p className="text-foreground/75 font-sans text-sm leading-relaxed">
          {transfer.to} belum mengisi rekening. Minta {transfer.to} mengisinya di tab Pembayaran, lalu cek lagi di sini.
        </p>
      )}

      <div className={`grid gap-2 ${bankAccount ? "grid-cols-2" : "grid-cols-1"}`}>
        <CopyButton value={String(amount)} label="Salin nominal" primary={!bankAccount} />
        {bankAccount && <CopyButton value={bankAccount} label="Salin rekening" primary />}
      </div>
    </div>
  );
}

export default function BillSummary() {
  const {
    participants,
    items,
    tax,
    serviceCharge,
    userName,
    isJoined,
    participantId,
    payerName,
    transfers,
    rawDebts
  } = useSession();
  const { removeParticipant } = useRemoveParticipant();
  const { updateParticipantBank } = useManageItems();

  const [showGraph, setShowGraph] = useState(false);
  const [showEditBank, setShowEditBank] = useState(false);

  const totalSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = totalSubtotal + tax + serviceCharge;
  const hasClaims = items.some((item) => item.claims.some((c) => c.shares > 0));

  const me = isJoined ? participants.find((p) => p.id === participantId) : undefined;
  const myName = me?.name ?? userName.trim();
  const isPayer = isJoined && sameName(myName, payerName);

  const myOutgoing = isJoined ? transfers.filter((t) => sameName(t.from, myName)) : [];
  const myIncoming = isJoined ? transfers.filter((t) => sameName(t.to, myName)) : [];
  const totalIncoming = myIncoming.reduce((sum, t) => sum + Math.round(t.amount), 0);
  const showPayoutAccount = !!me && (isPayer || myIncoming.length > 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. The one decision on this tab: what I pay (or receive), to whom, to which account */}
      {isJoined ? (
        <section aria-label="Pembayaranmu" className="rounded-glass border-sage/35 bg-sage/[0.07] space-y-5 border p-4 sm:p-6">
          {myOutgoing.map((transfer, idx) => {
            const recipient = participants.find((p) => p.name === transfer.to);
            return (
              <div key={idx} className={idx > 0 ? "border-sage/20 border-t border-dashed pt-5" : undefined}>
                <OutgoingPayment transfer={transfer} bankName={recipient?.bankName} bankAccount={recipient?.bankAccount} />
              </div>
            );
          })}

          {myIncoming.length > 0 && (
            <div className={myOutgoing.length > 0 ? "border-sage/20 space-y-3 border-t border-dashed pt-5" : "space-y-3"}>
              <div>
                <p className="text-foreground/75 font-sans text-sm">
                  Kamu menerima dari {myIncoming.length} orang
                </p>
                <p className="text-foreground mt-1 font-serif text-[2rem] leading-tight tabular-nums sm:text-4xl">
                  {formatRupiah(totalIncoming)}
                </p>
              </div>
              <ul className="space-y-1.5 font-sans text-sm">
                {myIncoming.map((transfer, idx) => (
                  <li key={idx} className="flex items-baseline justify-between gap-3">
                    <span className="text-foreground/80 truncate">{transfer.from}</span>
                    <span className="text-foreground shrink-0 font-semibold tabular-nums">{formatRupiah(Math.round(transfer.amount))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {myOutgoing.length === 0 && myIncoming.length === 0 && (
            <p className="text-foreground/80 font-sans text-sm leading-relaxed">
              {(me?.subtotal ?? 0) > 0 || isPayer
                ? "Kamu tidak perlu transfer ke siapa pun."
                : "Kamu belum mengklaim menu. Pilih pesananmu di tab Klaim Menu, nominal transfermu muncul di sini."}
            </p>
          )}

          {showPayoutAccount && me && (
            <div className="border-sage/20 space-y-3 border-t border-dashed pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-foreground/75 font-sans text-sm">Rekening untuk menerima transfer</p>
                  {me.bankAccount ? (
                    <p className="text-foreground mt-0.5 font-sans text-base font-semibold break-all tabular-nums">
                      {me.bankName ? `${me.bankName} · ` : ""}{me.bankAccount}
                    </p>
                  ) : (
                    <p className="text-foreground/75 mt-0.5 font-sans text-sm leading-relaxed">
                      Belum diisi. Teman tidak tahu harus transfer ke mana sampai kamu mengisinya.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditBank(!showEditBank)}
                  aria-expanded={showEditBank}
                  className={`text-sage hover:bg-sage/10 rounded-glass-sm min-h-11 shrink-0 cursor-pointer px-3 font-sans text-sm font-semibold transition-colors ${focusRing}`}
                >
                  {showEditBank ? "Tutup" : me.bankAccount ? "Ubah" : "Isi rekening"}
                </button>
              </div>
              {showEditBank && (
                <BankInfoForm participant={me} onUpdate={updateParticipantBank} />
              )}
            </div>
          )}
        </section>
      ) : (
        <p className="text-foreground/75 px-1 font-sans text-sm leading-relaxed">
          Gabung di tab Klaim Menu untuk melihat berapa yang harus kamu transfer.
        </p>
      )}

      {/* 2. Every transfer in the group, for anyone checking the whole picture */}
      <section aria-labelledby="all-transfers-title" className={sectionClass}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="all-transfers-title" className="text-foreground font-serif text-xl">Semua transfer</h2>
          {transfers.length > 0 && (
            <span className="text-foreground/65 font-sans text-sm tabular-nums">{transfers.length} transfer</span>
          )}
        </div>

        {transfers.length === 0 ? (
          <p className="text-foreground/75 mt-3 font-sans text-sm leading-relaxed">
            {hasClaims
              ? "Tidak ada transfer. Semua menu yang diklaim dipesan oleh orang yang membayar struknya."
              : "Belum ada menu yang diklaim. Transfer muncul di sini setelah peserta memilih pesanannya."}
          </p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-[var(--glass-border)]">
              {transfers.map((transfer, idx) => {
                const recipient = participants.find((p) => p.name === transfer.to);
                const fromMe = isJoined && sameName(transfer.from, myName);
                const toMe = isJoined && sameName(transfer.to, myName);
                return (
                  <li key={idx} className="py-3 first:pt-1 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3 font-sans text-sm">
                      <p className="text-foreground flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                        <span className="font-semibold">{transfer.from}{fromMe && <span className="text-foreground/65 font-normal"> (kamu)</span>}</span>
                        {/* Arrow carries the direction of the money, so it stays */}
                        <svg className="text-foreground/60 h-3.5 w-3.5 shrink-0 self-center" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                        <span className="sr-only">ke</span>
                        <span className="font-semibold">{transfer.to}{toMe && <span className="text-foreground/65 font-normal"> (kamu)</span>}</span>
                      </p>
                      <span className="text-foreground shrink-0 font-semibold tabular-nums">{formatRupiah(Math.round(transfer.amount))}</span>
                    </div>
                    <p className="text-foreground/65 mt-0.5 font-sans text-xs break-all">
                      {recipient?.bankAccount
                        ? `${recipient.bankName ? `${recipient.bankName} · ` : ""}${recipient.bankAccount}`
                        : `Rekening ${transfer.to} belum diisi`}
                    </p>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 border-t border-[var(--glass-border)] pt-2">
              <button
                type="button"
                onClick={() => setShowGraph(!showGraph)}
                aria-expanded={showGraph}
                className={`text-foreground/75 hover:text-foreground rounded-glass-sm flex min-h-11 w-full cursor-pointer items-center justify-between font-sans text-sm transition-colors ${focusRing}`}
              >
                <span>{showGraph ? "Sembunyikan alur utang" : "Kenapa transfernya begini?"}</span>
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${showGraph ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {showGraph && (
                <div className="pt-3">
                  <MoneyFlowGraph
                    transfers={transfers}
                    rawDebts={rawDebts}
                    participants={participants}
                    userName={myName}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* 3. The receipt itself; dashed rules echo a printed struk */}
      <section aria-labelledby="receipt-title" id="bill-summary" className={`scroll-mt-20 ${sectionClass}`}>
        <h2 id="receipt-title" className="text-foreground font-serif text-xl">Rincian struk</h2>
        <dl className="mt-3 space-y-2 font-sans text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-foreground/75">Subtotal menu</dt>
            <dd className="text-foreground tabular-nums">{formatRupiah(totalSubtotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-foreground/75">Pajak (PPN)</dt>
            <dd className="text-foreground tabular-nums">{formatRupiah(tax)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-foreground/75">Biaya layanan</dt>
            <dd className="text-foreground tabular-nums">{formatRupiah(serviceCharge)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-[var(--glass-border)] pt-3">
            <dt className="text-foreground font-semibold">Total</dt>
            <dd className="text-foreground font-serif text-xl tabular-nums">{formatRupiah(grandTotal)}</dd>
          </div>
        </dl>
      </section>

      {/* 4. Per-person shares */}
      <div id="breakdown-section">
        <ParticipantBreakdown
          participants={participants}
          items={items}
          totalSubtotal={totalSubtotal}
          currentParticipantId={isJoined ? participantId : null}
          isPayer={isPayer}
          payerName={payerName}
          onRemoveParticipant={removeParticipant}
        />
      </div>
    </div>
  );
}
