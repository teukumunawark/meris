"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { prepareReceiptImage } from "@/shared/lib/receiptImage";

import { apiFetch } from "@/shared/api/client";
import { apiErrorMessage, useI18n } from "@/shared/i18n";
import type { components } from "@/shared/api/generated/api";

type SessionCreationResponse = components["schemas"]["SessionCreationResponse"];

export default function CreateSessionForm() {
  const router = useRouter();
  const { m } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedName, setSavedName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("meris_username");
      if (stored) {
        setSavedName(stored.trim());
        setTempName(stored.trim());
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const submitReceipt = async (fileToSubmit: File, skipOcr: boolean) => {
    setErrorMsg(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("receipt", fileToSubmit);
      if (savedName) {
        formData.append("payerName", savedName);
      }
      if (skipOcr) {
        formData.append("skipOcr", "true");
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
      setErrorMsg(apiErrorMessage(err, m, m.createSession.errorFallback));
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (!file) return;

    setErrorMsg(null);
    setIsUploading(true);

    try {
      const compressedFile = await prepareReceiptImage(file);
      setSelectedFile(compressedFile);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(compressedFile);
      });
      await submitReceipt(compressedFile, false);
    } catch (err: unknown) {
      console.error("Image preparation failed:", err);
      setErrorMsg(apiErrorMessage(err, m, m.createSession.errorFallback));
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {savedName && !isEditingName ? (
        <div className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3.5 py-2">
          <p className="text-foreground/75 font-sans text-xs">
            {m.createSession.yourName} <strong className="text-foreground font-semibold">{savedName}</strong>
          </p>
          <button
            type="button"
            onClick={() => {
              setTempName(savedName);
              setIsEditingName(true);
            }}
            className="text-sage cursor-pointer text-xs font-semibold hover:underline"
          >
            {m.createSession.changeName}
          </button>
        </div>
      ) : isEditingName ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-2">
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            placeholder={m.createSession.namePlaceholder}
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
            {m.common.save}
          </button>
          <button
            type="button"
            onClick={() => setIsEditingName(false)}
            className="text-foreground/50 hover:text-foreground cursor-pointer px-2 py-1 text-xs"
          >
            {m.common.cancel}
          </button>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        id="receipt-upload"
        className="hidden"
        accept="image/*"
        onChange={handleFileUpload}
        disabled={isUploading}
      />

      {!errorMsg || !selectedFile ? (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (!isUploading && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className="group/upload focus-visible:outline-sage rounded-glass-sm relative cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
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
                {isUploading ? m.createSession.readingTitle : m.createSession.uploadTitle}
              </p>
              <p className="text-foreground/50 mx-auto max-w-xs font-sans text-xs leading-relaxed">
                {isUploading ? m.createSession.readingHint : m.createSession.uploadHint}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="rounded-glass-sm space-y-4 border border-rose-500/25 bg-rose-950/20 p-4 text-left font-sans text-sm text-rose-300"
        >
          <div className="flex items-start gap-3">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={m.createSession.selectedPhotoAlt}
                className="h-16 w-12 shrink-0 rounded-md border border-[var(--glass-border)] object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="font-semibold text-rose-200">{m.createSession.errorTitle}</p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-rose-300/85">{errorMsg}</p>
            </div>
          </div>

          {selectedFile && (
            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => void submitReceipt(selectedFile, false)}
                className="bg-sage text-background hover:bg-sage/90 focus-visible:outline-sage flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold tracking-wider uppercase transition-all focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 disabled:opacity-50"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
                <span>{isUploading ? m.createSession.readingTitle : m.createSession.retryButton}</span>
              </button>

              <button
                type="button"
                disabled={isUploading}
                onClick={() => void submitReceipt(selectedFile, true)}
                className="text-foreground hover:border-sage/40 focus-visible:outline-sage flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2 text-xs font-semibold transition-all hover:bg-[var(--glass-highlight)] focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 disabled:opacity-50"
              >
                {m.createSession.manualFallbackButton}
              </button>

              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="text-foreground/70 hover:text-foreground focus-visible:outline-sage flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-3 py-2 text-xs font-medium underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
              >
                {m.createSession.changePhotoButton}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
