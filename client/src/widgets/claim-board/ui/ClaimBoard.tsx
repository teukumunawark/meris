"use client";

import React, { useState } from "react";
import { ItemCard } from "@/entities/item";
import { useSession } from "@/entities/session";
import { useJoinSession } from "@/features/join-session";
import { useClaimItem } from "@/features/claim-item";
import { useRenameItem } from "@/features/rename-item";
import { Button } from "@/shared/ui/Button";
import { GlassPanel } from "@/shared/ui/GlassPanel";
import { Input } from "@/shared/ui/Input";
import { formatRupiah, getInitials } from "@/shared/lib";
import { useManageItems } from "@/features/manage-items";

export default function ClaimBoard() {
  const { sessionId, isJoined, userName, setUserName, items, payerName } = useSession();
  const { joinSession, changeName, joinError } = useJoinSession();
  const { updateClaim } = useClaimItem();
  const { renameItem } = useRenameItem();
  const { addItem } = useManageItems();

  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [copyCodeSuccess, setCopyCodeSuccess] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Mobile Header Title & Code Card */}
      <section className="flex flex-col gap-4 md:hidden">
        <div className="space-y-3">
          <h1 className="text-foreground font-serif text-3xl leading-tight tracking-tight">
            Reviewing the <span className="text-sage font-sans font-light">Meris</span>
          </h1>
        </div>
        <GlassPanel className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-foreground/40 shrink-0 font-mono text-[10px] tracking-wider uppercase">Code:</span>
              <span className="text-sage truncate font-mono text-sm font-bold tracking-wider">{sessionId}</span>
            </div>
            <Button
              onClick={handleCopyLink}
              variant="ghost"
              size="sm"
              className="flex shrink-0 items-center gap-1.5"
            >
              {copySuccess ? (
                <>
                  <svg className="text-sage h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                  <span className="text-sage">Copied</span>
                </>
              ) : (
                <>
                  <svg className="text-foreground/50 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span>Copy Link</span>
                </>
              )}
            </Button>
          </div>

          <div className="h-px bg-[var(--glass-border)]" />

          {isJoined ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div 
                  className="bg-sage text-background flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                >
                  {getInitials(userName)}
                </div>
                <p className="text-foreground/70 truncate font-sans text-xs">
                  Joined as <span className="text-foreground font-bold">{userName}</span>
                </p>
              </div>
              <button
                onClick={changeName}
                className="text-foreground/60 shrink-0 cursor-pointer rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2.5 py-1.5 text-[9px] font-bold tracking-wider whitespace-nowrap uppercase transition-all hover:bg-[var(--glass-highlight)] active:scale-95"
              >
                Switch Account
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-foreground/30 text-[10px] font-bold tracking-wider uppercase">Who are you?</p>
              <div className="flex items-stretch gap-2">
                <Input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Guest Name"
                  maxLength={20}
                  className="px-3 py-2 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") joinSession(userName);
                  }}
                />
                <Button
                  onClick={() => joinSession(userName)}
                  className="px-4 py-2 text-xs"
                >
                  Join
                </Button>
              </div>
              {joinError && (
                <p className="mt-1 font-sans text-[10px] text-rose-400">{joinError}</p>
              )}
            </div>
          )}
        </GlassPanel>
      </section>

      {/* Desktop Header Banner */}
      <GlassPanel className="hidden p-8 md:block">
        <div className="bg-orb-sage pointer-events-none absolute top-0 right-0 h-96 w-96 opacity-10 blur-[150px]" />
        
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-6">
            <h1 className="text-foreground font-serif text-4xl leading-tight tracking-tight lg:text-5xl">
              Reviewing the <span className="text-sage font-sans font-light">Meris</span>
            </h1>
            
            <Button
              onClick={handleCopyLink}
              variant="ghost"
              className="px-5 py-3 flex shrink-0 items-center justify-center gap-2"
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
                  <svg className="h-4 w-4 opacity-50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span className="whitespace-nowrap">Share Session</span>
                </>
              )}
            </Button>
          </div>

          <div className="h-px w-full bg-[var(--glass-border)]" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans text-sm">
            <div className="flex items-center gap-3">
              <span className="text-sage font-mono font-bold tracking-wider select-all">{shortenId(sessionId)}</span>
              <button
                onClick={handleCopyCode}
                className="text-foreground/40 hover:text-sage flex items-center gap-1 rounded-sm border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2 py-1 font-mono text-[9px] font-bold tracking-wider uppercase transition-colors"
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

            <div className="hidden h-4 w-px bg-[var(--glass-border)] md:block" />

            <div className="flex justify-start md:justify-end min-w-0">
              {isJoined ? (
                <div className="flex flex-row items-center gap-4 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
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
                    className="text-foreground/60 cursor-pointer rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3.5 py-1.5 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase transition-all hover:bg-[var(--glass-highlight)] active:scale-95 shrink-0"
                  >
                    Switch Account
                  </button>
                </div>
              ) : (
                <div className="relative flex flex-row items-center gap-3">
                  <span className="text-foreground/35 text-xs font-bold tracking-wider whitespace-nowrap uppercase">Who are you?</span>
                  <Input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter Guest Name"
                    maxLength={20}
                    className="w-36 sm:w-48 px-3.5 py-1.5 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") joinSession(userName);
                    }}
                  />
                  <Button
                    onClick={() => joinSession(userName)}
                    className="px-4 py-1.5 text-xs"
                  >
                    Join & Claim
                  </Button>
                  {joinError && (
                    <p className="absolute right-0 -bottom-5.5 font-sans text-[10px] text-rose-400">{joinError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* Progress Section */}
      <section className="space-y-4 sm:space-y-6">
        <div className="flex flex-col justify-between gap-2 border-b border-[var(--glass-border)] pb-3 sm:flex-row sm:items-baseline">
          <span className="text-foreground/30 font-mono text-[10px] font-bold tracking-[0.2em] uppercase sm:text-xs sm:tracking-[0.3em]">
            COLLABORATION STATE // CLAIMING
          </span>
          <span className="text-sage font-mono text-sm font-bold">
            {claimProgressPercent}% COMPLETE
          </span>
        </div>

        <div className="flex h-4 items-center gap-1 sm:h-5 sm:gap-1.5">
          {Array.from({ length: 20 }).map((_, i) => {
            const isActive = i < Math.round((claimProgressPercent / 100) * 20);
            return (
              <div 
                key={i}
                className={`h-full flex-1 transition-all duration-700 ease-out ${
                  isActive 
                    ? "bg-sage" 
                    : "border border-[var(--glass-border)] bg-[var(--glass-bg)]"
                }`}
              />
            );
          })}
        </div>

        <div className="text-foreground/20 flex flex-col justify-between gap-2 font-mono text-[10px] font-bold tracking-wider uppercase sm:flex-row sm:items-center sm:text-xs">
          <div className="flex items-center gap-2">
            <span className="bg-sage inline-block h-1.5 w-1.5" />
            <span>CLAIMED: {formatRupiah(totalClaimedSubtotal)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 bg-[var(--glass-border)]" />
            <span>TOTAL INVENTORY: {formatRupiah(totalSubtotal)}</span>
          </div>
        </div>
      </section>

      {/* Inventory Items List */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-end justify-between border-b border-[var(--glass-border)] pb-3 sm:pb-4">
          <h2 className="text-foreground font-sans text-lg font-normal tracking-tight sm:text-xl md:text-2xl">Inventory</h2>
          <div className="flex items-center gap-4">
            {isPayer && (
              <button
                onClick={() => setIsAdding(true)}
                className="text-sage hover:bg-sage/10 flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors sm:text-xs"
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
          <GlassPanel className="animate-in fade-in slide-in-from-top-4 p-5 sm:p-8 relative overflow-hidden">
            <div className="from-sage/10 pointer-events-none absolute inset-0 bg-linear-to-r to-transparent opacity-50" />
            
            <div className="relative z-10 flex-1 flex flex-col gap-5 sm:gap-8 py-2">
              <div className="w-full relative group/input">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="New Item Name..."
                  className="w-full bg-transparent font-sans text-xl sm:text-2xl md:text-3xl font-normal tracking-tight text-foreground placeholder:text-foreground/20 focus:outline-none border-b border-dashed border-foreground/20 focus:border-sage focus:border-solid pb-1.5 transition-all"
                  autoFocus
                />
              </div>
              
              <div className="flex flex-wrap items-center gap-x-8 gap-y-6">
                <div className="flex items-center gap-3 relative group/input">
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30">Qty</span>
                  <input
                    type="number"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    placeholder="1"
                    className="w-12 bg-transparent font-mono text-lg sm:text-xl text-foreground focus:outline-none border-b border-dashed border-foreground/20 focus:border-sage focus:border-solid pb-1 text-center transition-all"
                  />
                </div>
                
                <div className="flex items-center gap-3 relative group/input">
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30">Price</span>
                  <div className="flex items-center gap-1 border-b border-dashed border-foreground/20 focus-within:border-sage focus-within:border-solid pb-1 transition-all">
                    <span className="text-foreground/40 font-mono text-lg sm:text-xl">Rp</span>
                    <input
                      type="number"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      placeholder="0"
                      className="w-24 sm:w-32 bg-transparent font-mono text-lg sm:text-xl text-foreground focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30">Total</span>
                  <span className="text-sage text-glow-sage font-mono text-lg sm:text-xl font-bold">
                    {formatRupiah((parseFloat(newItemPrice) || 0) * (parseInt(newItemQty) || 0))}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button 
                  onClick={handleAddItem} 
                  disabled={isSaving}
                  className="bg-foreground text-background text-[10px] font-bold tracking-[0.2em] uppercase px-6 py-2.5 rounded-full hover:bg-sage hover:text-white transition-all active:scale-95 disabled:opacity-50 shadow-md cursor-pointer"
                >
                  {isSaving ? "Adding..." : "Add to Inventory"}
                </button>
                <button 
                  onClick={() => setIsAdding(false)} 
                  disabled={isSaving}
                  className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/40 hover:text-foreground transition-colors px-4 py-2 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </GlassPanel>
        )}


        {items.length === 0 && !isAdding ? (
          <GlassPanel className="border-dashed border-[var(--glass-border)] p-12 text-center sm:p-24">
            <p className="text-foreground/20 font-sans text-lg font-normal tracking-wide sm:text-xl">No items have been uploaded yet.</p>
          </GlassPanel>
        ) : (
          <ul className="grid grid-cols-1 gap-2.5 sm:gap-4" role="list">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                isJoined={isJoined}
                userName={userName}
                isPayer={isPayer}
                onUpdateClaim={updateClaim}
                onRenameItem={renameItem}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
