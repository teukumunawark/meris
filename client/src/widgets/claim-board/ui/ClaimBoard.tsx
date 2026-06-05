"use client";

import React from "react";
import ItemCard from "@/entities/item/ui/ItemCard";
import { ReceiptItem } from "@/types";

interface ClaimBoardProps {
  sessionId: string;
  isJoined: boolean;
  userName: string;
  setUserName: (val: string) => void;
  joinSession: (name: string) => void;
  changeName: () => void;
  joinError: string | null;
  items: ReceiptItem[];
  updateClaim: (itemId: string, increment: number) => void;
  renameItem: (itemId: string, newName: string) => void;
  formatRupiah: (val: number) => string;
  getInitials: (name: string) => string;
  handleCopyLink: () => void;
  copySuccess: boolean;
  claimProgressPercent: number;
  totalClaimedSubtotal: number;
  totalSubtotal: number;
}

export default function ClaimBoard({
  sessionId,
  isJoined,
  userName,
  setUserName,
  joinSession,
  changeName,
  joinError,
  items,
  updateClaim,
  renameItem,
  formatRupiah,
  getInitials,
  handleCopyLink,
  copySuccess,
  claimProgressPercent,
  totalClaimedSubtotal,
  totalSubtotal,
}: ClaimBoardProps) {
  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Mobile Header Title & Code Card */}
      <section className="flex flex-col gap-4 md:hidden">
        <div className="space-y-3">
          <h1 className="text-foreground font-serif text-3xl leading-tight tracking-tight">
            Reviewing the <span className="text-sage font-sans font-light">Meris</span>
          </h1>
        </div>
        <div className="glass-panel rounded-glass space-y-4 border-white/5 bg-white/1 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-foreground/40 shrink-0 font-mono text-[10px] tracking-wider uppercase">Code:</span>
              <span className="text-sage truncate font-mono text-sm font-bold tracking-wider">{sessionId}</span>
            </div>
            <button
              onClick={handleCopyLink}
              className="rounded-glass-sm text-foreground/70 flex shrink-0 cursor-pointer items-center gap-1.5 border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all hover:bg-white/10 active:scale-95"
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
            </button>
          </div>

          <div className="h-px bg-white/5" />

          {isJoined ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div 
                  style={{ backgroundColor: "#8ba895" }}
                  className="text-background flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                >
                  {getInitials(userName)}
                </div>
                <p className="text-foreground/70 truncate font-sans text-xs">
                  Joined as <span className="text-foreground font-bold">{userName}</span>
                </p>
              </div>
              <button
                onClick={changeName}
                className="text-foreground/60 shrink-0 cursor-pointer rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[9px] font-bold tracking-wider whitespace-nowrap uppercase transition-all hover:bg-white/10 active:scale-95"
              >
                Switch Account
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-foreground/30 text-[10px] font-bold tracking-wider uppercase">Who are you?</p>
              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Guest Name"
                  maxLength={20}
                  className="rounded-glass-sm text-foreground placeholder:text-foreground/20 focus:ring-sage/40 min-w-0 flex-1 border border-white/10 bg-white/3 px-3 py-2 font-sans text-xs transition-all focus:ring-1 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") joinSession(userName);
                  }}
                />
                <button
                  type="button"
                  onClick={() => joinSession(userName)}
                  style={{ backgroundColor: "#8ba895" }}
                  className="rounded-glass-sm text-background shrink-0 cursor-pointer px-4 py-2 text-center text-xs font-bold tracking-wider whitespace-nowrap uppercase transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  Join
                </button>
              </div>
              {joinError && (
                <p className="mt-1 font-sans text-[10px] text-rose-400">{joinError}</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Desktop Header Banner */}
      <section className="glass-panel rounded-glass relative hidden overflow-hidden border-white/5 bg-white/1 p-8 md:block">
        <div className="bg-orb-sage pointer-events-none absolute top-0 right-0 h-96 w-96 opacity-10 blur-[150px]" />
        
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-6">
            <h1 className="text-foreground font-serif text-4xl leading-tight tracking-tight lg:text-5xl">
              Reviewing the <span className="text-sage font-sans font-light">Meris</span>
            </h1>
            
            <button
              onClick={handleCopyLink}
              className="rounded-glass-sm glass-panel glass-panel-hover text-foreground/80 hover:text-foreground flex cursor-pointer items-center justify-center gap-2.5 px-5 py-3 text-xs font-bold tracking-widest uppercase transition-all active:scale-95"
            >
              {copySuccess ? (
                <>
                  <svg className="text-sage h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                  <span className="text-sage">Copied</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span>Share Session</span>
                </>
              )}
            </button>
          </div>

          <div className="h-px w-full bg-white/5" />

          <div className="relative flex items-center justify-between gap-6 font-sans text-sm">
            <div className="text-foreground/70 flex items-center gap-2">
              <span className="text-foreground/45 font-mono text-xs tracking-wider uppercase">Code:</span>
              <span className="text-sage font-mono font-bold tracking-wider select-all">{sessionId}</span>
            </div>

            <div className="h-4 w-px bg-white/10" />

            <div className="flex max-w-xl flex-1 justify-end">
              {isJoined ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div 
                      style={{ backgroundColor: "#8ba895" }}
                      className="text-background flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-inner"
                    >
                      {getInitials(userName)}
                    </div>
                    <p className="text-foreground/70">
                      You are participating as <span className="text-foreground font-bold">{userName}</span>
                    </p>
                  </div>
                  <button
                    onClick={changeName}
                    className="text-foreground/60 cursor-pointer rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase transition-all hover:bg-white/10 active:scale-95"
                  >
                    Switch Account
                  </button>
                </div>
              ) : (
                <div className="relative flex w-full items-center justify-end gap-3">
                  <span className="text-foreground/35 text-xs font-bold tracking-wider whitespace-nowrap uppercase">Who are you?</span>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter Guest Name"
                    maxLength={20}
                    className="rounded-glass-sm text-foreground placeholder:text-foreground/20 focus:ring-sage/40 w-48 border border-white/10 bg-white/3 px-3.5 py-1.5 font-sans text-xs transition-all focus:ring-1 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") joinSession(userName);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => joinSession(userName)}
                    style={{ backgroundColor: "#8ba895" }}
                    className="rounded-glass-sm text-background cursor-pointer px-4 py-1.5 text-xs font-bold tracking-wider whitespace-nowrap uppercase transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    Join & Claim
                  </button>
                  {joinError && (
                    <p className="absolute right-0 -bottom-5.5 font-sans text-[10px] text-rose-400">{joinError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Progress Section */}
      <section className="space-y-4 sm:space-y-6">
        <div className="flex flex-col justify-between gap-2 border-b border-white/5 pb-3 sm:flex-row sm:items-baseline">
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
                    : "border border-white/5 bg-white/2"
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
            <span className="inline-block h-1.5 w-1.5 bg-white/10" />
            <span>TOTAL INVENTORY: {formatRupiah(totalSubtotal)}</span>
          </div>
        </div>
      </section>

      {/* Inventory Items List */}
      <div className="space-y-6 sm:space-y-12">
        <div className="flex items-end justify-between border-b border-white/5 pb-4 sm:pb-6">
          <h2 className="text-foreground font-sans text-2xl font-normal tracking-tight sm:text-3xl md:text-4xl">Inventory</h2>
          <span className="text-foreground/20 text-[10px] font-bold tracking-[0.2em] uppercase sm:text-xs sm:tracking-[0.3em]">{items.length} items</span>
        </div>

        {items.length === 0 ? (
          <div className="glass-panel rounded-glass border-dashed border-white/10 p-12 text-center sm:p-24">
            <p className="text-foreground/20 font-sans text-lg font-normal tracking-wide sm:text-xl">No items have been uploaded yet.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:gap-8" role="list">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                isJoined={isJoined}
                userName={userName}
                onUpdateClaim={updateClaim}
                onRenameItem={renameItem}
                formatRupiah={formatRupiah}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
