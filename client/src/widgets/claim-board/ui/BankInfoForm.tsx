"use client";

import React, { useState } from "react";

export interface ParticipantInfo {
  id: number;
  name: string;
  totalOwed?: number;
  subtotal?: number;
  tax?: number;
  serviceCharge?: number;
  bankName?: string;
  bankAccount?: string;
}

export interface BankInfoFormProps {
  participant: ParticipantInfo;
  onUpdate: (id: number, bank: string, account: string) => Promise<boolean>;
}

export function BankInfoForm({ participant, onUpdate }: BankInfoFormProps) {
  const [bankName, setBankName] = useState(participant.bankName || "");
  const [bankAccount, setBankAccount] = useState(participant.bankAccount || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    const success = await onUpdate(participant.id, bankName.trim(), bankAccount.trim());
    if (success) {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
    setIsSaving(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={bankName}
        onChange={(e) => setBankName(e.target.value)}
        placeholder="Bank or E-Wallet (e.g. BCA, GoPay)"
        className="border-foreground/20 focus:border-sage text-foreground placeholder:text-foreground/20 w-36 border-b bg-transparent px-1 py-0.5 text-xs focus:outline-none"
      />
      <input
        type="text"
        value={bankAccount}
        onChange={(e) => setBankAccount(e.target.value)}
        placeholder="Account / Phone Number"
        className="border-foreground/20 focus:border-sage text-foreground placeholder:text-foreground/20 w-36 border-b bg-transparent px-1 py-0.5 text-xs focus:outline-none"
      />
      <button
        onClick={handleSave}
        disabled={isSaving || (bankName === (participant.bankName || "") && bankAccount === (participant.bankAccount || ""))}
        className="text-sage hover:bg-sage/10 cursor-pointer rounded px-2 py-1 text-[10px] font-bold tracking-wider uppercase transition-colors disabled:opacity-30"
      >
        {isSaving ? "Saving..." : isSaved ? "Saved!" : "Save"}
      </button>
    </div>
  );
}

export default BankInfoForm;
