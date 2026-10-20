"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReceiptItem } from "@/shared/types";
import { GlassPanel } from "@/shared/ui/GlassPanel";
import { formatRupiah } from "@/shared/lib";
import { useManageItems } from "@/features/manage-items";

interface ItemCardProps {
  item: ReceiptItem;
  depth?: number;
  isJoined: boolean;
  userName: string;
  isPayer?: boolean;
  showClaimHint?: boolean;
  isFirstUnclaimed?: boolean;
  onInteraction?: () => void;
  onUpdateClaim: (itemId: string, increment: number) => void;
  onRenameItem: (itemId: string, newName: string) => void | Promise<unknown>;
}

export default function ItemCard({
  item,
  depth = 0,
  isJoined,
  userName,
  isPayer = false,
  showClaimHint = false,
  isFirstUnclaimed = false,
  onInteraction,
  onUpdateClaim,
  onRenameItem,
}: ItemCardProps) {
  const targetUser = userName.trim();
  const userClaim = item.claims.find((c) => c.name === targetUser);
  const userClaimAmt = isJoined ? (userClaim?.shares ?? 0) : 0;

  const isSubItem = !!item.parentId;
  const isZeroPriceSubItem = isSubItem && item.price === 0;

  const { updateItem, deleteItem } = useManageItems();

  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(item.name);
  const [editPrice, setEditPrice] = React.useState(item.price.toString());
  const [editQty, setEditQty] = React.useState(item.quantity.toString());
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setEditName(item.name);
    setEditPrice(item.price.toString());
    setEditQty(item.quantity.toString());
  }, [item.name, item.price, item.quantity]);
  
  const totalClaimed = item.claims.reduce((sum, c) => sum + c.shares, 0);
  const isFullyClaimed = totalClaimed >= item.quantity;
  const remainingQty = item.quantity - totalClaimed;

  const handleSave = async () => {
    const price = parseFloat(editPrice);
    const qty = parseInt(editQty);
    if (!editName.trim() || isNaN(price) || isNaN(qty)) return;

    setIsSaving(true);
    const success = await updateItem(item.id, editName.trim(), price, qty);
    if (success) {
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const handleRenameSave = async () => {
    const trimmed = editName.trim();
    if (!trimmed) return;

    setIsSaving(true);
    try {
      await onRenameItem(item.id, trimmed);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
      await deleteItem(item.id);
    }
  };

  const handleClaimInteraction = (increment: number) => {
    if (onInteraction) onInteraction();
    onUpdateClaim(item.id, increment);
  };

  // Indentation logic based on depth
  const indentationClass = depth > 0 ? (depth === 1 ? "ml-4 sm:ml-8" : depth === 2 ? "ml-8 sm:ml-16" : "ml-12 sm:ml-24") : "";
  const borderPaddingClass = depth > 0 ? "pl-6 sm:pl-10 border-l-2 border-sage/10" : "";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${showClaimHint && isFirstUnclaimed && isJoined ? "relative z-[101]" : "relative z-0"} ${indentationClass}`}
    >
      <GlassPanel 
        className={`group relative p-5 transition-all duration-700 sm:p-8 ${
          userClaimAmt > 0 ? "border-sage/40 bg-sage/4" : ""
        } ${showClaimHint && isFirstUnclaimed && isJoined ? "ring-sage/30 bg-background shadow-[0_0_40px_rgba(var(--sage-rgb),0.15)] ring-1" : ""} ${borderPaddingClass}`}
      >
        <div className="from-sage/3 pointer-events-none absolute inset-0 bg-linear-to-r to-transparent opacity-0 transition-opacity duration-1000 group-hover:opacity-100" />
        
        {isEditing && isPayer ? (
          <div className="animate-in fade-in zoom-in-95 relative z-10 w-full duration-300">
            <div className="mb-6 space-y-1">
              <span className="text-sage text-[9px] font-bold tracking-[0.3em] uppercase">Edit Item</span>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Item Name"
                className="text-foreground placeholder:text-foreground/20 border-foreground/10 focus:border-sage w-full border-b bg-transparent pb-2 font-sans text-2xl font-light tracking-tight transition-colors focus:outline-none md:text-3xl"
                autoFocus
              />
            </div>
            
            <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-foreground/30 text-[10px] font-bold tracking-[0.2em] uppercase">Qty</label>
                <input
                  type="number"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  placeholder="1"
                  className="border-foreground/10 focus:border-sage text-foreground w-16 border-b bg-transparent pb-1 text-center font-mono text-xl transition-colors focus:outline-none"
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-foreground/30 text-[10px] font-bold tracking-[0.2em] uppercase">Price</label>
                <div className="border-foreground/10 focus-within:border-sage flex items-center gap-2 border-b pb-1 transition-colors">
                  <span className="text-foreground/40 font-mono text-xl">Rp</span>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="0"
                    className="text-foreground w-32 bg-transparent font-mono text-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex min-w-[140px] flex-1 flex-col gap-2">
                <label className="text-foreground/30 text-[10px] font-bold tracking-[0.2em] uppercase">Total</label>
                <div className="flex h-8 items-center pb-1">
                  <span className="text-sage text-glow-sage font-mono text-2xl font-bold">
                    {formatRupiah((parseFloat(editPrice) || 0) * (parseInt(editQty) || 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-foreground/5 mt-4 flex items-center justify-end gap-4 border-t pt-8">
              <button 
                onClick={() => setIsEditing(false)} 
                disabled={isSaving}
                className="text-foreground/40 hover:text-foreground cursor-pointer px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="bg-sage text-background hover:bg-sage/90 flex cursor-pointer items-center gap-2 rounded-full px-8 py-3 text-[10px] font-bold tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(var(--sage-rgb),0.3)] transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        ) : isEditing && !isPayer ? (
          <div className="animate-in fade-in zoom-in-95 relative z-10 w-full duration-300">
            <div className="mb-6 space-y-1">
              <span className="text-sage text-[9px] font-bold tracking-[0.3em] uppercase">Rename Item</span>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleRenameSave();
                  } else if (e.key === "Escape") {
                    setEditName(item.name);
                    setIsEditing(false);
                  }
                }}
                placeholder="Item Name"
                className="text-foreground placeholder:text-foreground/20 border-foreground/10 focus:border-sage w-full border-b bg-transparent pb-2 font-sans text-2xl font-light tracking-tight transition-colors focus:outline-none md:text-3xl"
                autoFocus
              />
            </div>

            <div className="border-foreground/5 flex items-center justify-end gap-4 border-t pt-4">
              <button 
                onClick={() => {
                  setEditName(item.name);
                  setIsEditing(false);
                }} 
                disabled={isSaving}
                className="text-foreground/40 hover:text-foreground cursor-pointer px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleRenameSave} 
                disabled={isSaving || !editName.trim() || editName.trim() === item.name}
                className="bg-sage text-background hover:bg-sage/90 flex cursor-pointer items-center gap-2 rounded-full px-8 py-3 text-[10px] font-bold tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(var(--sage-rgb),0.3)] transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        ) : (
          // ── VIEW MODE: two-column layout ──
          // Left: item info (name, stats, participants)
          // Right: action column (available count stacked above stepper)
          <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:gap-10">

            {/* ── LEFT: Info ── */}
            <div className="min-w-0 flex-1 space-y-3">
              {/* Name + badge */}
              <div className="flex min-h-[2rem] items-center justify-between gap-4">
                <div className="group/title flex min-w-0 flex-1 items-center gap-3">
                  <h3 className="text-foreground truncate font-sans text-lg font-normal tracking-tight sm:text-xl md:text-2xl">
                    {item.name}
                  </h3>
                  {isSubItem && (
                    <span className="bg-sage/10 text-sage border-sage/20 rounded-full border px-2.5 py-1 text-[8px] font-bold tracking-widest uppercase sm:text-[9px]">
                      Sub-menu
                    </span>
                  )}
                  {isJoined && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-foreground/30 hover:text-sage cursor-pointer p-1 transition-colors"
                        title={isPayer ? "Edit Item" : "Rename Item"}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>
                      {isPayer && (
                        <button
                          onClick={handleDelete}
                          className="text-foreground/30 cursor-pointer p-1 transition-colors hover:text-rose-400"
                          title="Delete Item"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <AnimatePresence>
                  {isFullyClaimed && (
                    <motion.span 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-glass-sm bg-sage/10 text-sage border-sage/20 shrink-0 border px-3 py-1 text-[9px] font-bold tracking-[0.2em] uppercase sm:px-4 sm:py-1.5 sm:text-[10px] sm:tracking-[0.3em]"
                    >
                      Claimed
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Stats row — qty · price · total */}
              <div className="text-foreground/30 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[10px] font-bold tracking-widest uppercase sm:gap-x-8 sm:text-xs sm:tracking-[0.2em]">
                <div className="flex items-center gap-2">
                  <span className="text-foreground/20 font-sans text-xs lowercase">qty</span>
                  <span className="text-foreground/50">{item.quantity}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground/20 font-sans text-xs lowercase">price</span>
                  <span className="text-foreground/50">{formatRupiah(item.price)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground/20 font-sans text-xs lowercase">total</span>
                  <span className="text-sage text-glow-sage">{formatRupiah(item.price * item.quantity)}</span>
                </div>
              </div>

              {/* Participants */}
              {item.claims.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--glass-border)] pt-3">
                  <span className="text-foreground/20 text-[9px] font-bold tracking-widest uppercase sm:text-[10px]">Participants</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.claims.map((claim, idx) => (
                      <div
                        key={idx}
                        className="rounded-glass-sm text-foreground/60 flex items-center gap-2 border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-1.5 text-[10px] font-bold tracking-wider sm:text-[11px] sm:tracking-widest"
                      >
                        <span className="text-foreground/40 font-sans text-xs sm:text-sm">{claim.name}</span>
                        <span className="text-sage font-mono">{claim.shares}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT: Action column ──
                Always stacked vertically: "Available" label+count on top, stepper below.
                On mobile: full-width with border-top separator.
                On md+: fixed-width column right-aligned. */}
            {!isZeroPriceSubItem && (
              <div className="flex shrink-0 flex-row items-center justify-between gap-4 border-t border-[var(--glass-border)] pt-5 md:flex-col md:items-end md:gap-3 md:border-none md:pt-0">

                {/* Available count */}
                <div className="flex flex-col gap-0.5 md:text-right">
                  <span className="text-foreground/20 text-[9px] font-bold tracking-widest uppercase sm:text-[10px]">Available</span>
                  <span className="text-foreground/40 font-mono text-xs font-bold sm:text-sm">
                    {remainingQty} <span className="text-foreground/20 font-sans text-[10px] sm:text-xs">of</span> {item.quantity}
                  </span>
                </div>

                {/* Stepper */}
                <div className="relative">
                  {showClaimHint && isFirstUnclaimed && isJoined && (
                    <>
                      <span className="rounded-glass-sm bg-sage/40 absolute inset-0 animate-ping" />
                      <div className="pointer-events-none absolute -top-8 right-0 z-20 animate-[bounce_2s_infinite] sm:-right-4">
                        <div className="bg-sage text-background flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-bold tracking-[0.2em] whitespace-nowrap uppercase shadow-[0_4px_15px_rgba(var(--sage-rgb),0.4)]">
                          Claim Item
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7 7 7-7"/></svg>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="glass-panel rounded-glass-sm flex items-center border-[var(--glass-border)] bg-[var(--glass-bg-solid)] p-1 sm:p-2">
                    <button
                      disabled={!isJoined || userClaimAmt <= 0}
                      onClick={() => handleClaimInteraction(-0.5)}
                      className="rounded-glass-sm text-foreground/40 flex h-10 w-10 cursor-pointer items-center justify-center text-lg font-light transition-all hover:bg-[var(--glass-highlight)] active:scale-90 disabled:opacity-10 sm:h-12 sm:w-12 sm:text-xl"
                    >
                      —
                    </button>

                    <div className="flex w-16 flex-col justify-center text-center select-none sm:w-20">
                      <span className="text-foreground/20 block text-[9px] font-bold tracking-widest uppercase sm:text-[10px]">Share</span>
                      <span className="text-foreground font-sans text-lg font-semibold sm:text-xl">{userClaimAmt}</span>
                    </div>

                    <div className="relative">
                      {showClaimHint && isFirstUnclaimed && isJoined && (
                        <span className="rounded-glass-sm bg-sage/40 absolute inset-0 animate-ping" />
                      )}
                      <button
                        disabled={!isJoined || isFullyClaimed}
                        onClick={() => handleClaimInteraction(0.5)}
                        className="rounded-glass-sm text-sage relative z-10 flex h-10 w-10 cursor-pointer items-center justify-center text-lg font-light transition-all hover:bg-[var(--glass-highlight)] active:scale-90 disabled:opacity-10 sm:h-12 sm:w-12 sm:text-xl"
                      >
                        ＋
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </GlassPanel>
    </motion.li>
  );
}
