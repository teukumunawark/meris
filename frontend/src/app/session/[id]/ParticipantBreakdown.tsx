"use client";

import React from "react";
import { ReceiptItem, calculateParticipantBreakdowns } from "@/utils/calculations";

interface ParticipantBreakdownProps {
  participants: string[];
  items: ReceiptItem[];
  totalSubtotal: number;
  tax: number;
  serviceCharge: number;
  userName: string;
  isJoined: boolean;
  formatRupiah: (val: number) => string;
  getAvatarBg: (name: string) => string;
  getInitials: (name: string) => string;
}

export default function ParticipantBreakdown({
  participants,
  items,
  totalSubtotal,
  tax,
  serviceCharge,
  userName,
  isJoined,
  formatRupiah,
  getAvatarBg,
  getInitials,
}: ParticipantBreakdownProps) {
  const breakdowns = calculateParticipantBreakdowns(
    participants,
    items,
    totalSubtotal,
    tax,
    serviceCharge
  );

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md rounded-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Proportional Splitting</h2>
        <span className="text-xs text-zinc-500 font-semibold">{participants.length} active</span>
      </div>

      {breakdowns.length === 0 ? (
        <p className="text-xs text-zinc-500 italic">No one has claimed any items yet.</p>
      ) : (
        <ul className="space-y-5" role="list">
          {breakdowns.map((p, idx) => {
            const isCurrentUser = isJoined && p.name === userName.trim();
            const percentOfReceipt = totalSubtotal > 0 ? Math.round((p.subtotal / totalSubtotal) * 100) : 0;

            return (
              <li
                key={idx}
                className={`p-4 rounded-2xl border ${
                  isCurrentUser
                    ? "bg-violet-950/10 border-violet-500/30"
                    : "bg-zinc-950/60 border-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${getAvatarBg(p.name)}`}>
                      {getInitials(p.name)}
                    </div>
                    <span className="font-bold text-sm text-zinc-100">
                      {p.name} {isCurrentUser && <span className="text-[10px] font-normal text-violet-400">(You)</span>}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-violet-400">
                    {formatRupiah(p.total)}
                  </span>
                </div>

                {/* Proportional calculation details */}
                <div className="space-y-1 text-[11px] text-zinc-400 border-t border-zinc-800/60 pt-2">
                  <div className="flex justify-between">
                    <span>Claim Subtotal ({percentOfReceipt}%)</span>
                    <span className="font-mono text-zinc-300">{formatRupiah(p.subtotal)}</span>
                  </div>
                  {p.subtotal > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span>Prop. Tax</span>
                        <span className="font-mono">{formatRupiah(p.tax)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Prop. Service</span>
                        <span className="font-mono">{formatRupiah(p.serviceCharge)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Items claimed details */}
                {p.claimedItems.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-dashed border-zinc-800 text-[10px] space-y-1">
                    <span className="text-zinc-500 font-medium">Claim Details:</span>
                    {p.claimedItems.map((item, ciIdx) => (
                      <div key={ciIdx} className="flex justify-between text-zinc-400">
                        <span>{item.shares}x {item.name}</span>
                        <span className="font-mono">{formatRupiah(item.totalPrice)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
