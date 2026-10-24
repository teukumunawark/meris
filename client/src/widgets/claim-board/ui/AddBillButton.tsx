"use client";

import React, { useState, useRef } from "react";
import { useI18n } from "@/shared/i18n";

export interface AddBillButtonProps {
  addBill: (file: File, payerName: string, billName: string) => Promise<string | null>;
}

export function AddBillButton({ addBill }: AddBillButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { m } = useI18n();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setError(await addBill(file, "", ""));
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex flex-col items-end">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="text-sage hover:bg-sage/10 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-[10px] font-bold tracking-widest uppercase transition-colors sm:text-xs"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {isUploading ? m.addBill.reading : m.addBill.button}
      </button>
      {error && (
        <p role="alert" className="max-w-xs px-2 text-right font-sans text-xs text-rose-600 dark:text-rose-300">{error}</p>
      )}
    </div>
  );
}

export default AddBillButton;
