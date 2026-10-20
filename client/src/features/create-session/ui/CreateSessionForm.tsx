"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import imageCompression from "browser-image-compression";

import { apiFetch } from "@/shared/api/client";
import type { components } from "@/shared/api/generated/api";

type SessionCreationResponse = components["schemas"]["SessionCreationResponse"];

export default function CreateSessionForm() {
  const router = useRouter();
  const [savedName, setSavedName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("meris_username");
      if (stored) {
        setSavedName(stored.trim());
        setTempName(stored.trim());
      }
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setErrorMsg(null);

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
        if (savedName) {
          formData.append("payerName", savedName);
        }

        const data = await apiFetch<SessionCreationResponse>("/session", {
          method: "POST",
          body: formData,
        });

        if (savedName) {
          localStorage.setItem("meris_username", savedName);
        }
        if (data.payerToken && data.id) {
          localStorage.setItem(
            `meris_session_${data.id}_participant`,
            JSON.stringify({
              id: data.payerId,
              name: savedName || "Host",
              token: data.payerToken,
            })
          );
        }
        if (data.id) {
          router.push(`/session/${data.id}`);
        }
      } catch (err: unknown) {
        console.error("Upload failed:", err);
        const message = err instanceof Error ? err.message : "Struk tidak terbaca jelas. Pastikan foto terang dan daftar menu terlihat, lalu coba lagi.";
        setErrorMsg(message);
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      {savedName && !isEditingName ? (
        <div className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3.5 py-2">
          <p className="text-foreground/75 font-sans text-xs">
            Nama Anda: <strong className="text-foreground font-semibold">{savedName}</strong>
          </p>
          <button
            type="button"
            onClick={() => {
              setTempName(savedName);
              setIsEditingName(true);
            }}
            className="text-sage cursor-pointer text-xs font-semibold hover:underline"
          >
            Ganti
          </button>
        </div>
      ) : isEditingName ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-2">
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            placeholder="Ketik namamu..."
            className="text-foreground flex-1 bg-transparent px-2.5 py-1 text-xs focus:outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              const trimmed = tempName.trim();
              if (trimmed) {
                localStorage.setItem("meris_username", trimmed);
                setSavedName(trimmed);
              } else {
                localStorage.removeItem("meris_username");
                setSavedName("");
              }
              setIsEditingName(false);
            }}
            className="bg-sage text-background cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold"
          >
            Simpan
          </button>
          <button
            type="button"
            onClick={() => setIsEditingName(false)}
            className="text-foreground/50 hover:text-foreground cursor-pointer px-2 py-1 text-xs"
          >
            Batal
          </button>
        </div>
      ) : null}

      <div 
        className="group/upload relative cursor-pointer"
        onClick={() => !isUploading && document.getElementById("receipt-upload")?.click()}
      >
        <input 
          type="file" 
          id="receipt-upload" 
          className="hidden" 
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          disabled={isUploading}
        />
        <div className={`w-full border-2 border-dashed ${isUploading ? "border-sage/50 bg-sage/5" : "group-hover/upload:border-sage/40 group-hover/upload:bg-sage/5 border-[var(--glass-border)] bg-[var(--glass-bg)]"} rounded-glass-sm flex flex-col items-center justify-center gap-3.5 p-7 transition-all duration-300 active:scale-[0.99] sm:p-10`}>
          <div className={`bg-sage/10 text-sage flex h-14 w-14 items-center justify-center rounded-full shadow-inner sm:h-16 sm:w-16 ${!isUploading && "group-hover/upload:scale-105"} transition-transform duration-300`}>
            {isUploading ? (
              <svg className="text-sage h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
              </svg>
            ) : (
              <svg className="text-sage h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            )}
          </div>
          <div className="space-y-1 text-center">
            <p className="text-foreground font-sans text-base font-semibold tracking-tight sm:text-lg">
              {isUploading ? "Membaca struk..." : "Foto atau Unggah Struk"}
            </p>
            <p className="text-foreground/50 mx-auto max-w-xs font-sans text-xs leading-relaxed">
              {isUploading
                ? "Mengekstrak daftar menu dan harga..."
                : "Ambil foto struk langsung atau pilih gambar dari galeri perangkatmu."}
            </p>
          </div>
        </div>
      </div>
      
      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="rounded-glass-sm flex items-start gap-3 border border-rose-500/25 bg-rose-950/20 p-3.5 text-left font-sans text-sm text-rose-300 sm:p-4"
        >
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-semibold text-rose-200">Struk Tidak Terbaca</p>
            <p className="mt-1 text-xs leading-relaxed text-rose-300/80">{errorMsg}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
