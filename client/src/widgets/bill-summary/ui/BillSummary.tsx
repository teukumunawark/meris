"use client";

import React, { useState } from "react";
import ParticipantBreakdown from "@/entities/participant/ui/ParticipantBreakdown";
import { useSession } from "@/entities/session";
import { useRemoveParticipant } from "@/features/remove-participant";
import { GlassPanel } from "@/shared/ui/GlassPanel";
import { formatRupiah } from "@/shared/lib";
import { MoneyFlowGraph } from "./MoneyFlowGraph";

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
      onClick={handleCopy}
      className="text-sage hover:bg-sage/10 rounded-full px-3 py-1.5 border border-sage/20 text-xs font-bold uppercase transition-all whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer"
      title="Copy Account Number"
    >
      {copied ? (
        <>
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

  const totalSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = totalSubtotal + tax + serviceCharge;
  const isPayer = isJoined && userName.trim().toLowerCase() === payerName.trim().toLowerCase();

  return (
    <div className="space-y-6 sm:space-y-10">
      {/* Bill Summary */}
      <GlassPanel id="bill-summary" className="scroll-mt-20 space-y-6 p-6 sm:space-y-10 sm:p-10">
        <h2 className="text-foreground border-b border-[var(--glass-border)] pb-4 font-sans text-lg font-normal sm:pb-6 sm:text-xl">
          Bill Summary
        </h2>
 
        <div className="space-y-4 font-sans text-sm sm:space-y-6 sm:text-base">
          <div className="text-foreground/40 flex justify-between text-[10px] font-bold tracking-widest uppercase sm:text-xs sm:tracking-[0.2em]">
            <span>Subtotal</span>
            <span className="text-foreground/80">{formatRupiah(totalSubtotal)}</span>
          </div>
          <div className="text-foreground/40 flex justify-between text-[10px] font-bold tracking-widest uppercase sm:text-xs sm:tracking-[0.2em]">
            <span>Tax (PPN)</span>
            <span className="text-foreground/80">{formatRupiah(tax)}</span>
          </div>
          <div className="text-foreground/40 flex justify-between text-[10px] font-bold tracking-widest uppercase sm:text-xs sm:tracking-[0.2em]">
            <span>Service</span>
            <span className="text-foreground/80">{formatRupiah(serviceCharge)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 border-t border-[var(--glass-border)] pt-6 sm:pt-8">
            <span className="text-foreground font-sans text-sm font-semibold tracking-wider uppercase sm:text-base">Grand Total</span>
            <span className="text-sage text-glow-sage shrink-0 font-sans text-xl leading-none font-bold sm:text-2xl">{formatRupiah(grandTotal)}</span>
          </div>
        </div>
      </GlassPanel>
 
      <div id="breakdown-section" className="space-y-6 sm:space-y-10">
        {/* Breakdown List */}
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
 
        {/* Settlement Information (Optimized Transfers) */}
        <GlassPanel variant="solid" className="border-sage/10 relative space-y-6 p-6 sm:space-y-8 sm:p-10">
          <div className="via-sage/40 absolute top-0 left-0 h-1.5 w-full bg-linear-to-r from-transparent to-transparent" />
          
          <div className="relative flex items-center justify-center">
            <h3 className="text-sage text-center font-sans text-[10px] font-bold tracking-[0.2em] uppercase sm:tracking-[0.4em]">Optimized Transfers</h3>
          </div>
          
          {transfers.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <p className="text-foreground/30 font-sans text-sm font-normal italic">All debts settled! No transfers needed.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Visual flow graph */}
              <MoneyFlowGraph
                transfers={transfers}
                rawDebts={rawDebts}
                participants={participants}
                userName={userName}
              />

              {/* Action list */}
              <div className="space-y-2 pt-2 border-t border-[var(--glass-border)]">
                <p className="text-foreground/25 text-[10px] font-bold tracking-widest uppercase pt-2">Action Steps</p>
                <div className="space-y-3">
                  {transfers.map((transfer, idx) => {
                    const recipient = participants.find(p => p.name === transfer.to);
                    return (
                      <div key={idx} className="flex flex-col gap-3 p-4 rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg)] sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-sans text-foreground/80">
                            <strong className="text-foreground font-bold">{transfer.from}</strong> transfers{" "}
                            <span className="text-sage font-bold font-mono">{formatRupiah(Math.round(transfer.amount))}</span> to{" "}
                            <strong className="text-foreground font-bold">{transfer.to}</strong>
                          </p>
                          {recipient && recipient.bankName ? (
                            <p className="text-xs font-sans text-foreground/40 mt-1">
                              Bank Details: <strong className="text-foreground/60">{recipient.bankName}</strong> – {recipient.bankAccount}
                            </p>
                          ) : (
                            <p className="text-xs italic text-foreground/25 mt-1">
                              Recipient has not specified bank details
                            </p>
                          )}
                        </div>
                        {recipient && recipient.bankAccount && (
                          <CopyAccountButton bankAccount={recipient.bankAccount} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
