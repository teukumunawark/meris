"use client";

import React, { useState } from "react";
import ParticipantBreakdown from "@/entities/participant/ui/ParticipantBreakdown";
import { useSession } from "@/entities/session";
import { useRemoveParticipant } from "@/features/remove-participant";
import { GlassPanel } from "@/shared/ui/GlassPanel";
import { formatRupiah } from "@/shared/lib";
import { MoneyFlowGraph } from "./MoneyFlowGraph";
import { BankInfoForm } from "@/widgets/claim-board/ui/BankInfoForm";
import { useManageItems } from "@/features/manage-items";

function CopyAccountButton({ bankAccount }: { bankAccount: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof window !== "undefined" && bankAccount) {
      navigator.clipboard.writeText(bankAccount);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-sage hover:bg-sage/10 border-sage/30 flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold whitespace-nowrap uppercase transition-all active:scale-95"
      title="Copy Account Number"
      aria-label="Copy Account Number"
    >
      {copied ? (
        <>
          <svg className="text-sage h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
          <span className="text-sage">Copied!</span>
        </>
      ) : (
        <>
          <svg className="text-sage h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span>Copy Account</span>
        </>
      )}
    </button>
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
  const isPayer = isJoined && userName.trim().toLowerCase() === payerName.trim().toLowerCase();

  const normalizedUser = userName.trim().toLowerCase();
  const myOutgoing = isJoined ? transfers.filter((t) => t.from.trim().toLowerCase() === normalizedUser) : [];
  const myIncoming = isJoined ? transfers.filter((t) => t.to.trim().toLowerCase() === normalizedUser) : [];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Settlement Information (Prioritized on Top for Actionability) */}
      <GlassPanel variant="solid" className="border-sage/20 relative space-y-5 p-5 sm:space-y-6 sm:p-7">
        <div className="via-sage/40 absolute top-0 left-0 h-1 w-full bg-linear-to-r from-transparent to-transparent" />
        
        <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-3">
          <div>
            <h2 className="text-sage font-sans text-xs font-bold tracking-[0.2em] uppercase">
              Settlement Steps
            </h2>
            <p className="text-foreground/40 font-sans text-xs">
              Simplified transfers to clear all debts
            </p>
          </div>
          <span className="text-foreground/30 font-mono text-xs">
            {transfers.length} {transfers.length === 1 ? "step" : "steps"}
          </span>
        </div>

        {/* Personalized Action Highlight for Joined User */}
        {isJoined && (myOutgoing.length > 0 || myIncoming.length > 0) && (
          <div className="rounded-glass-sm border-sage/30 bg-sage/5 border p-4">
            {myOutgoing.length > 0 && (
              <div className="space-y-3">
                <span className="text-sage text-[10px] font-bold tracking-widest uppercase">Your Payment</span>
                {myOutgoing.map((transfer, idx) => {
                  const recipient = participants.find((p) => p.name === transfer.to);
                  return (
                    <div key={idx} className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-foreground font-sans text-sm">
                          Pay <strong className="font-bold">{transfer.to}</strong>:{" "}
                          <span className="text-sage font-mono text-base font-bold">{formatRupiah(Math.round(transfer.amount))}</span>
                        </p>
                        {recipient?.bankName ? (
                          <p className="text-foreground/60 mt-0.5 font-sans text-xs">
                            Bank: <strong className="text-foreground font-semibold">{recipient.bankName}</strong> {recipient.bankAccount}
                          </p>
                        ) : (
                          <p className="text-foreground/40 mt-0.5 text-xs italic">
                            Recipient has not set their bank account yet
                          </p>
                        )}
                      </div>
                      {recipient?.bankAccount && (
                        <CopyAccountButton bankAccount={recipient.bankAccount} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {myIncoming.length > 0 && (
              <div className={myOutgoing.length > 0 ? "border-sage/15 mt-4 space-y-2 border-t pt-3" : "space-y-2"}>
                <span className="text-sage text-[10px] font-bold tracking-widest uppercase">You Receive</span>
                {myIncoming.map((transfer, idx) => (
                  <p key={idx} className="text-foreground font-sans text-xs">
                    Receive <strong className="text-sage font-mono font-bold">{formatRupiah(Math.round(transfer.amount))}</strong> from <strong className="font-bold">{transfer.from}</strong>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        
        {transfers.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-foreground/40 font-sans text-sm">
              All debts are settled. No transfers needed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* All Action Steps */}
            <div className="space-y-2.5">
              <span className="text-foreground/30 text-[10px] font-bold tracking-widest uppercase">
                All Transfer Instructions
              </span>
              <div className="space-y-2.5">
                {transfers.map((transfer, idx) => {
                  const recipient = participants.find((p) => p.name === transfer.to);
                  const isMyTransfer = isJoined && transfer.from.trim().toLowerCase() === normalizedUser;
                  return (
                    <div 
                      key={idx} 
                      className={`rounded-glass-sm flex flex-col gap-2.5 border p-3.5 sm:flex-row sm:items-center sm:justify-between ${
                        isMyTransfer 
                          ? "border-sage/40 bg-sage/5" 
                          : "border-[var(--glass-border)] bg-[var(--glass-bg)]"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground/90 font-sans text-xs sm:text-sm">
                          <strong className="text-foreground font-bold">{transfer.from}</strong> transfers{" "}
                          <span className="text-sage font-mono font-bold">{formatRupiah(Math.round(transfer.amount))}</span> to{" "}
                          <strong className="text-foreground font-bold">{transfer.to}</strong>
                        </p>
                        {recipient?.bankName ? (
                          <p className="text-foreground/50 mt-1 font-sans text-xs">
                            Account: <strong className="text-foreground/75 font-semibold">{recipient.bankName}</strong> {recipient.bankAccount}
                          </p>
                        ) : (
                          <p className="text-foreground/30 mt-1 text-xs italic">
                            No bank account specified
                          </p>
                        )}
                      </div>
                      {recipient?.bankAccount && (
                        <CopyAccountButton bankAccount={recipient.bankAccount} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Collapsible Money Flow Visual Graph */}
            <div className="border-t border-[var(--glass-border)] pt-3">
              <button
                type="button"
                onClick={() => setShowGraph(!showGraph)}
                className="text-foreground/50 hover:text-sage rounded-glass-sm flex min-h-[44px] w-full cursor-pointer items-center justify-between px-2 text-xs font-medium transition-colors"
              >
                <span>{showGraph ? "Hide Debt Simplification Graph" : "View Debt Simplification Graph"}</span>
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${showGraph ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {showGraph && (
                <div className="animate-in fade-in pt-3 duration-300">
                  <MoneyFlowGraph
                    transfers={transfers}
                    rawDebts={rawDebts}
                    participants={participants}
                    userName={userName}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </GlassPanel>

      {/* 2. Personal Payout Account (Settlement Account) */}
      {isJoined && (() => {
        const myParticipant = participants.find((p) => p.name === userName);
        if (!myParticipant) return null;
        return (
          <GlassPanel className="space-y-3 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-sage text-[10px] font-bold tracking-widest uppercase">
                  Rekening Penerimaan Anda
                </span>
                <p className="text-foreground/80 mt-1 font-sans text-xs sm:text-sm">
                  {myParticipant.bankName ? (
                    <>
                      <strong className="text-foreground font-semibold">{myParticipant.bankName}</strong>: {myParticipant.bankAccount}
                    </>
                  ) : (
                    <span className="text-foreground/40 italic">
                      Belum diatur. Atur rekening agar teman tahu tujuan transfer ke Anda.
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditBank(!showEditBank)}
                className="text-sage hover:bg-sage/10 border-sage/30 flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95"
              >
                {showEditBank ? "Tutup" : myParticipant.bankName ? "Ubah" : "Atur Rekening"}
              </button>
            </div>

            {showEditBank && (
              <div className="mt-3 border-t border-[var(--glass-border)] pt-3">
                <BankInfoForm participant={myParticipant} onUpdate={updateParticipantBank} />
              </div>
            )}
          </GlassPanel>
        );
      })()}

      {/* 3. Bill Summary Card */}
      <GlassPanel id="bill-summary" className="scroll-mt-20 space-y-4 p-5 sm:p-7">
        <h2 className="text-foreground border-b border-[var(--glass-border)] pb-3 font-sans text-base font-normal sm:text-lg">
          Bill Summary
        </h2>
 
        <div className="space-y-3 font-sans text-xs sm:text-sm">
          <div className="text-foreground/40 flex justify-between text-[10px] font-bold tracking-widest uppercase sm:text-xs">
            <span>Subtotal</span>
            <span className="text-foreground/80 font-mono">{formatRupiah(totalSubtotal)}</span>
          </div>
          <div className="text-foreground/40 flex justify-between text-[10px] font-bold tracking-widest uppercase sm:text-xs">
            <span>Tax (PPN)</span>
            <span className="text-foreground/80 font-mono">{formatRupiah(tax)}</span>
          </div>
          <div className="text-foreground/40 flex justify-between text-[10px] font-bold tracking-widest uppercase sm:text-xs">
            <span>Service</span>
            <span className="text-foreground/80 font-mono">{formatRupiah(serviceCharge)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 border-t border-[var(--glass-border)] pt-4">
            <span className="text-foreground font-sans text-xs font-semibold tracking-wider uppercase sm:text-sm">Grand Total</span>
            <span className="text-sage text-glow-sage shrink-0 font-sans text-lg leading-none font-bold sm:text-xl">
              {formatRupiah(grandTotal)}
            </span>
          </div>
        </div>
      </GlassPanel>

      {/* 3. Detailed Participant Breakdown */}
      <div id="breakdown-section" className="space-y-4 sm:space-y-6">
        <ParticipantBreakdown
          participants={participants}
          items={items}
          totalSubtotal={totalSubtotal}
          userName={userName}
          isJoined={isJoined}
          isPayer={isPayer}
          payerName={payerName}
          onRemoveParticipant={removeParticipant}
        />
      </div>
    </div>
  );
}
