"use client";

import React, { useState, useRef } from "react";
import { useI18n } from "@/shared/i18n";

export interface AddBillButtonProps {
  addBill: (file: File, payerName: string, billName: string, skipOcr?: boolean) => Promise<string | null>;
}

export function AddBillButton({ addBill }: AddBillButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { m } = useI18n();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const submitFile = async (file: File, skipOcr: boolean) => {
    setIsUploading(true);
    setError(null);
    const errMsg = await addBill(file, "", "", skipOcr);
    setIsUploading(false);
    if (errMsg) {
      setError(errMsg);
    } else {
      setPendingFile(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setPendingFile(file);
    await submitFile(file, false);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="text-sage hover:bg-sage/10 focus-visible:outline-sage flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-[10px] font-bold tracking-widest uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-xs"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {isUploading ? m.addBill.reading : m.addBill.button}
      </button>

      {error && pendingFile && (
        <div
          role="alert"
          className="rounded-glass-sm w-full max-w-sm space-y-2.5 border border-rose-500/30 bg-rose-950/20 p-3 text-left font-sans text-xs"
        >
          <p className="leading-relaxed text-rose-600 dark:text-rose-200">{error}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => void submitFile(pendingFile, false)}
              className="bg-sage text-background hover:bg-sage/90 focus-visible:outline-sage min-h-9 cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase transition-all focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 disabled:opacity-50"
            >
              {m.addBill.retryButton}
            </button>
            <button
              type="button"
              disabled={isUploading}
              onClick={() => void submitFile(pendingFile, true)}
              className="text-foreground hover:border-sage/40 focus-visible:outline-sage min-h-9 cursor-pointer rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-1.5 text-[11px] font-semibold transition-all hover:bg-[var(--glass-highlight)] focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 disabled:opacity-50"
            >
              {m.addBill.manualFallbackButton}
            </button>
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="text-foreground/70 hover:text-foreground focus-visible:outline-sage min-h-9 cursor-pointer px-2 py-1 text-[11px] underline"
            >
              {m.addBill.changePhotoButton}
            </button>
            <button
              type="button"
              disabled={isUploading}
              onClick={() => {
                setError(null);
                setPendingFile(null);
              }}
              className="text-foreground/50 hover:text-foreground focus-visible:outline-sage min-h-9 cursor-pointer px-2 py-1 text-[11px]"
            >
              {m.addBill.cancelButton}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AddBillButton;
