"use client";

import React, { useId, useState } from "react";
import { useI18n } from "@/shared/i18n";

export interface ParticipantInfo {
  id: number;
  name: string;
  totalOwed?: number;
  subtotal?: number;
  tax?: number;
  serviceCharge?: number;
  discount?: number;
  otherCharges?: number;
  bankName?: string;
  bankAccount?: string;
}

export interface BankInfoFormProps {
  participant: ParticipantInfo;
  onUpdate: (id: number, bank: string, account: string) => Promise<boolean>;
}

const inputClass =
  "rounded-glass-sm text-foreground placeholder:text-foreground/50 focus:border-sage min-h-11 w-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 font-sans text-base focus:outline-none sm:text-sm";

export function BankInfoForm({ participant, onUpdate }: BankInfoFormProps) {
  const { m } = useI18n();
  const bankId = useId();
  const accountId = useId();
  const [bankName, setBankName] = useState(participant.bankName || "");
  const [bankAccount, setBankAccount] = useState(participant.bankAccount || "");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");

  const unchanged = bankName === (participant.bankName || "") && bankAccount === (participant.bankAccount || "");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const success = await onUpdate(participant.id, bankName.trim(), bankAccount.trim());
    setStatus(success ? "saved" : "failed");
    if (success) setTimeout(() => setStatus("idle"), 2000);
    setIsSaving(false);
  };

  return (
    <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="space-y-1">
        <label htmlFor={bankId} className="text-foreground/75 block font-sans text-xs">{m.bankForm.bankLabel}</label>
        <input
          id={bankId}
          type="text"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          placeholder={m.bankForm.bankPlaceholder}
          autoComplete="off"
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={accountId} className="text-foreground/75 block font-sans text-xs">{m.bankForm.accountLabel}</label>
        <input
          id={accountId}
          type="text"
          inputMode="numeric"
          value={bankAccount}
          onChange={(e) => setBankAccount(e.target.value)}
          autoComplete="off"
          className={`${inputClass} tabular-nums`}
        />
      </div>
      <button
        type="submit"
        disabled={isSaving || unchanged}
        className="bg-sage text-background rounded-glass-sm focus-visible:outline-sage min-h-11 cursor-pointer px-4 font-sans text-sm font-semibold transition-all hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSaving ? m.common.saving : m.common.save}
      </button>
      <p aria-live="polite" className="font-sans text-xs sm:col-span-3">
        {status === "saved" && <span className="text-sage">{m.bankForm.saved}</span>}
        {status === "failed" && <span className="text-rose-600 dark:text-rose-300">{m.bankForm.failed}</span>}
      </p>
    </form>
  );
}

export default BankInfoForm;
