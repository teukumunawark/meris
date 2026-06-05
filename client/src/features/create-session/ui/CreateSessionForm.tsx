"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import imageCompression from "browser-image-compression";

export default function CreateSessionForm() {
  const router = useRouter();
  const [payerName, setPayerName] = useState("");
  const [payerBankName, setPayerBankName] = useState("");
  const [payerBankAccount, setPayerBankAccount] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setErrorMsg(null);
      if (!payerName.trim()) {
        setErrorMsg("Please enter your name first");
        e.target.value = "";
        return;
      }

      try {
        setIsUploading(true);
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);

        const formData = new FormData();
        formData.append("receipt", compressedFile);
        formData.append("payerName", payerName.trim());
        formData.append("payerBankName", payerBankName.trim());
        formData.append("payerBankAccount", payerBankAccount.trim());

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
        const response = await fetch(`${backendUrl}/session`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          localStorage.setItem("meris_username", payerName.trim());
          if (data.payerToken) {
            localStorage.setItem(
              `meris_session_${data.id}_participant`,
              JSON.stringify({
                id: data.payerId,
                name: payerName.trim(),
                token: data.payerToken,
              })
            );
          }
          router.push(`/session/${data.id}`);
        } else {
          const text = await response.text();
          console.error("Upload failed:", text);
          
          let friendlyMsg = "An unexpected error occurred while processing the receipt. Please try again.";
          if (response.status === 429) {
            try {
              const data = JSON.parse(text);
              friendlyMsg = data.message || "Too many requests. Please try again later.";
            } catch {
              friendlyMsg = "You have exceeded the session creation limit (5 sessions per 8 hours). Please try again later.";
            }
          } else if (text.includes("401") || text.includes("Invalid API Key") || text.includes("invalid_key")) {
            friendlyMsg = "The receipt scanning service is temporarily unavailable. Please try again later.";
          } else if (text.includes("AI extraction failed")) {
            friendlyMsg = "We couldn't parse the receipt details. Please make sure the photo is clear and contains readable items.";
          } else if (text.includes("Failed to save session")) {
            friendlyMsg = "We couldn't create the split bill session. Please try again later.";
          } else if (text.includes("Invalid receipt image") || text.includes("Failed to read image")) {
            friendlyMsg = "The uploaded file is not a valid image. Please choose another photo.";
          }
          
          setErrorMsg(friendlyMsg);
          setIsUploading(false);
        }
      } catch (error) {
        console.error("Error compressing/uploading image:", error);
        setErrorMsg("Unable to connect to the server. Please check your network connection and try again.");
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <input 
          type="text" 
          value={payerName}
          onChange={(e) => setPayerName(e.target.value)}
          placeholder="Your Name (Payer)" 
          className="rounded-glass-sm text-foreground placeholder:text-foreground/20 focus:border-sage/40 w-full border border-white/5 bg-white/2 px-4 py-3 font-sans text-sm transition-colors focus:outline-none"
        />
        <div className="grid grid-cols-[2.5fr_3.5fr] gap-3">
          <input 
            type="text" 
            value={payerBankName}
            onChange={(e) => setPayerBankName(e.target.value)}
            placeholder="Bank (e.g., BCA)" 
            className="rounded-glass-sm text-foreground placeholder:text-foreground/20 focus:border-sage/40 w-full border border-white/5 bg-white/2 px-4 py-3 font-sans text-sm transition-colors focus:outline-none"
          />
          <input 
            type="text" 
            value={payerBankAccount}
            onChange={(e) => setPayerBankAccount(e.target.value)}
            placeholder="Account No / Phone" 
            className="rounded-glass-sm text-foreground placeholder:text-foreground/20 focus:border-sage/40 w-full border border-white/5 bg-white/2 px-4 py-3 font-sans text-sm transition-colors focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div 
          className="group/upload relative cursor-pointer"
          onClick={() => document.getElementById("receipt-upload")?.click()}
        >
          <input 
            type="file" 
            id="receipt-upload" 
            className="hidden" 
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          <div className={`w-full border border-dashed ${isUploading ? "border-sage/50 bg-sage/5" : "group-hover/upload:border-sage/30 group-hover/upload:bg-sage/2 border-white/10 bg-white/1"} rounded-glass-sm flex flex-col items-center gap-3 p-8 transition-all duration-300`}>
            <div className={`bg-sage/10 text-sage flex h-12 w-12 items-center justify-center rounded-full ${!isUploading && "group-hover/upload:scale-105"} transition-transform duration-300`}>
              {isUploading ? (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              )}
            </div>
            <div className="text-center">
              <p className="text-foreground font-sans text-sm font-medium">
                {isUploading ? "Reading Receipt..." : "Upload Receipt Photo"}
              </p>
              <p className="text-foreground/20 mt-1 text-[9px] tracking-widest uppercase">AI Scan Engine</p>
            </div>
          </div>
        </div>
        
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="rounded-glass-sm flex items-start gap-3 border border-rose-500/25 bg-rose-950/20 p-4 text-left font-sans text-sm text-rose-300"
          >
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold text-rose-200">Unable to Start Session</p>
              <p className="mt-1 text-xs leading-relaxed text-rose-300/80">{errorMsg}</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
