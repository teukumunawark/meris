"use client";

import React, { useState } from "react";
import ParticipantBreakdown from "@/entities/participant/ui/ParticipantBreakdown";
import { useSession } from "@/entities/session";
import { useRemoveParticipant } from "@/features/remove-participant";
import { GlassPanel } from "@/shared/ui/GlassPanel";
import { formatRupiah, getAvatarBg, getInitials } from "@/shared/lib";

export default function BillSummary() {
  const { 
    participants, 
    items, 
    tax, 
    serviceCharge, 
    userName, 
    isJoined, 
    payerName, 
    payerBankName, 
    payerBankAccount 
  } = useSession();
  const { removeParticipant } = useRemoveParticipant();

  const [copyAccountSuccess, setCopyAccountSuccess] = useState<boolean>(false);

  const handleCopyAccount = () => {
    if (typeof window !== "undefined" && payerBankAccount) {
      navigator.clipboard.writeText(payerBankAccount);
      setCopyAccountSuccess(true);
      setTimeout(() => setCopyAccountSuccess(false), 2000);
    }
  };

  const totalSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = totalSubtotal + tax + serviceCharge;
  const isPayer = isJoined && userName.trim().toLowerCase() === payerName.trim().toLowerCase();

  return (
    <div className="space-y-8 sm:space-y-16">
      {/* Bill Summary */}
      <GlassPanel id="bill-summary" className="scroll-mt-20 space-y-6 p-6 sm:space-y-10 sm:p-10">
        <h2 className="text-foreground border-b border-[var(--glass-border)] pb-4 font-sans text-xl font-normal sm:pb-6 sm:text-2xl">
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
 
      <div id="breakdown-section" className="space-y-8 sm:space-y-16">
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
 
        {/* Payment Details */}
        <GlassPanel variant="solid" className="border-sage/10 relative space-y-6 p-6 sm:space-y-8 sm:p-10">
          <div className="via-sage/40 absolute top-0 left-0 h-1.5 w-full bg-linear-to-r from-transparent to-transparent" />
          <h3 className="text-sage text-center text-[10px] font-bold tracking-[0.2em] uppercase sm:tracking-[0.4em]">Settlement Information</h3>
          
          <div className="space-y-6 sm:space-y-8">
            <div className="space-y-1 text-center sm:space-y-2">
              <p className="text-foreground/20 text-[9px] font-bold tracking-[0.2em] uppercase sm:text-[10px] sm:tracking-[0.3em]">Payment Method</p>
              <p className="text-foreground font-serif text-xl font-light tracking-tight sm:text-2xl">{payerBankName || "Not specified"}</p>
            </div>
 
            {payerBankAccount && (
              <div className="space-y-1 text-center sm:space-y-2">
                <p className="text-foreground/20 text-[9px] font-bold tracking-[0.2em] uppercase sm:text-[10px] sm:tracking-[0.3em]">Account Number</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-foreground font-mono text-xl font-semibold tracking-wider sm:text-2xl">
                    {payerBankAccount}
                  </span>
                  <button
                    onClick={handleCopyAccount}
                    className="text-sage cursor-pointer p-1 transition-colors hover:text-foreground"
                    title="Copy Account Number"
                  >
                    {copyAccountSuccess ? (
                      <svg className="text-sage h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            <div className="space-y-1 text-center sm:space-y-2">
              <p className="text-foreground/20 text-[9px] font-bold tracking-[0.2em] uppercase sm:text-[10px] sm:tracking-[0.3em]">Account Owner</p>
              <p className="text-foreground font-sans text-lg font-normal tracking-tight sm:text-xl">{payerName || "Anonymous Payer"}</p>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
