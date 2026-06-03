"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { useClaimSession } from "@/hooks/useClaimSession";
import ItemCard from "@/components/ItemCard";
import ParticipantBreakdown from "@/components/ParticipantBreakdown";
import { calculateParticipantBreakdowns } from "@/utils/calculations";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClaimSessionPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.id;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Use Custom Hook for state, SSE sync, claim handlers
  const {
    userName,
    setUserName,
    isJoined,
    items,
    tax,
    serviceCharge,
    payerName,
    payerBankName,
    payerBankAccount,
    joinSession,
    changeName,
    updateClaim,
    renameItem,
    joinError,
    participants,
    removeParticipant,
  } = useClaimSession(sessionId);

  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [copyAccountSuccess, setCopyAccountSuccess] = useState<boolean>(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleCopyAccount = () => {
    if (typeof window !== "undefined" && payerBankAccount) {
      navigator.clipboard.writeText(payerBankAccount);
      setCopyAccountSuccess(true);
      setTimeout(() => setCopyAccountSuccess(false), 2000);
    }
  };

  // UI Helpers
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getInitials = (name: string) => {
    return name.trim().slice(0, 2).toUpperCase();
  };

  const getAvatarBg = (name: string) => {
    const colors = [
      "bg-slate-700 text-slate-100",
      "bg-sage/40 text-white",
      "bg-emerald-900/40 text-emerald-100",
      "bg-slate-800 text-slate-200",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Overall calculations
  const totalSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = totalSubtotal + tax + serviceCharge;

  const isPayer = isJoined && userName.trim().toLowerCase() === payerName.trim().toLowerCase();

  const totalClaimedSubtotal = items.reduce((sum, item) => {
    const claimedShares = item.claims.reduce((s, c) => s + c.shares, 0);
    return sum + item.price * claimedShares;
  }, 0);

  const claimProgressPercent = totalSubtotal > 0 ? Math.round((totalClaimedSubtotal / totalSubtotal) * 100) : 0;

  // Calculate current user's total share
  const currentUserTotal = React.useMemo(() => {
    if (!isJoined || !userName) return 0;
    const participantNames = participants.map((p) => p.name);
    const breakdowns = calculateParticipantBreakdowns(
      participantNames,
      items,
      totalSubtotal,
      tax,
      serviceCharge
    );
    const userBreakdown = breakdowns.find((b) => b.name === userName.trim());
    return userBreakdown ? userBreakdown.total : 0;
  }, [isJoined, userName, participants, items, totalSubtotal, tax, serviceCharge]);

  if (!mounted) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div 
          style={{ borderTopColor: '#8ba895' }}
          className="border-sage/10 h-12 w-12 animate-spin rounded-full border-4" 
        />
      </div>
    );
  }

  return (
    <div className={`bg-background text-foreground relative min-h-screen overflow-x-hidden font-sans antialiased ${isJoined ? 'pb-32 lg:pb-20' : 'pb-20'}`}>
      {/* Background Ambience */}
      <div className="bg-orb-sage pointer-events-none fixed top-[-10%] right-[-10%] h-[60%] w-[60%] rounded-full opacity-20 blur-[120px]" />
      <div className="bg-orb-slate pointer-events-none fixed bottom-[-10%] left-[-10%] h-[60%] w-[60%] rounded-full opacity-10 blur-[120px]" />

      {/* Navbar */}
      <header className="bg-background/80 sticky top-0 z-50 w-full border-b border-white/5 backdrop-blur-xl">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-10">
          
          {/* MOBILE NAVBAR ELEMENTS (Hidden on Desktop) */}
          {/* Mobile Left: Back Button */}
          <div className="flex items-center md:hidden">
            <Link
              href="/"
              className="text-foreground/75 hover:text-foreground flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/3 p-2 transition-all duration-300 hover:bg-white/10 active:scale-95"
              title="Back to Home"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 19-7-7 7-7"/>
                <path d="M19 12H5"/>
              </svg>
            </Link>
          </div>

          {/* Mobile Center: Logo (No [M]) */}
          <Link href="/" className="group absolute left-1/2 flex -translate-x-1/2 cursor-pointer items-center select-none md:hidden">
            <span className="text-foreground group-hover:text-sage font-sans text-base font-semibold tracking-[0.2em] uppercase transition-all duration-300">
              Meris
            </span>
          </Link>

          {/* Mobile Right Spacer */}
          <div className="pointer-events-none h-8 w-8 opacity-0 md:hidden" aria-hidden="true" />

          {/* DESKTOP NAVBAR ELEMENTS (Hidden on Mobile) */}
          {/* Desktop Left: Logo [M] Meris + Breadcrumb */}
          <div className="hidden items-center gap-6 md:flex">
            {/* Desktop Clickable Logo */}
            <Link href="/" className="group flex cursor-pointer items-center gap-3 select-none">
              <div 
                style={{ backgroundColor: '#8ba895' }}
                className="rounded-glass-sm text-background flex h-9 w-9 shrink-0 items-center justify-center font-mono text-base font-bold transition-all duration-300 group-hover:scale-105"
              >
                M
              </div>
              <span className="text-foreground group-hover:text-sage font-sans text-lg font-medium tracking-tight uppercase transition-all duration-300">
                Meris
              </span>
            </Link>

            {/* Breadcrumb Divider */}
            <div className="h-4 w-px bg-white/10" />

            {/* Breadcrumb Path */}
            <nav className="text-foreground/35 flex items-center gap-2 font-mono text-[10px] font-bold tracking-wider" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-foreground transition-colors">HOME</Link>
              <svg className="text-foreground/15 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
              <span className="text-sage font-sans font-medium tracking-normal uppercase">Session</span>
            </nav>
          </div>

          {/* Desktop Right Side spacer */}
          <div className="hidden md:block">
            {/* Keeping it empty to focus attention on the breadcrumb */}
          </div>

        </div>
      </header>

      {/* Main Layout */}
      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-4 pb-8 sm:gap-16 sm:px-10 sm:pt-8 sm:pb-16">
        
        {/* Mobile Only: Header Title & Integrated Card (Untouched for Mobile) */}
        <section className="flex flex-col gap-4 md:hidden">
          <div className="space-y-3">
            <h1 className="text-foreground font-serif text-3xl leading-tight tracking-tight">
              Reviewing the <span className="text-sage font-sans font-light">Meris</span>
            </h1>
          </div>
          <div className="glass-panel rounded-glass space-y-4 border-white/5 bg-white/1 p-5">
            {/* Row 1: Session Code with Copy Action (No pulsing dot) */}
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

            {/* Row 2: Identity & Switch Account (if joined) OR Join Form (if not joined) */}
            {isJoined ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div 
                    style={{ backgroundColor: '#8ba895' }}
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
                    style={{ backgroundColor: '#8ba895' }}
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

        {/* Desktop Header Banner (Hidden on Mobile) */}
        <section className="glass-panel rounded-glass relative hidden overflow-hidden border-white/5 bg-white/1 p-8 md:block">
          <div className="bg-orb-sage pointer-events-none absolute top-0 right-0 h-96 w-96 opacity-10 blur-[150px]" />
          
          <div className="relative z-10 flex flex-col gap-6">
            {/* Top row: Title & Share Button */}
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

            {/* Divider line */}
            <div className="h-px w-full bg-white/5" />

            {/* Bottom row: Session Code & Identity Section */}
            <div className="relative flex items-center justify-between gap-6 font-sans text-sm">
              
              {/* Left Side: Session Code details */}
              <div className="text-foreground/70 flex items-center gap-2">
                <span className="text-foreground/45 font-mono text-xs tracking-wider uppercase">Code:</span>
                <span className="text-sage font-mono font-bold tracking-wider select-all">{sessionId}</span>
              </div>

              {/* Vertical Separator */}
              <div className="h-4 w-px bg-white/10" />

              {/* Right Side: Participant Identity / Join Action */}
              <div className="flex max-w-xl flex-1 justify-end">
                {isJoined ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div 
                        style={{ backgroundColor: '#8ba895' }}
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
                      style={{ backgroundColor: '#8ba895' }}
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

        {/* Main Grid Content */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-16">
          
          {/* Items Column */}
          <div className="space-y-6 sm:space-y-12 lg:col-span-8">
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

          {/* Sidebar Column */}
          <div className="space-y-8 sm:space-y-16 lg:col-span-4">
            
            {/* Bill Summary */}
            <div className="glass-panel rounded-glass space-y-6 border-white/5 bg-white/1 p-6 sm:space-y-10 sm:p-10">
              <h2 className="text-foreground border-b border-white/5 pb-4 font-sans text-xl font-normal sm:pb-6 sm:text-2xl">
                Bill Summary
              </h2>

              <div className="space-y-4 font-sans text-sm sm:space-y-6 sm:text-base">
                <div className="text-foreground/40 flex justify-between text-[10px] font-bold tracking-widest uppercase sm:text-xs sm:tracking-[0.2em]">
                  <span>Subtotal</span>
                  <span className="text-foreground/80">{formatRupiah(totalSubtotal)}</span>
                </div>
                <div className="text-foreground/40 flex justify-between text-[10px] font-bold tracking-widest uppercase sm:text-xs sm:tracking-[0.2em]">
                  <span>Tax (PPN)</span>
                  <span className="text-foreground/80">{formatRupiah(tax)}</span>
                </div>
                <div className="text-foreground/40 flex justify-between text-[10px] font-bold tracking-widest uppercase sm:text-xs sm:tracking-[0.2em]">
                  <span>Service</span>
                  <span className="text-foreground/80">{formatRupiah(serviceCharge)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-t border-white/10 pt-6 sm:pt-8">
                  <span className="text-foreground font-sans text-sm font-semibold tracking-wider uppercase sm:text-base">Grand Total</span>
                  <span className="text-sage text-glow-sage shrink-0 font-sans text-xl leading-none font-bold sm:text-2xl">{formatRupiah(grandTotal)}</span>
                </div>
              </div>
            </div>

            <div id="breakdown-section" className="space-y-8 sm:space-y-16">
              {/* Breakdown List */}
              <ParticipantBreakdown
                participants={participants}
                items={items}
                totalSubtotal={totalSubtotal}
                tax={tax}
                serviceCharge={serviceCharge}
                userName={userName}
                isJoined={isJoined}
                isPayer={isPayer}
                payerName={payerName}
                onRemoveParticipant={removeParticipant}
                formatRupiah={formatRupiah}
                getAvatarBg={getAvatarBg}
                getInitials={getInitials}
              />

              {/* Payment Details */}
              <div className="glass-panel rounded-glass border-sage/10 bg-sage/2 relative space-y-6 overflow-hidden p-6 sm:space-y-8 sm:p-10">
                 <div className="via-sage/40 absolute top-0 left-0 h-1.5 w-full bg-linear-to-r from-transparent to-transparent" />
                 <h3 className="text-sage text-center text-[10px] font-bold tracking-[0.2em] uppercase sm:tracking-[0.4em]">Settlement Information</h3>
               
               <div className="space-y-6 sm:space-y-8">
                 <div className="space-y-1 text-center sm:space-y-2">
                   <p className="text-foreground/20 text-[9px] font-bold tracking-[0.2em] uppercase sm:text-[10px] sm:tracking-[0.3em]">Payment Method</p>
                   <p className="text-foreground font-serif text-xl font-light tracking-tight sm:text-2xl">{payerBankName || "Not specified"}</p>
                 </div>

                 {payerBankAccount && (
                   <div className="space-y-1 text-center sm:space-y-2">
                     <p className="text-foreground/20 text-[9px] font-bold tracking-[0.2em] uppercase sm:text-[10px] sm:tracking-[0.3em]">Account Number</p>
                     <div className="flex items-center justify-center gap-2">
                       <span className="text-foreground font-mono text-xl font-semibold tracking-wider sm:text-2xl">
                         {payerBankAccount}
                       </span>
                       <button
                         onClick={handleCopyAccount}
                         className="text-sage cursor-pointer p-1 transition-colors hover:text-white"
                         title="Copy Account Number"
                       >
                         {copyAccountSuccess ? (
                           <svg className="text-sage h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                             <path d="M20 6 9 17l-5-5"/>
                           </svg>
                         ) : (
                           <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                             <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                             <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                           </svg>
                         )}
                       </button>
                     </div>
                   </div>
                 )}
                 
                  <div className="space-y-1 text-center sm:space-y-2">
                    <p className="text-foreground/20 text-[9px] font-bold tracking-[0.2em] uppercase sm:text-[10px] sm:tracking-[0.3em]">Account Owner</p>
                    <p className="text-foreground font-sans text-lg font-normal tracking-tight sm:text-xl">{payerName || "Anonymous Payer"}</p>
                  </div>
                </div>
             </div>
            </div>

           </div>
         </div>

      </main>

      {/* Footer Branding */}
      <footer className="mt-24 border-t border-white/5 py-12 opacity-40">
        <div className="text-foreground/40 mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-[10px] font-bold tracking-[0.3em] uppercase sm:flex-row">
          <p>Meris &copy; 2026</p>
          <p className="font-mono tracking-normal uppercase opacity-50">Session: {sessionId}</p>
        </div>
      </footer>

      {isJoined && (
        <div className="bg-background/80 fixed right-0 bottom-0 left-0 z-40 flex items-center justify-between border-t border-white/5 p-4 shadow-2xl backdrop-blur-xl lg:hidden">
          <div className="flex flex-col text-left">
            <span className="text-foreground/30 font-mono text-[10px] font-bold tracking-[0.2em] uppercase">Your Share</span>
            <span className="text-sage text-glow-sage text-xl font-bold">{formatRupiah(currentUserTotal)}</span>
          </div>
          <button
            onClick={() => {
              const breakdownEl = document.getElementById("breakdown-section");
              breakdownEl?.scrollIntoView({ behavior: "smooth" });
            }}
            style={{ backgroundColor: '#8ba895' }}
            className="rounded-glass-sm text-background cursor-pointer px-5 py-2.5 font-sans text-xs font-bold tracking-wider uppercase transition-all active:scale-[0.98]"
          >
            View Details
          </button>
        </div>
      )}
    </div>
  );
}
