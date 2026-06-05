"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { useClaimSession } from "@/entities/session/model/useClaimSession";
import { calculateParticipantBreakdowns } from "@/shared/lib/calculations";
import ClaimBoard from "@/widgets/claim-board/ui/ClaimBoard";
import BillSummary from "@/widgets/bill-summary/ui/BillSummary";

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

  const totalSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = totalSubtotal + tax + serviceCharge;

  const isPayer = isJoined && userName.trim().toLowerCase() === payerName.trim().toLowerCase();

  const totalClaimedSubtotal = items.reduce((sum, item) => {
    const claimedShares = item.claims.reduce((s: number, c) => s + c.shares, 0);
    return sum + item.price * claimedShares;
  }, 0);

  const claimProgressPercent = totalSubtotal > 0 ? Math.round((totalClaimedSubtotal / totalSubtotal) * 100) : 0;

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
          style={{ borderTopColor: "#8ba895" }}
          className="border-sage/10 h-12 w-12 animate-spin rounded-full border-4" 
        />
      </div>
    );
  }

  return (
    <div className={`bg-background text-foreground relative min-h-screen overflow-x-hidden font-sans antialiased ${isJoined ? "pb-24 lg:pb-6" : "pb-6"}`}>
      {/* Background Ambience */}
      <div className="bg-orb-sage pointer-events-none fixed top-[-10%] right-[-10%] h-[60%] w-[60%] rounded-full opacity-20 blur-[120px]" />
      <div className="bg-orb-slate pointer-events-none fixed bottom-[-10%] left-[-10%] h-[60%] w-[60%] rounded-full opacity-10 blur-[120px]" />

      {/* Navbar */}
      <header className="bg-background/80 sticky top-0 z-50 w-full border-b border-white/5 backdrop-blur-xl">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-10">
          
          {/* MOBILE NAVBAR ELEMENTS */}
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

          <Link href="/" className="group absolute left-1/2 flex -translate-x-1/2 cursor-pointer items-center select-none md:hidden">
            <span className="text-foreground group-hover:text-sage font-sans text-base font-semibold tracking-[0.2em] uppercase transition-all duration-300">
              Meris
            </span>
          </Link>

          <div className="pointer-events-none h-8 w-8 opacity-0 md:hidden" aria-hidden="true" />

          {/* DESKTOP NAVBAR ELEMENTS */}
          <div className="hidden items-center gap-6 md:flex">
            <Link href="/" className="group flex cursor-pointer items-center gap-3 select-none">
              <div 
                style={{ backgroundColor: "#8ba895" }}
                className="rounded-glass-sm text-background flex h-9 w-9 shrink-0 items-center justify-center font-mono text-base font-bold transition-all duration-300 group-hover:scale-105"
              >
                M
              </div>
              <span className="text-foreground group-hover:text-sage font-sans text-lg font-medium tracking-tight uppercase transition-all duration-300">
                Meris
              </span>
            </Link>

            <div className="h-4 w-px bg-white/10" />

            <nav className="text-foreground/35 flex items-center gap-2 font-mono text-[10px] font-bold tracking-wider" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-foreground transition-colors">HOME</Link>
              <svg className="text-foreground/15 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
              <span className="text-sage font-sans font-medium tracking-normal uppercase">Session</span>
            </nav>
          </div>

          <div className="hidden md:block" />
        </div>
      </header>

      {/* Main Layout */}
      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-4 pb-4 sm:gap-12 sm:px-10 sm:pt-8 sm:pb-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-16">
          {/* Claim Board Widget */}
          <div className="lg:col-span-8">
            <ClaimBoard
              sessionId={sessionId}
              isJoined={isJoined}
              userName={userName}
              setUserName={setUserName}
              joinSession={joinSession}
              changeName={changeName}
              joinError={joinError}
              items={items}
              updateClaim={updateClaim}
              renameItem={renameItem}
              formatRupiah={formatRupiah}
              getInitials={getInitials}
              handleCopyLink={handleCopyLink}
              copySuccess={copySuccess}
              claimProgressPercent={claimProgressPercent}
              totalClaimedSubtotal={totalClaimedSubtotal}
              totalSubtotal={totalSubtotal}
            />
          </div>

          {/* Sidebar: Bill Summary Widget */}
          <div className="lg:col-span-4">
            <BillSummary
              participants={participants}
              items={items}
              totalSubtotal={totalSubtotal}
              tax={tax}
              serviceCharge={serviceCharge}
              grandTotal={grandTotal}
              userName={userName}
              isJoined={isJoined}
              isPayer={isPayer}
              payerName={payerName}
              payerBankName={payerBankName}
              payerBankAccount={payerBankAccount}
              removeParticipant={removeParticipant}
              formatRupiah={formatRupiah}
              getAvatarBg={getAvatarBg}
              getInitials={getInitials}
              copyAccountSuccess={copyAccountSuccess}
              handleCopyAccount={handleCopyAccount}
            />
          </div>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="mt-8 sm:mt-12 border-t border-white/5 py-3 sm:py-6 opacity-40">
        <div className="text-foreground/40 mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 text-[10px] font-bold tracking-[0.3em] uppercase sm:flex-row">
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
              const breakdownEl = document.getElementById("bill-summary");
              breakdownEl?.scrollIntoView({ behavior: "smooth" });
            }}
            style={{ backgroundColor: "#8ba895" }}
            className="rounded-glass-sm text-background cursor-pointer px-5 py-2.5 font-sans text-xs font-bold tracking-wider uppercase transition-all active:scale-[0.98]"
          >
            View Details
          </button>
        </div>
      )}
    </div>
  );
}
