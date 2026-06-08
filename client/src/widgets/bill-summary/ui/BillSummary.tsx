"use client";

import React, { useState, useEffect } from "react";
import ParticipantBreakdown from "@/entities/participant/ui/ParticipantBreakdown";
import { useSession } from "@/entities/session";
import { useRemoveParticipant } from "@/features/remove-participant";
import { GlassPanel } from "@/shared/ui/GlassPanel";
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";
import { formatRupiah, getAvatarBg, getInitials } from "@/shared/lib";
import { apiFetch } from "@/shared/api/client";

export default function BillSummary() {
  const { 
    sessionId,
    participantToken,
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
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [editBank, setEditBank] = useState(payerBankName);
  const [editAccount, setEditAccount] = useState(payerBankAccount);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setEditBank(payerBankName);
    setEditAccount(payerBankAccount);
  }, [payerBankName, payerBankAccount]);

  const handleCopyAccount = () => {
    if (typeof window !== "undefined" && payerBankAccount) {
      navigator.clipboard.writeText(payerBankAccount);
      setCopyAccountSuccess(true);
      setTimeout(() => setCopyAccountSuccess(false), 2000);
    }
  };

  const handleUpdatePaymentInfo = async () => {
    try {
      setIsUpdating(true);
      await apiFetch(`/session/${sessionId}/payment-info`, {
        method: "PUT",
        body: JSON.stringify({
          payerBankName: editBank,
          payerBankAccount: editAccount,
          token: participantToken,
        }),
      });
      setIsEditingPayment(false);
    } catch (err) {
      console.error("Failed to update payment info:", err);
    } finally {
      setIsUpdating(false);
    }
  };

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
 
        {/* Payment Details */}
        <GlassPanel variant="solid" className="border-sage/10 relative space-y-6 p-6 sm:space-y-8 sm:p-10">
          <div className="via-sage/40 absolute top-0 left-0 h-1.5 w-full bg-linear-to-r from-transparent to-transparent" />
          
          <div className="relative flex items-center justify-center">
            <h3 className="text-sage text-center font-sans text-[10px] font-bold tracking-[0.2em] uppercase sm:tracking-[0.4em]">Settlement Information</h3>
            {isPayer && !isEditingPayment && (
              <button 
                onClick={() => setIsEditingPayment(true)}
                className="text-foreground/30 hover:text-sage absolute right-0 transition-colors"
                title="Edit Payment Info"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>
          
          {isEditingPayment ? (
            <div className="mx-auto max-w-sm space-y-5 pt-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-foreground/40 block text-[10px] font-bold tracking-[0.15em] uppercase sm:text-xs">Bank Name</label>
                  <Input 
                    value={editBank}
                    onChange={(e) => setEditBank(e.target.value)}
                    placeholder="e.g. BCA, Mandiri"
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-foreground/40 block text-[10px] font-bold tracking-[0.15em] uppercase sm:text-xs">Account Number</label>
                  <Input 
                    value={editAccount}
                    onChange={(e) => setEditAccount(e.target.value)}
                    placeholder="e.g. 12345678"
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex justify-center gap-3 pt-4 sm:pt-6">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setIsEditingPayment(false);
                    setEditBank(payerBankName);
                    setEditAccount(payerBankAccount);
                  }}
                  disabled={isUpdating}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleUpdatePaymentInfo}
                  disabled={isUpdating}
                  className="px-6"
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-8 sm:space-y-12">
              <div className="space-y-2 text-center sm:space-y-3">
                <p className="text-foreground/20 text-[10px] font-bold tracking-[0.2em] uppercase sm:text-xs sm:tracking-[0.3em]">Payment Method</p>
                {payerBankName ? (
                  <p className="text-foreground font-sans text-lg font-medium tracking-tight sm:text-2xl">{payerBankName}</p>
                ) : (
                  <p className="text-foreground/30 font-sans text-sm font-normal italic sm:text-base">Not specified</p>
                )}
              </div>
  
              {payerBankAccount && (
                <div className="space-y-2 text-center sm:space-y-3">
                  <p className="text-foreground/20 text-[10px] font-bold tracking-[0.2em] uppercase sm:text-xs sm:tracking-[0.3em]">Account Number</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-foreground font-mono text-xl font-semibold tracking-wider sm:text-3xl">
                      {payerBankAccount}
                    </span>
                    <button
                      onClick={handleCopyAccount}
                      className="text-sage hover:bg-sage/10 rounded-full p-2 transition-all hover:scale-110 active:scale-95"
                      title="Copy Account Number"
                    >
                      {copyAccountSuccess ? (
                        <svg className="text-sage h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M20 6 9 17l-5-5"/>
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
              
              <div className="space-y-2 text-center sm:space-y-3">
                <p className="text-foreground/20 text-[10px] font-bold tracking-[0.2em] uppercase sm:text-xs sm:tracking-[0.3em]">Account Owner</p>
                <p className="text-foreground font-sans text-lg font-medium tracking-tight sm:text-xl">{payerName || "Anonymous Payer"}</p>
              </div>
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
