"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { useClaimSession } from "./useClaimSession";
import ItemCard from "./ItemCard";
import ParticipantBreakdown from "./ParticipantBreakdown";
import SimulatorPanel from "./SimulatorPanel";
import LogConsole from "./LogConsole";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClaimSessionPage({ params }: PageProps) {
  // Unwrap parameters using React 19 use()
  const resolvedParams = use(params);
  const sessionId = resolvedParams.id;

  // Use Custom Hook for state, SSE sync, claim handlers, and simulators
  const {
    userName,
    setUserName,
    isJoined,
    items,
    tax,
    serviceCharge,
    logs,
    connectionStatus,
    logEndRef,
    joinSession,
    changeName,
    updateClaim,
    simulateClientAction,
    simulateRawMessage,
    simulateReceiptUpdate,
    clearLogs,
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
      "bg-violet-600 text-white border-violet-400",
      "bg-emerald-600 text-white border-emerald-400",
      "bg-amber-600 text-white border-amber-400",
      "bg-rose-600 text-white border-rose-400",
      "bg-indigo-600 text-white border-indigo-400",
      "bg-cyan-600 text-white border-cyan-400",
      "bg-pink-600 text-white border-pink-400",
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

  return (
    <div className="flex flex-col min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-slate-950 to-black text-zinc-100 antialiased font-sans">
      
      {/* Navbar Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-violet-500/20 animate-pulse">
              $
            </div>
            <div>
              <span className="font-bold text-lg bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                SplitBill AI
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                Claim Mode
              </span>
            </div>
          </div>

          {/* SSE Sync Status Badge */}
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-zinc-400">SSE Sync:</span>
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
                connectionStatus === "connected"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : connectionStatus === "connecting"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-emerald-400 animate-ping"
                    : connectionStatus === "connecting"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-zinc-500"
                }`}
              />
              <span className="capitalize">{connectionStatus}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        
        {/* Session Meta Card */}
        <section className="bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-zinc-800 transition-all duration-300">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              Claim Session
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
              <span>Session ID:</span>
              <code className="px-2.5 py-1 rounded bg-zinc-800/80 text-zinc-200 font-mono text-xs font-semibold border border-zinc-700">
                {sessionId}
              </code>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer"
            >
              {copySuccess ? (
                <>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186l.955.513a2.25 2.25 0 010 3.16l-.955.513m0-2.186A2.25 2.25 0 1111.25 7.5v1.125m0-1.125a2.25 2.25 0 10-1.879 2.186l.955.513M12 18.75a2.25 2.25 0 101.879-2.186l-.955-.513m0 2.186a2.25 2.25 0 01-3.16 0l-.955-.513m0 0a2.25 2.25 0 10-1.879-2.186l.955-.513" />
                  </svg>
                  <span>Share Link</span>
                </>
              )}
            </button>

            <Link
              href="/"
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:bg-zinc-900 text-sm font-semibold text-zinc-300 hover:text-white transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              <span>Back Home</span>
            </Link>
          </div>
        </section>

        {/* User Identity Banner or Join Form */}
        {!isJoined ? (
          <section className="bg-gradient-to-br from-violet-950/20 via-zinc-900/40 to-indigo-950/20 border border-violet-900/20 backdrop-blur-md rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_0_50px_rgba(99,102,241,0.05)]">
            <div className="space-y-2 max-w-xl">
              <h2 className="text-xl font-bold text-white">Join the Bill Claiming</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Enter your guest name to start selecting items you consumed. The system calculates your proportional taxes and services instantly.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full md:max-w-md">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name (e.g. Charlie)"
                maxLength={20}
                className="flex-1 px-4 py-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 font-medium transition-all"
                onKeyDown={(e) => {
                  if (e.key === "Enter") joinSession(userName);
                }}
              />
              <button
                type="button"
                onClick={() => joinSession(userName)}
                className="px-6 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-violet-600/30 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Join & Claim</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </section>
        ) : (
          <section className="bg-emerald-950/15 border border-emerald-900/30 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow">
                {getInitials(userName)}
              </div>
              <div>
                <p className="text-xs text-zinc-400">Joined Active Participant</p>
                <p className="text-sm font-bold text-white">
                  {userName} <span className="text-xs font-normal text-emerald-400/90">(You)</span>
                </p>
              </div>
            </div>

            <button
              onClick={changeName}
              className="text-xs text-zinc-400 hover:text-white hover:underline transition-all cursor-pointer"
            >
              Change Name
            </button>
          </section>
        )}

        {/* Claiming Progress indicator */}
        <section className="bg-zinc-950/40 border border-zinc-800/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-sm font-medium">
            <span className="text-zinc-400">Total Claimed Progress</span>
            <span className="text-violet-400 font-mono font-semibold">{claimProgressPercent}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-violet-600 to-indigo-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${claimProgressPercent}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            {formatRupiah(totalClaimedSubtotal)} of {formatRupiah(totalSubtotal)} subtotal claimed
          </p>
        </section>

        {/* Main Grid split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Column: List of items */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight text-white">Items to Claim</h2>
              <span className="text-xs text-zinc-500 font-semibold">{items.length} total items</span>
            </div>

            {items.length === 0 ? (
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-8 text-center">
                <p className="text-zinc-400 text-sm">No items extracted yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    isJoined={isJoined}
                    userName={userName}
                    onUpdateClaim={updateClaim}
                    formatRupiah={formatRupiah}
                    getAvatarBg={getAvatarBg}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Calculations breakdowns & Payment details */}
          <div className="space-y-6">
            
            {/* Bill Receipt Summary */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md rounded-3xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <span>Bill Total Summary</span>
              </h2>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-zinc-200">{formatRupiah(totalSubtotal)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Tax (PPN)</span>
                  <span className="font-mono text-zinc-200">{formatRupiah(tax)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Service Charge</span>
                  <span className="font-mono text-zinc-200">{formatRupiah(serviceCharge)}</span>
                </div>
                <div className="border-t border-zinc-800/80 my-2 pt-2.5 flex justify-between font-bold text-base">
                  <span className="text-white">Grand Total</span>
                  <span className="font-mono text-violet-400">{formatRupiah(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Proportional Split Breakdown List Component */}
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

            {/* Payment Destination Details Card */}
            <div className="bg-gradient-to-tr from-zinc-950 via-zinc-900/50 to-zinc-950 border border-zinc-800/80 rounded-3xl p-6 space-y-3.5 shadow-md">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Payment Destination</h3>
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500">Bank Transfer</span>
                  <span className="font-bold text-zinc-300">Bank Central Asia (BCA)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">Account No.</span>
                  <span className="font-mono text-sm font-bold text-white select-all">872-0941-224</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-zinc-900 pt-2">
                  <span className="text-zinc-500 font-medium">Account Name</span>
                  <span className="text-zinc-300">Munawar</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Developer simulation panel */}
        <SimulatorPanel
          items={items}
          onSimulateClientAction={simulateClientAction}
          onSimulateRawMessage={simulateRawMessage}
          onSimulateReceiptUpdate={simulateReceiptUpdate}
        />

        {/* Logs visual console component */}
        <LogConsole
          logs={logs}
          onClearLogs={clearLogs}
          logEndRef={logEndRef}
        />

      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-zinc-900 bg-zinc-950/50 text-center text-xs text-zinc-600">
        <p>© 2026 SplitBill AI. Built for seamless and proportional expense sharing.</p>
      </footer>
    </div>
  );
}
