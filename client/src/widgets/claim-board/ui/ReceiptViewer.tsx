"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/shared/i18n";

export interface ReceiptViewerProps {
  imageUrl: string;
  billName: string;
  isAuthorized: boolean;
  isRescanning: boolean;
  rescanError: string | null;
  onRescan: () => void;
  onClose: () => void;
}

export function ReceiptViewer({
  imageUrl,
  billName,
  isAuthorized,
  isRescanning,
  rescanError,
  onRescan,
  onClose,
}: ReceiptViewerProps) {
  const { m } = useI18n();
  const t = m.billCard;
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imgState, setImgState] = useState<"loading" | "ready" | "error">("loading");
  const dragStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setImgState("loading");
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [imageUrl]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(3, +(prev + 0.5).toFixed(2)));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(1, +(prev - 0.5).toFixed(2));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleZoomReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scale <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const renderCanvas = (heightClass: string) => (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative flex w-full items-start justify-center overflow-auto rounded-lg border border-[var(--glass-border)] bg-black/40 p-2 select-none ${heightClass} ${
        scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
      }`}
    >
      {imgState === "loading" && (
        <div className="text-foreground/60 flex h-48 w-full items-center justify-center text-xs">
          {m.sessionPage.loading}
        </div>
      )}
      {imgState === "error" && (
        <div className="flex h-48 w-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-rose-300">
          <p>{t.receiptLoadError}</p>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={t.receiptAlt(billName)}
        onLoad={() => setImgState("ready")}
        onError={() => setImgState("error")}
        draggable={false}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: "top center",
        }}
        className={`max-w-full rounded object-contain transition-transform duration-100 ${
          imgState === "error" ? "hidden" : "block"
        }`}
      />
    </div>
  );

  const renderControls = (inModal: boolean) => (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={scale <= 1}
          title={t.zoomOut}
          aria-label={t.zoomOut}
          className="text-foreground/75 hover:text-foreground focus-visible:outline-sage flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm font-bold disabled:opacity-30"
        >
          −
        </button>
        <button
          type="button"
          onClick={handleZoomReset}
          title={t.zoomReset}
          className="text-foreground/75 hover:text-foreground focus-visible:outline-sage flex h-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2.5 font-mono text-xs"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          disabled={scale >= 3}
          title={t.zoomIn}
          aria-label={t.zoomIn}
          className="text-foreground/75 hover:text-foreground focus-visible:outline-sage flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm font-bold disabled:opacity-30"
        >
          +
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {isAuthorized && (
          <button
            type="button"
            onClick={onRescan}
            disabled={isRescanning}
            className="border-sage/40 bg-sage/10 text-sage hover:bg-sage/20 focus-visible:outline-sage flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <svg
              className={`h-3.5 w-3.5 ${isRescanning ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
            <span>{isRescanning ? t.rescanningAi : t.rescanAi}</span>
          </button>
        )}

        {!inModal ? (
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="text-foreground/75 hover:text-foreground focus-visible:outline-sage flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2.5 text-xs font-medium"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
            <span>{t.fullscreenReceipt}</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => (inModal ? setIsFullscreen(false) : onClose())}
          className="text-foreground/75 hover:text-foreground focus-visible:outline-sage flex h-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-xs font-semibold"
        >
          {m.common.close}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3">
        {renderControls(false)}
        {rescanError && (
          <p role="alert" className="text-xs text-rose-500 dark:text-rose-300">
            {rescanError}
          </p>
        )}
        {renderCanvas("max-h-[420px] md:max-h-[580px]")}
      </div>

      {isFullscreen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.receiptAlt(billName)}
            className="fixed inset-0 z-[120] flex flex-col bg-black/85 p-3 backdrop-blur-xs sm:p-6"
          >
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-3 overflow-hidden">
              <div className="bg-background/95 rounded-xl border border-[var(--glass-border)] p-3">
                {renderControls(true)}
                {rescanError && (
                  <p role="alert" className="mt-2 text-xs text-rose-500 dark:text-rose-300">
                    {rescanError}
                  </p>
                )}
              </div>
              <div className="flex-1 overflow-hidden">{renderCanvas("h-full max-h-[82dvh]")}</div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default ReceiptViewer;
