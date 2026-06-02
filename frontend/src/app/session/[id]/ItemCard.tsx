"use client";

import React from "react";
import { ReceiptItem } from "@/utils/calculations";

interface ItemCardProps {
  item: ReceiptItem;
  isJoined: boolean;
  userName: string;
  onUpdateClaim: (itemId: string, increment: number) => void;
  formatRupiah: (val: number) => string;
  getAvatarBg: (name: string) => string;
}

export default function ItemCard({
  item,
  isJoined,
  userName,
  onUpdateClaim,
  formatRupiah,
  getAvatarBg,
}: ItemCardProps) {
  const targetUser = userName.trim();
  const userClaim = item.claims.find((c) => c.name === targetUser);
  const userClaimAmt = isJoined ? (userClaim?.shares ?? 0) : 0;
  
  const totalClaimed = item.claims.reduce((sum, c) => sum + c.shares, 0);
  const isFullyClaimed = totalClaimed >= item.quantity;
  const remainingQty = item.quantity - totalClaimed;

  return (
    <li
      className={`relative bg-zinc-900/40 border backdrop-blur-sm rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ${
        userClaimAmt > 0
          ? "border-violet-500/40 bg-gradient-to-r from-zinc-900/50 to-violet-950/10 shadow-lg shadow-violet-500/5"
          : "border-zinc-800 hover:border-zinc-700/80"
      }`}
    >
      <div className="space-y-2 flex-1">
        <div className="flex items-start justify-between md:justify-start md:items-center gap-3">
          <h3 className="font-bold text-white text-base sm:text-lg">{item.name}</h3>
          {isFullyClaimed && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Fully Claimed
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-400">
          <div className="flex items-center gap-1 font-mono">
            <span>Qty: {item.quantity}</span>
          </div>
          <div>
            Unit Price: <span className="font-mono">{formatRupiah(item.price)}</span>
          </div>
          <div className="font-bold text-zinc-300">
            Total: <span className="font-mono text-zinc-100">{formatRupiah(item.price * item.quantity)}</span>
          </div>
        </div>

        {/* Avatars/Pills of claimants */}
        {item.claims.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-[10px] text-zinc-500 uppercase font-semibold">Claimed by:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {item.claims.map((claim, idx) => (
                <div
                  key={idx}
                  title={`${claim.name} claimed ${claim.shares} shares`}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${getAvatarBg(
                    claim.name
                  )}`}
                >
                  <span>{claim.name}</span>
                  <span className="opacity-80 px-1 bg-black/25 rounded">
                    {claim.shares}x
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Claim Control actions */}
      <div className="flex flex-row sm:flex-col md:flex-row items-center justify-between sm:justify-end gap-4 border-t border-zinc-800/60 md:border-none pt-3 md:pt-0">
        {/* Remaining indicator */}
        <div className="text-right flex flex-col items-start sm:items-end">
          <span className="text-[10px] text-zinc-500 uppercase font-semibold">Available</span>
          <span className="text-xs font-mono font-bold text-zinc-300">
            {remainingQty} of {item.quantity}
          </span>
        </div>

        {/* Quantity Claim selector */}
        <div className="flex items-center bg-zinc-950/80 border border-zinc-800 rounded-xl p-1 shadow">
          <button
            disabled={!isJoined || userClaimAmt <= 0}
            onClick={() => onUpdateClaim(item.id, -0.5)}
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold hover:bg-zinc-800 active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent text-zinc-400 hover:text-white transition-all cursor-pointer"
            title="Unclaim 0.5 portion"
            aria-label={`Decrease claim for ${item.name} by 0.5 shares`}
          >
            -
          </button>
          
          <div className="w-14 text-center font-mono text-xs font-bold flex flex-col justify-center select-none">
            <span className="text-[10px] text-zinc-500 block leading-none">CLAIM</span>
            <span className="text-zinc-200 text-sm mt-0.5">{userClaimAmt}</span>
          </div>

          <button
            disabled={!isJoined || isFullyClaimed}
            onClick={() => onUpdateClaim(item.id, 0.5)}
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold hover:bg-zinc-800 active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent text-zinc-400 hover:text-white transition-all cursor-pointer"
            title="Claim 0.5 portion"
            aria-label={`Increase claim for ${item.name} by 0.5 shares`}
          >
            +
          </button>
        </div>
      </div>
    </li>
  );
}
