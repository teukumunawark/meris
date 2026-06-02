"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { useClaimSession } from "./useClaimSession";
import ItemCard from "./ItemCard";
import ParticipantBreakdown from "./ParticipantBreakdown";

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
    joinSession,
    changeName,
    updateClaim,
  } = useClaimSession(sessionId);

  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Copy share link helper
  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
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

  // Extract unique participant list
  const participants = Array.from(
    new Set([
      ...items.flatMap((item) => item.claims.map((c) => c.name)),
      ...(isJoined && userName.trim() ? [userName.trim()] : []),
    ])
  );

  const totalClaimedSubtotal = items.reduce((sum, item) => {
    const claimedShares = item.claims.reduce((s, c) => s + c.shares, 0);
    return sum + item.price * claimedShares;
  }, 0);

  const claimProgressPercent = totalSubtotal > 0 ? Math.round((totalClaimedSubtotal / totalSubtotal) * 100) : 0;

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
    <div className="relative min-h-screen bg-background text-foreground antialiased font-sans overflow-x-hidden pb-20">
      {/* Background Ambience */}
      <div className="fixed top-[-10%] right-[-10%] w-[60%] h-[60%] bg-orb-sage blur-[120px] rounded-full opacity-20 pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-orb-slate blur-[120px] rounded-full opacity-10 pointer-events-none" />

      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-16 sm:h-20 flex items-center justify-between px-4 sm:px-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <div 
              style={{ backgroundColor: '#8ba895' }}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-glass-sm flex items-center justify-center font-mono font-bold text-background text-base sm:text-lg shrink-0"
            >
              $
            </div>
            <span className="font-sans text-lg sm:text-xl text-foreground tracking-tight font-medium uppercase">
              SplitBill <span className="text-sage font-mono font-light">// AI</span>
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-glass-sm bg-white/[0.03] border border-white/10 hover:bg-white/10 text-[10px] sm:text-xs font-mono tracking-wider text-foreground/70 hover:text-foreground transition-all cursor-pointer"
            >
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 19-7-7 7-7"/>
                <path d="M19 12H5"/>
              </svg>
              <span>BACK HOME</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-10 py-8 sm:py-16 flex flex-col gap-8 sm:gap-16">
        
        {/* Header Section */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 sm:gap-10">
          <div className="space-y-3 sm:space-y-6">
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-serif text-foreground tracking-tight leading-tight">
              Reviewing the <span className="text-sage font-sans font-light">Check</span>
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-foreground/30">Session Code</span>
              <code className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-glass-sm bg-white/[0.03] text-sage font-mono text-xs sm:text-sm font-bold border border-white/5">
                {sessionId}
              </code>
            </div>
          </div>

          <div className="w-full md:w-auto">
            <button
              onClick={handleCopyLink}
              className="w-full md:w-auto flex items-center justify-center gap-2 sm:gap-3 px-6 py-4 rounded-glass-sm glass-panel glass-panel-hover text-xs sm:text-sm font-bold uppercase tracking-[0.1em] sm:tracking-widest text-foreground/70 transition-all active:scale-95 cursor-pointer"
            >
              {copySuccess ? (
                <>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-sage" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                  <span className="text-sage">Copied</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                  <span>Share Session</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Identity Bar */}
        {!isJoined ? (
          <section className="glass-panel rounded-glass p-6 sm:p-10 md:p-14 flex flex-col md:flex-row md:items-center justify-between gap-6 sm:gap-10 border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-orb-sage blur-[120px] opacity-10 pointer-events-none" />
            <div className="space-y-3 sm:space-y-6 max-w-xl relative z-10">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-sans text-foreground font-normal">Who are you?</h2>
              <p className="text-base sm:text-lg text-foreground/40 leading-relaxed font-sans">
                Tell us your name so we can accurately track what you consumed. 
                We&apos;ll calculate your share with pinpoint accuracy.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4 w-full md:max-w-lg relative z-10">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Guest Name"
                maxLength={20}
                className="flex-1 min-w-0 px-4 py-3 sm:px-6 sm:py-4 rounded-glass-sm bg-white/[0.03] border border-white/10 text-foreground text-base sm:text-lg placeholder:text-foreground/20 focus:outline-none focus:ring-2 focus:ring-sage/40 transition-all font-sans"
                onKeyDown={(e) => {
                  if (e.key === "Enter") joinSession(userName);
                }}
              />
              <button
                type="button"
                onClick={() => joinSession(userName)}
                style={{ backgroundColor: '#8ba895' }}
                className="flex-shrink-0 px-5 py-3 sm:px-8 sm:py-4 rounded-glass-sm text-background font-bold text-sm sm:text-base uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap text-center"
              >
                Join & Claim
              </button>
            </div>
          </section>
        ) : (
          <section className="glass-panel rounded-glass px-6 py-4 sm:px-10 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 border-sage/10 bg-sage/5">
            <div className="flex items-center gap-4 sm:gap-6">
              <div 
                style={{ backgroundColor: '#8ba895' }}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full text-background flex items-center justify-center font-bold text-sm sm:text-base shrink-0"
              >
                {getInitials(userName)}
              </div>
              <p className="text-sm sm:text-lg font-sans text-foreground/70">
                You are participating as <span className="text-foreground font-bold">{userName}</span>
              </p>
            </div>

            <button
              onClick={changeName}
              className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-foreground/30 hover:text-foreground transition-all cursor-pointer border-b border-white/5 pb-1 self-start sm:self-auto"
            >
              Switch Account
            </button>
          </section>
        )}

        {/* Progress Section */}
        <section className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-white/5 pb-3">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-foreground/30 font-mono">
              COLLABORATION STATE // CLAIMING
            </span>
            <span className="text-sm font-mono font-bold text-sage">
              {claimProgressPercent.toFixed(1)}% COMPLETE
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

            {/* Breakdown List */}
            <ParticipantBreakdown
              participants={participants}
              items={items}
              totalSubtotal={totalSubtotal}
              tax={tax}
              serviceCharge={serviceCharge}
              userName={userName}
              isJoined={isJoined}
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
                   <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-foreground/20">Bank</p>
                   <p className="font-serif text-foreground text-xl sm:text-2xl tracking-tight font-light">Bank Central Asia (BCA)</p>
                 </div>
                 
                 <div className="glass-panel rounded-glass p-4 sm:p-6 text-center border-white/5 bg-white/[0.03]">
                   <p className="font-mono text-lg sm:text-xl md:text-2xl text-sage tracking-[0.1em] sm:tracking-[0.2em] font-bold text-glow-sage select-all">872-0941-224</p>
                   <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-foreground/20 mt-3 sm:mt-4">Account Number</p>
                 </div>

                 <div className="text-center space-y-1 sm:space-y-2">
                   <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-foreground/20">Name</p>
                   <p className="font-sans text-foreground text-lg sm:text-xl tracking-tight font-normal">Munawar</p>
                 </div>
               </div>
            </div>

          </div>
        </div>

      </main>

      {/* Footer Branding */}
      <footer className="mt-24 py-12 border-t border-white/5 opacity-40">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40">
          <p>SplitBill &copy; 2026</p>
          <p className="font-mono tracking-normal opacity-50 uppercase">Session: {sessionId}</p>
        </div>
      </footer>
    </div>
  );
}
