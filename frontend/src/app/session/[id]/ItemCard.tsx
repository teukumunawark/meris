"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ReceiptItem } from "@/utils/calculations";

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
      className={`glass-panel rounded-glass-sm p-5 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10 transition-all duration-700 group relative overflow-hidden ${
        userClaimAmt > 0 ? "border-sage/40 bg-sage/4" : "border-white/5"
      }`}
    >
      <div className="absolute inset-0 bg-linear-to-r from-sage/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
      
      <div className="space-y-4 sm:space-y-6 flex-1 relative z-10">
        <div className="flex items-center justify-between md:justify-start gap-4 sm:gap-6 min-h-12">
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
              className="px-2 py-1.5 rounded-glass-sm bg-white/[0.04] border border-white/10 text-foreground text-lg sm:text-xl md:text-2xl font-sans focus:outline-none focus:border-sage/40 w-full max-w-md"
            />
          ) : (
            <div className="flex items-center gap-3 w-full group/title">
              <h3 className="font-sans text-foreground text-lg sm:text-xl md:text-2xl tracking-tight font-normal">
                {item.name}
              </h3>
              {isJoined && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="opacity-100 md:opacity-0 md:group-hover/title:opacity-100 text-foreground/30 hover:text-sage transition-opacity p-1 cursor-pointer shrink-0"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                className="text-[9px] sm:text-[10px] uppercase font-bold tracking-[0.2em] sm:tracking-[0.3em] px-3 py-1 sm:px-4 sm:py-1.5 rounded-glass-sm bg-sage/10 text-sage border border-sage/20 shrink-0"
              >
                Claimed
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 sm:gap-x-10 gap-y-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.1em] sm:tracking-[0.2em] text-foreground/30">
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
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-white/5">
            <span className="text-[9px] sm:text-[10px] text-foreground/20 uppercase font-bold tracking-widest">Participants</span>
            <div className="flex flex-wrap items-center gap-2">
              {item.claims.map((claim, idx) => (
                <motion.div
                  key={idx}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-glass-sm border border-white/5 text-[10px] sm:text-[11px] font-bold tracking-wider sm:tracking-widest bg-white/5 text-foreground/60"
                >
                  <span className="font-sans text-xs sm:text-sm text-foreground/40">{claim.name}</span>
                  <span className="text-sage font-mono">{claim.shares}x</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-row items-center justify-between md:justify-end gap-4 sm:gap-6 md:gap-10 border-t border-white/5 md:border-none pt-6 md:pt-0 relative z-10">
        {/* Remaining */}
        <div className="text-left md:text-right flex flex-col gap-0.5">
          <span className="text-[9px] sm:text-[10px] text-foreground/20 uppercase font-bold tracking-widest">Available</span>
          <span className="text-xs sm:text-sm font-mono font-bold text-foreground/40">
            {remainingQty} <span className="text-[10px] sm:text-xs text-foreground/20 font-sans">of</span> {item.quantity}
          </span>
        </div>

        {/* Counter */}
        <div className="flex items-center glass-panel rounded-glass-sm p-1 sm:p-2 border-white/10 bg-white/2">
          <button
            disabled={!isJoined || userClaimAmt <= 0}
            onClick={() => onUpdateClaim(item.id, -0.5)}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-glass-sm flex items-center justify-center text-lg sm:text-xl font-light hover:bg-white/5 active:scale-90 disabled:opacity-10 transition-all text-foreground/40 cursor-pointer"
          >
            —
          </button>
          
          <div className="w-16 sm:w-20 text-center flex flex-col justify-center select-none">
            <span className="text-[9px] sm:text-[10px] text-foreground/20 font-bold tracking-widest block uppercase">Share</span>
            <span className="text-foreground text-lg sm:text-xl font-sans font-semibold">{userClaimAmt}</span>
          </div>

          <button
            disabled={!isJoined || isFullyClaimed}
            onClick={() => onUpdateClaim(item.id, 0.5)}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-glass-sm flex items-center justify-center text-lg sm:text-xl font-light hover:bg-white/5 active:scale-90 disabled:opacity-10 transition-all text-sage cursor-pointer"
          >
            ＋
          </button>
        </div>
      </div>
    </motion.li>
  );
}
