"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/entities/session";
import { useJoinSession } from "@/features/join-session";
import { useClaimItem } from "@/features/claim-item";
import { useRenameItem } from "@/features/rename-item";
import { Button } from "@/shared/ui/Button";
import { GlassPanel } from "@/shared/ui/GlassPanel";
import { formatRupiah, getInitials } from "@/shared/lib";
import { useManageItems } from "@/features/manage-items";
import { useOnboarding } from "@/shared/hooks";
import type { ReceiptItem } from "@/shared/types";
import { BillGroupCard } from "./BillGroupCard";
import { BankInfoForm } from "./BankInfoForm";
import { AddBillButton } from "./AddBillButton";

export default function ClaimBoard() {
  const {
    sessionId,
    isJoined,
    userName,
    setUserName,
    items,
    payerName,
    participants,
    bills
  } = useSession();

  const { joinSession, changeName, joinError } = useJoinSession();
  const { updateClaim } = useClaimItem();
  const { renameItem } = useRenameItem();
  const { addItem, addBill, updateBill, deleteBill, updateParticipantBank } = useManageItems();
  const { showJoinHint, showClaimHint, completeJoinHint, completeClaimHint } = useOnboarding();

  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [copyCodeSuccess, setCopyCodeSuccess] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (isJoined) {
      completeJoinHint();
    }
  }, [isJoined, completeJoinHint]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleCopyCode = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
      setCopyCodeSuccess(true);
      setTimeout(() => setCopyCodeSuccess(false), 2000);
    }
  };

  const shortenId = (id: string) => {
    if (id.length <= 12) return id;
    return `${id.slice(0, 6)}...${id.slice(-6)}`;
  };

  const handleAddItem = async () => {
    const price = parseFloat(newItemPrice);
    const qty = parseInt(newItemQty);
    if (!newItemName.trim() || isNaN(price) || isNaN(qty)) return;

    setIsSaving(true);
    const success = await addItem(newItemName.trim(), price, qty);
    if (success) {
      setIsAdding(false);
      setNewItemName("");
      setNewItemPrice("");
      setNewItemQty("1");
    }
    setIsSaving(false);
  };

  const totalSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalClaimedSubtotal = items.reduce((sum, item) => {
    const claimedShares = item.claims.reduce((s, c) => s + c.shares, 0);
    return sum + item.price * claimedShares;
  }, 0);
  const claimProgressPercent = totalSubtotal > 0 ? Math.round((totalClaimedSubtotal / totalSubtotal) * 100) : 0;

  const isPayer = isJoined && userName.trim().toLowerCase() === payerName.trim().toLowerCase();
  const sessionTitle = bills[0]?.name?.trim() || "Tagihan Bersama";

  const sortedItems = React.useMemo(() => {
    const result: Array<ReceiptItem & { depth: number }> = [];
    const visited = new Set<string>();

    const addRecursive = (parentId?: string, depth: number = 0) => {
      const children = items.filter(it => it.parentId === parentId);
      children.forEach(child => {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          result.push({ ...child, depth });
          addRecursive(child.id, depth + 1);
        }
      });
    };

    addRecursive(undefined, 0);

    // Add any remaining items (safety for orphans or cycles)
    items.forEach(item => {
      if (!visited.has(item.id)) {
        visited.add(item.id);
        result.push({ ...item, depth: 0 });
      }
    });

    return result;
  }, [items]);

  const firstUnclaimedItem = sortedItems.find(item => {
    const isZeroPriceSubItem = !!item.parentId && item.price === 0;
    if (isZeroPriceSubItem) return false;
    return item.quantity > item.claims.reduce((s, c) => s + c.shares, 0);
  });
  const firstUnclaimedId = firstUnclaimedItem?.id;

  const isShowJoinSpotlight = !isJoined && showJoinHint;
  const isShowClaimSpotlight = isJoined && showClaimHint && firstUnclaimedId !== undefined;
  const isSpotlightActive = isShowJoinSpotlight || isShowClaimSpotlight;

  const mobileInputRef = React.useRef<HTMLInputElement>(null);
  const desktopInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isShowJoinSpotlight) {
      setTimeout(() => {
        if (mobileInputRef.current && mobileInputRef.current.offsetParent !== null) {
          mobileInputRef.current.focus();
        } else if (desktopInputRef.current && desktopInputRef.current.offsetParent !== null) {
          desktopInputRef.current.focus();
        } else {
          mobileInputRef.current?.focus();
          desktopInputRef.current?.focus();
        }
      }, 500);
    }
  }, [isShowJoinSpotlight]);

  const unassignedItems = React.useMemo(() => {
    return sortedItems.filter(it => !bills.some(b => b.id === it.billId));
  }, [sortedItems, bills]);

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Cinematic Spotlight Backdrop */}
      <AnimatePresence>
        {isSpotlightActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            onClick={() => {
              completeJoinHint();
              completeClaimHint();
            }}
            className="pointer-events-auto fixed top-0 left-0 z-40 h-[100dvh] w-[100vw] cursor-pointer bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Mobile Header: Store Title, Payer Subtitle & Clean User Status */}
      <section className="flex flex-col gap-3 md:hidden">
        <div className="space-y-1">
          <h1 className="text-foreground font-serif text-2xl font-normal tracking-tight sm:text-3xl">
            {sessionTitle}
          </h1>
          <p className="text-foreground/60 font-sans text-xs">
            {payerName ? `Dibayar oleh ${payerName}` : "Belum ditentukan pembayar"} · Total {formatRupiah(totalSubtotal)}
          </p>
        </div>

        {/* User Status Bar if Joined */}
        {isJoined ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="bg-sage text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                {getInitials(userName)}
              </div>
              <p className="text-foreground/85 truncate font-sans text-xs">
                <span className="text-foreground font-semibold">{userName}</span>
                <span className="text-foreground/40 ml-1">(Anda)</span>
              </p>
              <button
                onClick={changeName}
                className="text-foreground/40 hover:text-sage ml-1 cursor-pointer text-[11px] underline transition-colors"
                title="Ganti Nama"
              >
                Ganti
              </button>
            </div>

            <button
              onClick={handleCopyLink}
              className="text-sage hover:bg-sage/10 border-sage/30 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all active:scale-95"
            >
              {copySuccess ? (
                <>
                  <svg className="text-sage h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <svg className="text-sage h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Bagikan</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Prominent Onboarding Card if not joined */
          <div className={`border-sage/30 bg-sage/5 rounded-2xl border p-4 transition-all duration-500 sm:p-5 ${isShowJoinSpotlight ? "ring-sage/40 relative z-50 ring-2" : ""}`}>
            <div className="mb-2.5 flex flex-col gap-0.5">
              <span className="text-sage text-xs font-bold tracking-wider uppercase">
                {payerName ? "Mulai Klaim Menu" : "Siapa yang membayar struk ini?"}
              </span>
              <p className="text-foreground/60 text-xs">
                {payerName 
                  ? "Masukkan namamu untuk memilih makanan atau minuman pesananmu." 
                  : "Masukkan namamu untuk memulai pembagian tagihan."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                ref={mobileInputRef}
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Ketik namamu..."
                maxLength={20}
                className="text-foreground placeholder:text-foreground/30 focus:border-sage flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3.5 py-2 text-base transition-colors focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") joinSession(userName);
                }}
                autoFocus={isShowJoinSpotlight}
              />
              <button
                onClick={() => joinSession(userName)}
                disabled={!userName.trim()}
                className="bg-sage text-background hover:bg-sage/90 flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold tracking-wider uppercase shadow-sm transition-all active:scale-95 disabled:opacity-30"
              >
                <span>Gabung</span>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            {joinError && (
              <p className="mt-2 font-sans text-xs text-rose-400">{joinError}</p>
            )}
          </div>
        )}
      </section>

      {/* Desktop Header Banner */}
      <GlassPanel className={`hidden p-8 transition-all duration-700 md:block ${isShowJoinSpotlight ? 'relative z-50 bg-(--glass-bg-solid)' : ''}`}>
        <div className="bg-orb-sage pointer-events-none absolute top-0 right-0 h-96 w-96 opacity-10 blur-[150px]" />
        
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-6">
            <div>
              <h1 className="text-foreground font-serif text-3xl leading-tight tracking-tight lg:text-4xl">
                {sessionTitle}
              </h1>
              <p className="text-foreground/50 mt-1 font-sans text-xs">
                {payerName ? `Dibayar oleh ${payerName}` : "Belum ditentukan pembayar"} · Total {formatRupiah(totalSubtotal)}
              </p>
            </div>
            
            <Button
              onClick={handleCopyLink}
              variant="ghost"
              className="flex shrink-0 items-center justify-center gap-2 px-5 py-3"
            >
              {copySuccess ? (
                <>
                  <svg className="text-sage h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                  <span className="text-sage">Copied</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span className="whitespace-nowrap">Share Session</span>
                </>
              )}
            </Button>
          </div>

          <div className="h-px w-full bg-(--glass-border)" />

          <div className="relative flex flex-col justify-between gap-4 font-sans text-sm md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <span className="text-sage font-mono font-bold tracking-wider select-all">{shortenId(sessionId)}</span>
              <button
                onClick={handleCopyCode}
                className="text-foreground/40 hover:text-sage flex cursor-pointer items-center gap-1 rounded-sm border border-(--glass-border) bg-(--glass-bg) px-2 py-1 font-mono text-[9px] font-bold tracking-wider uppercase transition-colors"
                title="Copy Session Code"
              >
                {copyCodeSuccess ? (
                  <>
                    <svg className="text-sage h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                    <span className="text-sage">Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            <div className="hidden h-4 w-px bg-(--glass-border) md:block" />

            <div className="flex min-w-0 justify-start md:justify-end">
              {isJoined ? (
                <div className="flex min-w-0 flex-row items-center gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div 
                      className="bg-sage text-background flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-inner"
                    >
                      {getInitials(userName)}
                    </div>
                    <p className="text-foreground/70 truncate whitespace-nowrap">
                      You are participating as <span className="text-foreground font-bold">{userName}</span>
                    </p>
                  </div>
                  <button
                    onClick={changeName}
                    className="text-foreground/60 shrink-0 cursor-pointer rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3.5 py-1.5 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase transition-all hover:bg-[var(--glass-highlight)] active:scale-95"
                  >
                    Switch Account
                  </button>
                </div>
              ) : (
                <div className={`relative flex flex-col items-end gap-1 transition-all duration-700 ${isShowJoinSpotlight ? 'scale-105' : ''}`}>
                  {isShowJoinSpotlight && (
                    <div className="absolute -top-6 -right-0.5 z-20 animate-[bounce_2s_infinite]">
                      <div className="bg-sage text-background flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-bold tracking-[0.2em] whitespace-nowrap uppercase shadow-[0_4px_15px_rgba(var(--sage-rgb),0.4)]">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M19 12l-7 7-7-7"/></svg>
                        Start Here
                      </div>
                    </div>
                  )}
                  <div className="flex min-w-[320px] flex-row items-end gap-4">
                    <div className="flex flex-1 flex-col gap-1">
                      <p className="text-foreground/30 text-[10px] font-bold tracking-[0.2em] uppercase">{payerName ? "Who are you?" : "Who paid this bill?"}</p>
                      <input
                        type="text"
                        ref={desktopInputRef}
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder={payerName ? "Enter Your Name..." : "Enter your name (Payer)..."}
                        maxLength={20}
                        className="text-foreground placeholder:text-foreground/20 border-foreground/20 focus:border-sage w-full border-b bg-transparent pb-1.5 font-serif text-2xl font-light tracking-tight transition-colors focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") joinSession(userName);
                        }}
                        autoFocus={isShowJoinSpotlight}
                      />
                    </div>
                    <button
                      onClick={() => joinSession(userName)}
                      disabled={!userName.trim()}
                      className="bg-foreground text-background hover:bg-sage flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-full px-6 text-[10px] font-bold tracking-[0.2em] whitespace-nowrap uppercase shadow-md transition-all active:scale-95 disabled:opacity-30"
                      aria-label="Join Session"
                    >
                      {payerName ? "Join" : "Claim as Payer"}
                      <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                  {joinError && (
                    <p className="absolute right-0 -bottom-5 font-sans text-[10px] whitespace-nowrap text-rose-400">{joinError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* Modern Continuous Progress Bar */}
      <section className="space-y-2">
        <div className="flex items-center justify-between font-sans text-xs">
          <span className="text-foreground/70 font-medium">Progres Klaim</span>
          <span className="text-foreground/85 font-mono">
            <strong className="text-sage font-bold">{claimProgressPercent}%</strong>
            <span className="text-foreground/40 ml-1.5 text-[11px]">
              ({formatRupiah(totalClaimedSubtotal)} / {formatRupiah(totalSubtotal)})
            </span>
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)]">
          <div
            className="bg-sage h-full rounded-full shadow-[0_0_10px_rgba(var(--sage-rgb),0.35)] transition-all duration-700 ease-out"
            style={{ width: `${claimProgressPercent}%` }}
          />
        </div>
      </section>

      {/* Mobile Participants Bar (Compact Avatar Chips) */}
      <section className="space-y-2 md:hidden">
        <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-2">
          <div className="flex items-center gap-1.5">
            <h2 className="text-foreground font-sans text-xs font-semibold">Peserta</h2>
            <span className="text-foreground/40 font-mono text-[11px]">
              ({participants.length})
            </span>
          </div>
          <button
            onClick={handleCopyLink}
            className="text-sage hover:bg-sage/10 border-sage/25 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            Undang Teman
          </button>
        </div>

        {/* Horizontal Participant Avatar Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {participants.map((p) => {
            const isMe = isJoined && p.name === userName;
            return (
              <div
                key={p.id}
                className={`rounded-glass-sm flex items-center gap-1.5 border px-2.5 py-1 text-xs transition-colors ${
                  isMe
                    ? "border-sage/40 bg-sage/10 text-sage"
                    : "text-foreground/75 border-[var(--glass-border)] bg-[var(--glass-bg)]"
                }`}
              >
                <div className="bg-sage text-background flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold">
                  {getInitials(p.name)}
                </div>
                <span className="max-w-[90px] truncate font-medium">
                  {p.name}
                </span>
                {isMe && <span className="text-[10px] opacity-75">(Anda)</span>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Desktop Participants Roster Grid */}
      <section className="hidden space-y-4 sm:space-y-6 md:block">
        <div className="flex items-end justify-between border-b border-[var(--glass-border)] pb-3 sm:pb-4">
          <h2 className="text-foreground font-sans text-lg font-normal tracking-tight sm:text-xl md:text-2xl">Participants</h2>
          <span className="text-foreground/20 text-[10px] font-bold tracking-[0.2em] uppercase sm:text-xs sm:tracking-[0.3em]">
            {participants.length} people
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {participants.map((p) => {
            const isMe = isJoined && p.name === userName;
            return (
              <GlassPanel key={p.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-sage text-background flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-inner">
                    {getInitials(p.name)}
                  </div>
                  <div>
                    <h3 className="text-foreground font-sans text-sm font-bold">
                      {p.name} {isMe && <span className="text-sage ml-1 font-sans text-xs font-normal">(You)</span>}
                    </h3>
                    <p className="text-foreground/40 font-mono text-[10px]">
                      Subtotal: {formatRupiah(p.subtotal || 0)} | Total Owed: {formatRupiah(p.totalOwed || 0)}
                    </p>
                  </div>
                </div>
                
                {/* Bank Details Input */}
                <div className="mt-1 space-y-1 border-t border-[var(--glass-border)] pt-2">
                  <p className="text-foreground/30 text-[9px] font-bold tracking-wider uppercase">Settlement Account</p>
                  {isMe ? (
                    <BankInfoForm participant={p} onUpdate={updateParticipantBank} />
                  ) : (
                    <div className="text-foreground/70 font-sans text-xs">
                      {p.bankName ? (
                        <span>
                          <strong className="text-foreground font-semibold">{p.bankName}</strong>: {p.bankAccount}
                        </span>
                      ) : (
                        <span className="text-foreground/30 italic">No bank or e-wallet account listed</span>
                      )}
                    </div>
                  )}
                </div>
              </GlassPanel>
            );
          })}
        </div>
      </section>

      {/* Inventory Items List */}
      <div className={`space-y-4 transition-all duration-700 sm:space-y-6 ${isShowClaimSpotlight ? 'relative z-50' : ''}`}>
        <div className="flex items-end justify-between border-b border-[var(--glass-border)] pb-3 sm:pb-4">
          <h2 className="text-foreground font-sans text-lg font-normal tracking-tight sm:text-xl md:text-2xl">Bill Items</h2>
          <div className="flex items-center gap-4">
            {isJoined && (
              <AddBillButton addBill={addBill} />
            )}
            {isPayer && (
              <button
                onClick={() => setIsAdding(true)}
                className="text-sage hover:bg-sage/10 flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors sm:text-xs"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Item
              </button>
            )}
            <span className="text-foreground/20 text-[10px] font-bold tracking-[0.2em] uppercase sm:text-xs sm:tracking-[0.3em]">{items.length} items</span>
          </div>
        </div>

        {isAdding && (
          <GlassPanel className="animate-in fade-in slide-in-from-top-4 relative overflow-hidden p-5 sm:p-8">
            <div className="from-sage/10 pointer-events-none absolute inset-0 bg-linear-to-r to-transparent opacity-50" />
            
            <div className="relative z-10 flex flex-1 flex-col gap-5 py-2 sm:gap-8">
              <div className="group/input relative w-full">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="New Item Name..."
                  className="text-foreground placeholder:text-foreground/20 border-foreground/20 focus:border-sage w-full border-b border-dashed bg-transparent pb-1.5 font-sans text-xl font-normal tracking-tight transition-all focus:border-solid focus:outline-none sm:text-2xl md:text-3xl"
                  autoFocus
                />
              </div>
              
              <div className="flex flex-wrap items-center gap-x-8 gap-y-6">
                <div className="group/input relative flex items-center gap-3">
                  <span className="text-foreground/30 text-[10px] font-bold tracking-[0.2em] uppercase">Qty</span>
                  <input
                    type="number"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    placeholder="1"
                    className="text-foreground border-foreground/20 focus:border-sage w-12 border-b border-dashed bg-transparent pb-1 text-center font-mono text-lg transition-all focus:border-solid focus:outline-none sm:text-xl"
                  />
                </div>
                
                <div className="group/input relative flex items-center gap-3">
                  <span className="text-foreground/30 text-[10px] font-bold tracking-[0.2em] uppercase">Price</span>
                  <div className="border-foreground/20 focus-within:border-sage flex items-center gap-1 border-b border-dashed pb-1 transition-all focus-within:border-solid">
                    <span className="text-foreground/40 font-mono text-lg sm:text-xl">Rp</span>
                    <input
                      type="number"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      placeholder="0"
                      className="text-foreground w-24 bg-transparent font-mono text-lg focus:outline-none sm:w-32 sm:text-xl"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-foreground/30 text-[10px] font-bold tracking-[0.2em] uppercase">Total</span>
                  <span className="text-sage text-glow-sage font-mono text-lg font-bold sm:text-xl">
                    {formatRupiah((parseFloat(newItemPrice) || 0) * (parseInt(newItemQty) || 0))}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button 
                  onClick={handleAddItem} 
                  disabled={isSaving}
                  className="bg-foreground text-background hover:bg-sage cursor-pointer rounded-full px-6 py-2.5 text-[10px] font-bold tracking-[0.2em] uppercase shadow-md transition-all hover:text-white active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? "Adding..." : "Add to Inventory"}
                </button>
                <button 
                  onClick={() => setIsAdding(false)} 
                  disabled={isSaving}
                  className="text-foreground/40 hover:text-foreground cursor-pointer px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </GlassPanel>
        )}

        {bills.length === 0 && unassignedItems.length === 0 && !isAdding ? (
          <GlassPanel className="border-dashed border-[var(--glass-border)] p-12 text-center sm:p-20">
            <div className="mx-auto max-w-sm space-y-2">
              <p className="text-foreground/70 font-sans text-base font-medium">No items in this session yet</p>
              <p className="text-foreground/30 font-sans text-xs leading-relaxed">
                Add a bill receipt or enter items manually to start splitting with your group.
              </p>
            </div>
          </GlassPanel>
        ) : (
          <div className="space-y-6">
            {/* Render items grouped by Bill */}
            {bills.map((bill) => {
              const billItems = sortedItems.filter(item => item.billId === bill.id);
              return (
                <BillGroupCard
                  key={bill.id}
                  bill={bill}
                  items={billItems}
                  isSingleBill={bills.length <= 1}
                  isJoined={isJoined}
                  userName={userName}
                  sessionPayerName={payerName}
                  updateBill={updateBill}
                  deleteBill={deleteBill}
                  firstUnclaimedId={firstUnclaimedId}
                  showClaimHint={showClaimHint}
                  completeClaimHint={completeClaimHint}
                  updateClaim={updateClaim}
                  renameItem={renameItem}
                />
              );
            })}

            {/* Render unassigned items if any */}
            {unassignedItems.length > 0 && (
              <BillGroupCard
                bill={{
                  id: "",
                  name: "Other Unassigned Items",
                  payerName,
                  tax: 0,
                  serviceCharge: 0,
                  grandTotal: unassignedItems.reduce((s, it) => s + it.price * it.quantity, 0),
                  createdAt: ""
                }}
                items={unassignedItems}
                isSingleBill={bills.length === 0}
                isJoined={isJoined}
                userName={userName}
                sessionPayerName={payerName}
                updateBill={async () => false}
                deleteBill={async () => false}
                firstUnclaimedId={firstUnclaimedId}
                showClaimHint={showClaimHint}
                completeClaimHint={completeClaimHint}
                updateClaim={updateClaim}
                renameItem={renameItem}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
