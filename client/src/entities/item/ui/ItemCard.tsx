"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ReceiptItem } from "@/shared/types";
import { GlassPanel } from "@/shared/ui/GlassPanel";
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";
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
  onRenameItem: (itemId: string, newName: string) => void;
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
        className={`group relative p-5 sm:p-8 transition-all duration-700 ${
          userClaimAmt > 0 ? "border-sage/40 bg-sage/4" : ""
        } ${showClaimHint && isFirstUnclaimed && isJoined ? "ring-1 ring-sage/30 shadow-[0_0_40px_rgba(var(--sage-rgb),0.15)] bg-background" : ""} ${borderPaddingClass}`}
      >
        <div className="from-sage/3 pointer-events-none absolute inset-0 bg-linear-to-r to-transparent opacity-0 transition-opacity duration-1000 group-hover:opacity-100" />
        
        {isEditing && isPayer ? (
          <div className="relative z-10 w-full animate-in fade-in zoom-in-95 duration-300">
            <div className="space-y-1 mb-6">
              <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-sage">Edit Item</span>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Item Name"
                className="w-full bg-transparent font-sans text-2xl md:text-3xl font-light tracking-tight text-foreground placeholder:text-foreground/20 focus:outline-none border-b border-foreground/10 focus:border-sage pb-2 transition-colors"
                autoFocus
              />
            </div>
            
            <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30">Qty</label>
                <input
                  type="number"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  placeholder="1"
                  className="w-16 bg-transparent border-b border-foreground/10 focus:border-sage pb-1 font-mono text-xl text-foreground focus:outline-none transition-colors text-center"
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30">Price</label>
                <div className="flex items-center gap-2 border-b border-foreground/10 focus-within:border-sage pb-1 transition-colors">
                  <span className="text-foreground/40 font-mono text-xl">Rp</span>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="0"
                    className="w-32 bg-transparent font-mono text-xl text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-1 min-w-[140px]">
                <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30">Total</label>
                <div className="pb-1 flex items-center h-8">
                  <span className="text-sage text-glow-sage font-mono text-2xl font-bold">
                    {formatRupiah((parseFloat(editPrice) || 0) * (parseInt(editQty) || 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 pt-8 mt-4 border-t border-foreground/5">
              <button 
                onClick={() => setIsEditing(false)} 
                disabled={isSaving}
                className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/40 hover:text-foreground transition-colors px-4 py-2 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="bg-sage text-background text-[10px] font-bold tracking-[0.2em] uppercase px-8 py-3 rounded-full hover:bg-sage/90 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-[0_0_20px_rgba(var(--sage-rgb),0.3)] flex items-center gap-2"
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
            <div className="flex-1 min-w-0 space-y-3">
              {/* Name + badge */}
              <div className="flex min-h-[2rem] items-center justify-between gap-4">
                <div className="group/title flex flex-1 items-center gap-3 min-w-0">
                  <h3 className="text-foreground truncate font-sans text-lg font-normal tracking-tight sm:text-xl md:text-2xl">
                    {item.name}
                  </h3>
                  {isSubItem && (
                    <span className="rounded-full bg-sage/10 px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest text-sage sm:text-[9px] border border-sage/20">
                      Sub-menu
                    </span>
                  )}
                  {isJoined && (
                    <div className="flex gap-1 shrink-0">
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
                          className="text-foreground/30 hover:text-rose-400 cursor-pointer p-1 transition-colors"
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
              <div className="flex flex-row items-center justify-between gap-4 border-t border-[var(--glass-border)] pt-5 md:flex-col md:items-end md:border-none md:pt-0 md:gap-3 shrink-0">

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
                      <span className="absolute inset-0 rounded-glass-sm bg-sage/40 animate-ping" />
                      <div className="absolute -top-8 right-0 sm:-right-4 animate-[bounce_2s_infinite] pointer-events-none z-20">
                        <div className="bg-sage text-background text-[9px] font-bold tracking-[0.2em] uppercase px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-[0_4px_15px_rgba(var(--sage-rgb),0.4)] whitespace-nowrap">
                          Claim Item
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7 7 7-7"/></svg>
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
                        <span className="absolute inset-0 rounded-glass-sm bg-sage/40 animate-ping" />
                      )}
                      <button
                        disabled={!isJoined || isFullyClaimed}
                        onClick={() => handleClaimInteraction(0.5)}
                        className="relative z-10 rounded-glass-sm text-sage flex h-10 w-10 cursor-pointer items-center justify-center text-lg font-light transition-all hover:bg-[var(--glass-highlight)] active:scale-90 disabled:opacity-10 sm:h-12 sm:w-12 sm:text-xl"
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
