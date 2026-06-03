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
  // Unwrap parameters using React 19 use()
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div 
          style={{ borderTopColor: '#8ba895' }}
          className="w-12 h-12 rounded-full border-4 border-sage/10 animate-spin" 
        />
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen bg-background text-foreground antialiased font-sans overflow-x-hidden ${isJoined ? 'pb-32 lg:pb-20' : 'pb-20'}`}>
      {/* Background Ambience */}
      <div className="fixed top-[-10%] right-[-10%] w-[60%] h-[60%] bg-orb-sage blur-[120px] rounded-full opacity-20 pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-orb-slate blur-[120px] rounded-full opacity-10 pointer-events-none" />

      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-16 sm:h-20 flex items-center justify-between px-4 sm:px-10 relative">
          
          {/* MOBILE NAVBAR ELEMENTS (Hidden on Desktop) */}
          {/* Mobile Left: Back Button */}
          <div className="flex md:hidden items-center">
            <Link
              href="/"
              className="flex items-center justify-center p-2 rounded-full bg-white/[0.03] border border-white/10 hover:bg-white/10 text-foreground/75 hover:text-foreground transition-all duration-300 cursor-pointer active:scale-95 shrink-0"
              title="Back to Home"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 19-7-7 7-7"/>
                <path d="M19 12H5"/>
              </svg>
            </Link>
          </div>

          {/* Mobile Center: Logo (No [M]) */}
          <Link href="/" className="md:hidden absolute left-1/2 -translate-x-1/2 flex items-center group cursor-pointer select-none">
            <span className="font-sans text-base text-foreground tracking-[0.2em] font-semibold uppercase group-hover:text-sage transition-all duration-300">
              Meris
            </span>
          </Link>

          {/* Mobile Right Spacer */}
          <div className="md:hidden w-8 h-8 opacity-0 pointer-events-none" aria-hidden="true" />

          {/* DESKTOP NAVBAR ELEMENTS (Hidden on Mobile) */}
          {/* Desktop Left: Logo [M] Meris + Breadcrumb */}
          <div className="hidden md:flex items-center gap-6">
            {/* Desktop Clickable Logo */}
            <Link href="/" className="flex items-center gap-3 group cursor-pointer select-none">
              <div 
                style={{ backgroundColor: '#8ba895' }}
                className="w-9 h-9 rounded-glass-sm flex items-center justify-center font-mono font-bold text-background text-base shrink-0 group-hover:scale-105 transition-all duration-300"
              >
                M
              </div>
              <span className="font-sans text-lg text-foreground tracking-tight font-medium uppercase group-hover:text-sage transition-all duration-300">
                Meris
              </span>
            </Link>

            {/* Breadcrumb Divider */}
            <div className="h-4 w-px bg-white/10" />

            {/* Breadcrumb Path */}
            <nav className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-wider text-foreground/35" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-foreground transition-colors">HOME</Link>
              <svg className="w-3 h-3 text-foreground/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
              <span className="text-sage font-sans font-medium uppercase tracking-normal">Session</span>
            </nav>
          </div>

          {/* Desktop Right Side spacer */}
          <div className="hidden md:block">
            {/* Keeping it empty to focus attention on the breadcrumb */}
          </div>

        </div>
      </header>

      {/* Main Layout */}
      <main className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-10 pt-4 sm:pt-8 pb-8 sm:pb-16 flex flex-col gap-8 sm:gap-16">
        
        {/* Mobile Only: Header Title & Integrated Card (Untouched for Mobile) */}
        <section className="md:hidden flex flex-col gap-4">
          <div className="space-y-3">
            <h1 className="text-3xl font-serif text-foreground tracking-tight leading-tight">
              Reviewing the <span className="text-sage font-sans font-light">Meris</span>
            </h1>
          </div>
          <div className="glass-panel rounded-glass p-5 border-white/5 space-y-4 bg-white/[0.01]">
            {/* Row 1: Session Code with Copy Action (No pulsing dot) */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono text-foreground/40 uppercase tracking-wider shrink-0">Code:</span>
                <span className="text-sm font-mono font-bold text-sage tracking-wider truncate">{sessionId}</span>
              </div>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-glass-sm bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-bold uppercase tracking-wider text-foreground/70 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                {copySuccess ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-sage" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                    <span className="text-sage">Copied</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                <div className="flex items-center gap-2.5 min-w-0">
                  <div 
                    style={{ backgroundColor: '#8ba895' }}
                    className="w-7 h-7 rounded-full text-background flex items-center justify-center font-bold text-xs shrink-0"
                  >
                    {getInitials(userName)}
                  </div>
                  <p className="text-xs font-sans text-foreground/70 truncate">
                    Joined as <span className="font-bold text-foreground">{userName}</span>
                  </p>
                </div>
                <button
                  onClick={changeName}
                  className="px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-bold uppercase tracking-wider text-foreground/60 transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Switch Account
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">Who are you?</p>
                <div className="flex items-stretch gap-2">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Guest Name"
                    maxLength={20}
                    className="flex-1 min-w-0 px-3 py-2 rounded-glass-sm bg-white/[0.03] border border-white/10 text-foreground text-xs placeholder:text-foreground/20 focus:outline-none focus:ring-1 focus:ring-sage/40 transition-all font-sans"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") joinSession(userName);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => joinSession(userName)}
                    style={{ backgroundColor: '#8ba895' }}
                    className="flex-shrink-0 px-4 py-2 rounded-glass-sm text-background font-bold text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap text-center"
                  >
                    Join
                  </button>
                </div>
                {joinError && (
                  <p className="text-rose-400 text-[10px] font-sans mt-1">{joinError}</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Desktop Header Banner (Hidden on Mobile) */}
        <section className="hidden md:block glass-panel rounded-glass p-8 border-white/5 bg-white/[0.01] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-orb-sage blur-[150px] opacity-10 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col gap-6">
            {/* Top row: Title & Share Button */}
            <div className="flex items-center justify-between gap-6">
              <h1 className="text-4xl lg:text-5xl font-serif text-foreground tracking-tight leading-tight">
                Reviewing the <span className="text-sage font-sans font-light">Meris</span>
              </h1>
              
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2.5 px-5 py-3 rounded-glass-sm glass-panel glass-panel-hover text-xs font-bold uppercase tracking-[0.1em] text-foreground/80 hover:text-foreground transition-all active:scale-95 cursor-pointer"
              >
                {copySuccess ? (
                  <>
                    <svg className="w-4 h-4 text-sage" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                    <span className="text-sage">Copied</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <span>Share Session</span>
                  </>
                )}
              </button>
            </div>

            {/* Divider line */}
            <div className="h-px bg-white/5 w-full" />

            {/* Bottom row: Session Code & Identity Section */}
            <div className="flex items-center justify-between gap-6 text-sm font-sans relative">
              
              {/* Left Side: Session Code details */}
              <div className="flex items-center gap-2 text-foreground/70">
                <span className="text-xs font-mono uppercase tracking-wider text-foreground/45">Code:</span>
                <span className="font-mono font-bold text-sage tracking-wider select-all">{sessionId}</span>
              </div>

              {/* Vertical Separator */}
              <div className="h-4 w-px bg-white/10" />

              {/* Right Side: Participant Identity / Join Action */}
              <div className="flex-1 max-w-xl flex justify-end">
                {isJoined ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div 
                        style={{ backgroundColor: '#8ba895' }}
                        className="w-8 h-8 rounded-full text-background flex items-center justify-center font-bold text-xs shrink-0 shadow-inner"
                      >
                        {getInitials(userName)}
                      </div>
                      <p className="text-foreground/70">
                        You are participating as <span className="font-bold text-foreground">{userName}</span>
                      </p>
                    </div>
                    <button
                      onClick={changeName}
                      className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-foreground/60 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                    >
                      Switch Account
                    </button>
                  </div>
                ) : (
                  <div className="w-full flex items-center justify-end gap-3 relative">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/35 whitespace-nowrap">Who are you?</span>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Enter Guest Name"
                      maxLength={20}
                      className="w-48 px-3.5 py-1.5 rounded-glass-sm bg-white/[0.03] border border-white/10 text-foreground text-xs placeholder:text-foreground/20 focus:outline-none focus:ring-1 focus:ring-sage/40 transition-all font-sans"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") joinSession(userName);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => joinSession(userName)}
                      style={{ backgroundColor: '#8ba895' }}
                      className="px-4 py-1.5 rounded-glass-sm text-background font-bold text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                    >
                      Join & Claim
                    </button>
                    {joinError && (
                      <p className="text-rose-400 text-[10px] font-sans absolute bottom-[-22px] right-0">{joinError}</p>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </section>

        {/* Progress Section */}
        <section className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-white/5 pb-3">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-foreground/30 font-mono">
              COLLABORATION STATE // CLAIMING
            </span>
            <span className="text-sm font-mono font-bold text-sage">
              {claimProgressPercent}% COMPLETE
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 h-4 sm:h-5">
            {Array.from({ length: 20 }).map((_, i) => {
              const isActive = i < Math.round((claimProgressPercent / 100) * 20);
              return (
                <div 
                  key={i}
                  className={`h-full flex-1 transition-all duration-700 ease-out ${
                    isActive 
                      ? "bg-sage" 
                      : "bg-white/2 border border-white/5"
                  }`}
                />
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-foreground/20">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-sage inline-block" />
              <span>CLAIMED: {formatRupiah(totalClaimedSubtotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-white/10 inline-block" />
              <span>TOTAL INVENTORY: {formatRupiah(totalSubtotal)}</span>
            </div>
          </div>
        </section>

        {/* Main Grid Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
          
          {/* Items Column */}
          <div className="lg:col-span-8 space-y-6 sm:space-y-12">
            <div className="flex items-end justify-between border-b border-white/5 pb-4 sm:pb-6">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-sans text-foreground tracking-tight font-normal">Inventory</h2>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-foreground/20">{items.length} items</span>
            </div>

            {items.length === 0 ? (
              <div className="glass-panel rounded-glass p-12 sm:p-24 text-center border-dashed border-white/10">
                <p className="text-foreground/20 font-sans text-lg sm:text-xl font-normal tracking-wide">No items have been uploaded yet.</p>
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
          <div className="lg:col-span-4 space-y-8 sm:space-y-16">
            
            {/* Bill Summary */}
            <div className="glass-panel rounded-glass p-6 sm:p-10 space-y-6 sm:space-y-10 border-white/5 bg-white/[0.01]">
              <h2 className="text-xl sm:text-2xl font-sans text-foreground font-normal border-b border-white/5 pb-4 sm:pb-6">
                Bill Summary
              </h2>

              <div className="space-y-4 sm:space-y-6 font-sans text-sm sm:text-base">
                <div className="flex justify-between text-foreground/40 uppercase tracking-[0.1em] sm:tracking-[0.2em] text-[10px] sm:text-xs font-bold">
                  <span>Subtotal</span>
                  <span className="text-foreground/80">{formatRupiah(totalSubtotal)}</span>
                </div>
                <div className="flex justify-between text-foreground/40 uppercase tracking-[0.1em] sm:tracking-[0.2em] text-[10px] sm:text-xs font-bold">
                  <span>Tax (PPN)</span>
                  <span className="text-foreground/80">{formatRupiah(tax)}</span>
                </div>
                <div className="flex justify-between text-foreground/40 uppercase tracking-[0.1em] sm:tracking-[0.2em] text-[10px] sm:text-xs font-bold">
                  <span>Service</span>
                  <span className="text-foreground/80">{formatRupiah(serviceCharge)}</span>
                </div>
                <div className="border-t border-white/10 pt-6 sm:pt-8 flex justify-between items-baseline gap-2">
                  <span className="text-foreground font-sans text-sm sm:text-base font-semibold uppercase tracking-wider">Grand Total</span>
                  <span className="text-sage font-sans text-xl sm:text-2xl font-bold text-glow-sage leading-none shrink-0">{formatRupiah(grandTotal)}</span>
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
              <div className="glass-panel rounded-glass p-6 sm:p-10 space-y-6 sm:space-y-8 border-sage/10 relative overflow-hidden bg-sage/[0.02]">
                 <div className="absolute top-0 left-0 w-full h-1.5 bg-linear-to-r from-transparent via-sage/40 to-transparent" />
                 <h3 className="text-[10px] font-bold text-sage uppercase tracking-[0.2em] sm:tracking-[0.4em] text-center">Settlement Information</h3>
               
               <div className="space-y-6 sm:space-y-8">
                 <div className="text-center space-y-1 sm:space-y-2">
                   <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-foreground/20">Payment Method</p>
                   <p className="font-serif text-foreground text-xl sm:text-2xl tracking-tight font-light">{payerBankName || "Not specified"}</p>
                 </div>

                 {payerBankAccount && (
                   <div className="text-center space-y-1 sm:space-y-2">
                     <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-foreground/20">Account Number</p>
                     <div className="flex items-center justify-center gap-2">
                       <span className="font-mono text-foreground text-xl sm:text-2xl tracking-wider font-semibold">
                         {payerBankAccount}
                       </span>
                       <button
                         onClick={handleCopyAccount}
                         className="text-sage hover:text-white p-1 cursor-pointer transition-colors"
                         title="Copy Account Number"
                       >
                         {copyAccountSuccess ? (
                           <svg className="w-4.5 h-4.5 text-sage" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                             <path d="M20 6 9 17l-5-5"/>
                           </svg>
                         ) : (
                           <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                             <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                             <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                           </svg>
                         )}
                       </button>
                     </div>
                   </div>
                 )}
                 
                  <div className="text-center space-y-1 sm:space-y-2">
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-foreground/20">Account Owner</p>
                    <p className="font-sans text-foreground text-lg sm:text-xl tracking-tight font-normal">{payerName || "Anonymous Payer"}</p>
                  </div>
                </div>
             </div>
            </div>

           </div>
         </div>

      </main>

      {/* Footer Branding */}
      <footer className="mt-24 py-12 border-t border-white/5 opacity-40">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40">
          <p>Meris &copy; 2026</p>
          <p className="font-mono tracking-normal opacity-50 uppercase">Session: {sessionId}</p>
        </div>
      </footer>

      {isJoined && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden p-4 bg-background/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-between shadow-2xl">
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-[0.2em] font-mono">Your Share</span>
            <span className="text-xl font-bold text-sage text-glow-sage">{formatRupiah(currentUserTotal)}</span>
          </div>
          <button
            onClick={() => {
              const breakdownEl = document.getElementById("breakdown-section");
              breakdownEl?.scrollIntoView({ behavior: "smooth" });
            }}
            style={{ backgroundColor: '#8ba895' }}
            className="px-5 py-2.5 rounded-glass-sm text-background font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all cursor-pointer font-sans"
          >
            View Details
          </button>
        </div>
      )}
    </div>
  );
}
