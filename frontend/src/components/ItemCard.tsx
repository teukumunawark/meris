"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ReceiptItem } from "@/types";

interface ItemCardProps {
  item: ReceiptItem;
  isJoined: boolean;
  userName: string;
  onUpdateClaim: (itemId: string, increment: number) => void;
  onRenameItem: (itemId: string, newName: string) => void;
  formatRupiah: (val: number) => string;
}

export default function ItemCard({
  item,
  isJoined,
  userName,
  onUpdateClaim,
  onRenameItem,
  formatRupiah,
}: ItemCardProps) {
  const targetUser = userName.trim();
  const userClaim = item.claims.find((c) => c.name === targetUser);
  const userClaimAmt = isJoined ? (userClaim?.shares ?? 0) : 0;

  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(item.name);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditValue(item.name);
  }, [item.name]);
  
  const totalClaimed = item.claims.reduce((sum, c) => sum + c.shares, 0);
  const isFullyClaimed = totalClaimed >= item.quantity;
  const remainingQty = item.quantity - totalClaimed;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-panel rounded-glass-sm group relative flex flex-col justify-between gap-6 overflow-hidden p-5 transition-all duration-700 sm:p-8 md:flex-row md:items-center md:gap-10 ${
        userClaimAmt > 0 ? "border-sage/40 bg-sage/4" : "border-white/5"
      }`}
    >
      <div className="from-sage/3 pointer-events-none absolute inset-0 bg-linear-to-r to-transparent opacity-0 transition-opacity duration-1000 group-hover:opacity-100" />
      
      <div className="relative z-10 flex-1 space-y-4 sm:space-y-6">
        <div className="flex min-h-12 items-center justify-between gap-4 sm:gap-6 md:justify-start">
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const trimmed = editValue.trim();
                  if (trimmed && trimmed !== item.name) {
                    onRenameItem(item.id, trimmed);
                  }
                  setIsEditing(false);
                } else if (e.key === "Escape") {
                  setEditValue(item.name);
                  setIsEditing(false);
                }
              }}
              onBlur={() => {
                const trimmed = editValue.trim();
                if (trimmed && trimmed !== item.name) {
                  onRenameItem(item.id, trimmed);
                }
                setIsEditing(false);
              }}
              autoFocus
              className="rounded-glass-sm text-foreground focus:border-sage/40 w-full max-w-md border border-white/10 bg-white/4 px-2 py-1.5 font-sans text-lg focus:outline-none sm:text-xl md:text-2xl"
            />
          ) : (
            <div className="group/title flex w-full items-center gap-3">
              <h3 className="text-foreground font-sans text-lg font-normal tracking-tight sm:text-xl md:text-2xl">
                {item.name}
              </h3>
              {isJoined && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-foreground/30 hover:text-sage shrink-0 cursor-pointer p-1 opacity-100 transition-opacity md:opacity-0 md:group-hover/title:opacity-100"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
              )}
            </div>
          )}
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

        <div className="text-foreground/30 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-bold tracking-widest uppercase sm:gap-x-10 sm:text-xs sm:tracking-[0.2em]">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-foreground/20 font-sans text-xs">qty</span>
            <span className="text-foreground/50">{item.quantity}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-foreground/20 font-sans text-xs">price</span>
            <span className="text-foreground/50">{formatRupiah(item.price)}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-foreground/20 font-sans text-xs">total</span>
            <span className="text-sage text-glow-sage">{formatRupiah(item.price * item.quantity)}</span>
          </div>
        </div>

        {/* Claimants */}
        {item.claims.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-3">
            <span className="text-foreground/20 text-[9px] font-bold tracking-widest uppercase sm:text-[10px]">Participants</span>
            <div className="flex flex-wrap items-center gap-2">
              {item.claims.map((claim, idx) => (
                <motion.div
                  key={idx}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-glass-sm text-foreground/60 flex items-center gap-2 border border-white/5 bg-white/5 px-3 py-1.5 text-[10px] font-bold tracking-wider sm:text-[11px] sm:tracking-widest"
                >
                  <span className="text-foreground/40 font-sans text-xs sm:text-sm">{claim.name}</span>
                  <span className="text-sage font-mono">{claim.shares}x</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="relative z-10 flex flex-row items-center justify-between gap-4 border-t border-white/5 pt-6 sm:gap-6 md:justify-end md:gap-10 md:border-none md:pt-0">
        {/* Remaining */}
        <div className="flex flex-col gap-0.5 text-left md:text-right">
          <span className="text-foreground/20 text-[9px] font-bold tracking-widest uppercase sm:text-[10px]">Available</span>
          <span className="text-foreground/40 font-mono text-xs font-bold sm:text-sm">
            {remainingQty} <span className="text-foreground/20 font-sans text-[10px] sm:text-xs">of</span> {item.quantity}
          </span>
        </div>

        {/* Counter */}
        <div className="glass-panel rounded-glass-sm flex items-center border-white/10 bg-white/2 p-1 sm:p-2">
          <button
            disabled={!isJoined || userClaimAmt <= 0}
            onClick={() => onUpdateClaim(item.id, -0.5)}
            className="rounded-glass-sm text-foreground/40 flex h-10 w-10 cursor-pointer items-center justify-center text-lg font-light transition-all hover:bg-white/5 active:scale-90 disabled:opacity-10 sm:h-12 sm:w-12 sm:text-xl"
          >
            —
          </button>
          
          <div className="flex w-16 flex-col justify-center text-center select-none sm:w-20">
            <span className="text-foreground/20 block text-[9px] font-bold tracking-widest uppercase sm:text-[10px]">Share</span>
            <span className="text-foreground font-sans text-lg font-semibold sm:text-xl">{userClaimAmt}</span>
          </div>

          <button
            disabled={!isJoined || isFullyClaimed}
            onClick={() => onUpdateClaim(item.id, 0.5)}
            className="rounded-glass-sm text-sage flex h-10 w-10 cursor-pointer items-center justify-center text-lg font-light transition-all hover:bg-white/5 active:scale-90 disabled:opacity-10 sm:h-12 sm:w-12 sm:text-xl"
          >
            ＋
          </button>
        </div>
      </div>
    </motion.li>
  );
}
