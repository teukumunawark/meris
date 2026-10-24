"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReceiptItem } from "@/shared/types";
import { GlassPanel } from "@/shared/ui/GlassPanel";
import { formatRupiah, formatShares, roundShares } from "@/shared/lib";
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
  // userName is the exact server name (myName); trimming would miss legacy names with stray spaces
  const targetUser = userName;
  const userClaim = targetUser ? item.claims.find((c) => c.name === targetUser) : undefined;
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
  const remainingQty = Math.max(0, roundShares(item.quantity - totalClaimed));
  const isFullyClaimed = remainingQty <= 0;

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

  const handleClaimFull = () => {
    if (remainingQty <= 0) return;
    const amount = remainingQty >= 1 ? 1 : remainingQty;
    handleClaimInteraction(amount);
  };

  const handleClaimHalf = () => {
    if (remainingQty < 0.5) return;
    handleClaimInteraction(0.5);
  };

  const handleIncrement = () => {
    if (remainingQty <= 0) return;
    const amount = remainingQty >= 1 ? 1 : remainingQty;
    handleClaimInteraction(amount);
  };

  const handleDecrement = () => {
    if (userClaimAmt <= 0) return;
    let step = 1;
    if (userClaimAmt <= 0.5) {
      step = userClaimAmt;
    } else if (userClaimAmt % 1 !== 0) {
      step = 0.5;
    }
    handleClaimInteraction(-step);
  };

  const handleToggleHalf = () => {
    if (userClaimAmt === 1) {
      handleClaimInteraction(-0.5);
    } else if (userClaimAmt === 0.5 && remainingQty >= 0.5) {
      handleClaimInteraction(0.5);
    }
  };

  // Indentation logic based on depth
  const indentationClass = depth > 0 ? (depth === 1 ? "ml-3 sm:ml-6" : depth === 2 ? "ml-6 sm:ml-12" : "ml-9 sm:ml-18") : "";
  const borderPaddingClass = depth > 0 ? "pl-4 sm:pl-8 border-l-2 border-sage/15" : "";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${showClaimHint && isFirstUnclaimed && isJoined ? "relative z-[101]" : "relative z-0"} ${indentationClass}`}
    >
      <GlassPanel 
        className={`group relative p-4 transition-all duration-700 sm:p-6 ${
          userClaimAmt > 0 ? "border-sage/40 bg-sage/4" : ""
        } ${showClaimHint && isFirstUnclaimed && isJoined ? "ring-sage/30 bg-background shadow-[0_0_40px_rgba(var(--sage-rgb),0.15)] ring-1" : ""} ${borderPaddingClass}`}
      >
        <div className="from-sage/3 pointer-events-none absolute inset-0 bg-linear-to-r to-transparent opacity-0 transition-opacity duration-1000 group-hover:opacity-100" />
        
        {isEditing && isPayer ? (
          <div className="animate-in fade-in zoom-in-95 relative z-10 w-full duration-300">
            <div className="mb-5 space-y-1">
              <span className="text-sage text-[9px] font-bold tracking-[0.3em] uppercase">Edit Item</span>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Item Name"
                className="text-foreground placeholder:text-foreground/20 border-foreground/10 focus:border-sage w-full border-b bg-transparent pb-2 font-sans text-xl font-normal tracking-tight transition-colors focus:outline-none sm:text-2xl"
                autoFocus
              />
            </div>
            
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-foreground/40 text-[10px] font-bold tracking-[0.2em] uppercase">Qty</label>
                <input
                  type="number"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  placeholder="1"
                  className="border-foreground/20 focus:border-sage text-foreground w-16 border-b bg-transparent pb-1 text-center font-mono text-lg transition-colors focus:outline-none"
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-foreground/40 text-[10px] font-bold tracking-[0.2em] uppercase">Price</label>
                <div className="border-foreground/20 focus-within:border-sage flex items-center gap-1.5 border-b pb-1 transition-colors">
                  <span className="text-foreground/40 font-mono text-sm">Rp</span>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="0"
                    className="text-foreground w-28 bg-transparent font-mono text-lg focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex min-w-[120px] flex-1 flex-col gap-1.5">
                <label className="text-foreground/40 text-[10px] font-bold tracking-[0.2em] uppercase">Total</label>
                <div className="flex h-8 items-center pb-1">
                  <span className="text-sage text-glow-sage font-mono text-xl font-bold">
                    {formatRupiah((parseFloat(editPrice) || 0) * (parseInt(editQty) || 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-foreground/5 mt-4 flex items-center justify-end gap-3 border-t pt-5">
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
                className="bg-sage text-background hover:bg-sage/90 flex cursor-pointer items-center gap-2 rounded-full px-6 py-2.5 text-[10px] font-bold tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(var(--sage-rgb),0.3)] transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        ) : isEditing && !isPayer ? (
          <div className="animate-in fade-in zoom-in-95 relative z-10 w-full duration-300">
            <div className="mb-5 space-y-1">
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
                className="text-foreground placeholder:text-foreground/20 border-foreground/10 focus:border-sage w-full border-b bg-transparent pb-2 font-sans text-xl font-normal tracking-tight transition-colors focus:outline-none sm:text-2xl"
                autoFocus
              />
            </div>

            <div className="border-foreground/5 flex items-center justify-end gap-3 border-t pt-4">
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
                className="bg-sage text-background hover:bg-sage/90 flex cursor-pointer items-center gap-2 rounded-full px-6 py-2.5 text-[10px] font-bold tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(var(--sage-rgb),0.3)] transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        ) : (
          /* View Mode */
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:gap-8">

            {/* Left: Item Information */}
            <div className="min-w-0 flex-1 space-y-2.5">
              {/* Name + Badges */}
              <div className="flex min-h-[1.75rem] items-start justify-between gap-3">
                <div className="group/title flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
                  <h3 className="text-foreground min-w-0 font-sans text-base font-normal tracking-tight [overflow-wrap:anywhere] sm:text-lg md:text-xl">
                    {item.name}
                  </h3>
                  {isSubItem && (
                    <span className="bg-sage/10 text-sage border-sage/20 rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase">
                      Sub-menu
                    </span>
                  )}
                  {isJoined && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-foreground/30 hover:text-sage flex h-8 w-8 cursor-pointer items-center justify-center transition-colors"
                        title={isPayer ? "Edit Item" : "Rename Item"}
                        aria-label={isPayer ? "Edit Item" : "Rename Item"}
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>
                      {isPayer && (
                        <button
                          onClick={handleDelete}
                          className="text-foreground/30 flex h-8 w-8 cursor-pointer items-center justify-center transition-colors hover:text-rose-400"
                          title="Delete Item"
                          aria-label="Delete Item"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                      className="rounded-glass-sm bg-sage/10 text-sage border-sage/20 shrink-0 border px-2.5 py-1 text-[9px] font-bold tracking-[0.2em] uppercase"
                    >
                      Claimed
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Stats row: qty, price, total */}
              <div className="text-foreground/40 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] font-bold tracking-widest uppercase sm:gap-x-6 sm:text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground/25 font-sans lowercase">qty</span>
                  <span className="text-foreground/60">{item.quantity}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground/25 font-sans lowercase">price</span>
                  <span className="text-foreground/60">{formatRupiah(item.price)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground/25 font-sans lowercase">total</span>
                  <span className="text-sage text-glow-sage">{formatRupiah(item.price * item.quantity)}</span>
                </div>
              </div>

              {/* Participants */}
              {item.claims.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--glass-border)] pt-2.5">
                  <span className="text-foreground/25 text-[9px] font-bold tracking-widest uppercase">Claimed by:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.claims.map((claim, idx) => (
                      <div
                        key={idx}
                        className="rounded-glass-sm text-foreground/70 flex items-center gap-1.5 border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2.5 py-1 text-[10px] font-medium"
                      >
                        <span className="font-sans text-xs [overflow-wrap:anywhere]">{claim.name}</span>
                        <span className="text-sage shrink-0 font-mono font-bold">{formatShares(claim.shares)}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Action Column */}
            {!isZeroPriceSubItem && (
              <div className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-3 border-t border-[var(--glass-border)] pt-3 md:flex-col md:flex-nowrap md:items-end md:gap-3 md:border-none md:pt-0">

                {/* Available count */}
                <div className="flex flex-col gap-0.5 md:text-right">
                  <span className="text-foreground/30 text-[9px] font-bold tracking-widest uppercase sm:text-[10px]">Available</span>
                  <span className="text-foreground/60 font-mono text-xs font-bold sm:text-sm">
                    {formatShares(remainingQty)} <span className="text-foreground/30 font-sans text-[10px] sm:text-xs">of</span> {item.quantity}
                  </span>
                </div>

                {/* Claim Interaction Controls */}
                <div className="relative">
                  {showClaimHint && isFirstUnclaimed && isJoined && (
                    <>
                      <span className="rounded-glass-sm bg-sage/40 absolute inset-0 animate-ping" />
                      <div className="pointer-events-none absolute -top-8 right-0 z-20 animate-[bounce_2s_infinite] sm:-right-4">
                        <div className="bg-sage text-background flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-bold tracking-[0.2em] whitespace-nowrap uppercase shadow-[0_4px_15px_rgba(var(--sage-rgb),0.4)]">
                          Claim Item
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 19V5M5 12l7 7 7-7" />
                          </svg>
                        </div>
                      </div>
                    </>
                  )}

                  {!isJoined ? (
                    <span className="rounded-glass-sm text-foreground/30 border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-xs font-medium">
                      Join to claim
                    </span>
                  ) : userClaimAmt === 0 ? (
                    isFullyClaimed ? (
                      <span className="rounded-glass-sm text-foreground/30 border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-xs font-medium">
                        Fully Claimed
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        {remainingQty >= 0.5 && item.quantity >= 1 && (
                          <button
                            type="button"
                            onClick={handleClaimHalf}
                            className="rounded-glass-sm text-foreground/60 hover:text-sage hover:border-sage/40 flex h-10 cursor-pointer items-center justify-center border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-xs font-bold tracking-wider uppercase transition-all active:scale-95 sm:h-11 sm:px-3.5"
                            title="Claim half portion (0.5x)"
                            aria-label="Claim half portion"
                          >
                            ½ Split
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleClaimFull}
                          className="bg-sage text-background hover:bg-sage/90 rounded-glass-sm flex h-10 cursor-pointer items-center justify-center gap-1.5 px-4 text-xs font-bold tracking-wider uppercase shadow-[0_2px_12px_rgba(var(--sage-rgb),0.25)] transition-all active:scale-95 sm:h-11 sm:px-5"
                          aria-label={`Claim ${remainingQty >= 1 ? "1" : formatShares(remainingQty)} portion`}
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                          <span className="whitespace-nowrap">{remainingQty >= 1 ? "Claim 1x" : `Claim ${formatShares(remainingQty)}x`}</span>
                        </button>
                      </div>
                    )
                  ) : (
                    /* Claimed state with stepper */
                    <div className="glass-panel rounded-glass-sm flex items-center border-[var(--glass-border)] bg-[var(--glass-bg-solid)] p-1">
                      <button
                        type="button"
                        disabled={userClaimAmt <= 0}
                        onClick={handleDecrement}
                        className="rounded-glass-sm text-foreground/60 hover:text-foreground flex h-10 w-10 cursor-pointer items-center justify-center transition-all hover:bg-[var(--glass-highlight)] active:scale-90 disabled:opacity-20 sm:h-11 sm:w-11"
                        aria-label="Decrease portion"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                        </svg>
                      </button>

                      <div className="flex min-w-[3.5rem] flex-col items-center justify-center px-1 text-center select-none sm:min-w-[4rem]">
                        <span className="text-sage font-mono text-base font-bold sm:text-lg">
                          {formatShares(userClaimAmt)}x
                        </span>
                        {userClaimAmt === 1 && remainingQty >= 0 && (
                          <button
                            type="button"
                            onClick={handleToggleHalf}
                            className="text-foreground/40 hover:text-sage cursor-pointer text-[9px] font-bold tracking-wider uppercase"
                            title="Split to 0.5x"
                          >
                            Split ½
                          </button>
                        )}
                        {userClaimAmt === 0.5 && (
                          <button
                            type="button"
                            onClick={handleToggleHalf}
                            disabled={remainingQty < 0.5}
                            className="text-foreground/40 hover:text-sage cursor-pointer text-[9px] font-bold tracking-wider uppercase disabled:opacity-20"
                            title="Make 1x"
                          >
                            Make 1x
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isFullyClaimed || remainingQty <= 0}
                        onClick={handleIncrement}
                        className="rounded-glass-sm text-sage hover:bg-sage/10 flex h-10 w-10 cursor-pointer items-center justify-center transition-all active:scale-90 disabled:opacity-20 sm:h-11 sm:w-11"
                        aria-label="Increase portion"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
      </GlassPanel>
    </motion.li>
  );
}
