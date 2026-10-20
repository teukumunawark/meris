"use client";

import React, { useState, useRef } from "react";

export interface AddBillButtonProps {
  addBill: (file: File, payerName: string, billName: string) => Promise<boolean>;
}

export function AddBillButton({ addBill }: AddBillButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    await addBill(file, "", "");
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div>
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
        className="text-sage hover:bg-sage/10 flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors sm:text-xs cursor-pointer"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {isUploading ? "Uploading Stop..." : "Add Stop"}
      </button>
    </div>
  );
}

export default AddBillButton;
