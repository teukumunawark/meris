"use client";

import React, { use, useEffect, useState, useRef } from "react";

interface ParticipantClaim {
  name: string;
  shares: number; // e.g. 0.5, 1, 2
}

interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  claims: ParticipantClaim[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClaimSessionPage({ params }: PageProps) {
  // Unwrap parameters using React 19 use()
  const resolvedParams = use(params);
  const sessionId = resolvedParams.id;

  // App States
  const [userName, setUserName] = useState<string>("");
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [tax, setTax] = useState<number>(16800); // Default mock tax
  const [serviceCharge, setServiceCharge] = useState<number>(8400); // Default mock service charge
  const [logs, setLogs] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  
  // Ref for auto-scrolling log
  const logEndRef = useRef<HTMLDivElement>(null);

  // Initialize Mock Data
  useEffect(() => {
    // Initial mock list representing a restaurant receipt
    const initialItems: ReceiptItem[] = [
      {
        id: "item-1",
        name: "Nasi Goreng Seafood Special",
        price: 45000,
        quantity: 2,
        claims: [{ name: "Alice", shares: 1 }],
      },
      {
        id: "item-2",
        name: "Chicken Cordon Bleu",
        price: 65000,
        quantity: 1,
        claims: [],
      },
      {
        id: "item-3",
        name: "Garlic Bread",
        price: 25000,
        quantity: 1,
        claims: [
          { name: "Alice", shares: 0.5 },
          { name: "Bob", shares: 0.5 },
        ],
      },
      {
        id: "item-4",
        name: "Ice Sweet Tea",
        price: 15000,
        quantity: 3,
        claims: [{ name: "Bob", shares: 1 }],
      },
      {
        id: "item-5",
        name: "Es Jeruk Peras",
        price: 18000,
        quantity: 2,
        claims: [],
      },
    ];
    setItems(initialItems);
    addLog("System initialized with default mock items.");
  }, []);

  // SSE EventSource Connection
  useEffect(() => {
    if (!sessionId) return;

    const sseUrl = `http://localhost:8080/stream?sessionId=${sessionId}`;
    addLog(`Connecting to Server-Sent Events stream at: ${sseUrl}`);
    setConnectionStatus("connecting");

    let eventSource: EventSource;
    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        setConnectionStatus("connected");
        addLog(`SSE connection established successfully for session ID: ${sessionId}`);
      };

      eventSource.onmessage = (event) => {
        const rawData = event.data;
        addLog(`Received SSE broadcast: "${rawData}"`);

        // Handle JSON updates
        try {
          const parsed = JSON.parse(rawData);
          if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed.items)) {
              const updatedItems = parsed.items.map((item: any, idx: number) => ({
                id: item.id || `item-${idx}`,
                name: item.name || "Unnamed Item",
                price: typeof item.price === "number" ? item.price : 0,
                quantity: typeof item.quantity === "number" ? item.quantity : 1,
                claims: Array.isArray(item.claims) ? item.claims : [],
              }));
              setItems(updatedItems);
              addLog("Updated items list based on server broadcast.");
            }
            if (typeof parsed.tax === "number") {
              setTax(parsed.tax);
            }
            if (typeof parsed.service_charge === "number") {
              setServiceCharge(parsed.service_charge);
            } else if (typeof parsed.serviceCharge === "number") {
              setServiceCharge(parsed.serviceCharge);
            }
          }
        } catch (_) {
          // Not a JSON message, it's just a raw message string
        }
      };

      eventSource.onerror = () => {
        setConnectionStatus("disconnected");
        addLog("SSE stream disconnected or server is offline. Ready to run locally in standalone mode.");
      };
    } catch (err) {
      setConnectionStatus("disconnected");
      addLog(`Failed to construct EventSource: ${err}`);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
        addLog("Closed SSE connection stream.");
      }
    };
  }, [sessionId]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Logger helper
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  // Copy share link helper
  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true);
      addLog("Copied sharing session link to clipboard.");
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Join session handler
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;
    setIsJoined(true);
    addLog(`Joined session as guest user: "${userName.trim()}"`);
  };

  // Claim portion of an item
  const handleUpdateClaim = (itemId: string, increment: number) => {
    if (!userName.trim()) {
      addLog("Warning: Cannot claim item. Please enter your name first.");
      return;
    }

    const targetUser = userName.trim();
    
    setItems((prevItems) => {
      return prevItems.map((item) => {
        if (item.id !== itemId) return item;

        // Calculate total shares claimed by others
        const claimsByOthers = item.claims.filter((c) => c.name !== targetUser);
        const totalClaimedByOthers = claimsByOthers.reduce((sum, c) => sum + c.shares, 0);

        // Find target user's current claim
        const userClaim = item.claims.find((c) => c.name === targetUser);
        const currentShares = userClaim ? userClaim.shares : 0;
        
        let newShares = currentShares + increment;
        // Bound checks
        if (newShares < 0) newShares = 0;
        if (totalClaimedByOthers + newShares > item.quantity) {
          // Cap at remaining quantity
          newShares = item.quantity - totalClaimedByOthers;
        }

        // Reconstruct claims array
        const newClaims = [...claimsByOthers];
        if (newShares > 0) {
          newClaims.push({ name: targetUser, shares: newShares });
        }

        addLog(`Updated claim for "${item.name}": ${targetUser} changed claim from ${currentShares} to ${newShares} shares (Item Qty: ${item.quantity}).`);
        return {
          ...item,
          claims: newClaims,
        };
      });
    });
  };

  // Get current claims details for the active user
  const getUserClaimShares = (item: ReceiptItem, name: string): number => {
    const claim = item.claims.find((c) => c.name === name);
    return claim ? claim.shares : 0;
  };

  // Get total shares claimed by anyone for an item
  const getTotalClaimedShares = (item: ReceiptItem): number => {
    return item.claims.reduce((sum, c) => sum + c.shares, 0);
  };

  // --- Calculations ---

  // 1. Total subtotal of all items in the receipt (fixed)
  const totalSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  // 2. Grand total of receipt (fixed)
  const grandTotal = totalSubtotal + tax + serviceCharge;

  // 3. Extract unique participant names in the session
  const participants = Array.from(
    new Set([
      ...items.flatMap((item) => item.claims.map((c) => c.name)),
      ...(isJoined && userName.trim() ? [userName.trim()] : []),
    ])
  );

  // 4. Calculate individual subtotals and shares
  const participantBreakdowns = participants.map((name) => {
    const personSubtotal = items.reduce((sum, item) => {
      const userClaim = item.claims.find((c) => c.name === name);
      const shares = userClaim ? userClaim.shares : 0;
      return sum + item.price * shares;
    }, 0);

    const proportion = totalSubtotal > 0 ? personSubtotal / totalSubtotal : 0;
    const personTax = proportion * tax;
    const personService = proportion * serviceCharge;
    const personTotal = personSubtotal + personTax + personService;

    // Items claimed list
    const claimedItems = items
      .filter((item) => item.claims.some((c) => c.name === name))
      .map((item) => {
        const shares = item.claims.find((c) => c.name === name)!.shares;
        return {
          name: item.name,
          shares,
          price: item.price,
          totalPrice: item.price * shares,
        };
      });

    return {
      name,
      subtotal: personSubtotal,
      tax: personTax,
      serviceCharge: personService,
      total: personTotal,
      claimedItems,
    };
  });

  // Calculate overall progress of claimed parts
  const totalClaimedSubtotal = items.reduce((sum, item) => {
    const claimedShares = getTotalClaimedShares(item);
    return sum + item.price * claimedShares;
  }, 0);

  const claimProgressPercent = totalSubtotal > 0 ? Math.round((totalClaimedSubtotal / totalSubtotal) * 100) : 0;

  // Formatter for currency
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Get clean initials for user avatars
  const getInitials = (name: string) => {
    return name.trim().slice(0, 2).toUpperCase();
  };

  // Avatar bg helper
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

  // Developer Simulators
  const handleSimulateClientAction = (actor: string, actionType: "claim" | "reset") => {
    if (actionType === "claim") {
      // Pick a random item that has unclaimed portions
      const availableItems = items.filter((item) => {
        const remaining = item.quantity - getTotalClaimedShares(item);
        return remaining > 0;
      });

      if (availableItems.length === 0) {
        addLog(`[Simulator] All items are fully claimed. Cannot simulate claim for ${actor}.`);
        return;
      }

      const randomItem = availableItems[Math.floor(Math.random() * availableItems.length)];
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== randomItem.id) return it;

          const existingClaim = it.claims.find((c) => c.name === actor);
          const currentShares = existingClaim ? existingClaim.shares : 0;
          
          // Claim 0.5 if it can split, or 1 portion
          const remaining = it.quantity - getTotalClaimedShares(it);
          const claimAmt = remaining >= 1 ? 1 : remaining;
          
          const filteredClaims = it.claims.filter((c) => c.name !== actor);
          const newClaims = [...filteredClaims, { name: actor, shares: currentShares + claimAmt }];

          addLog(`[Simulator] Broadcast: User "${actor}" claimed ${claimAmt} share of "${it.name}"`);
          return { ...it, claims: newClaims };
        })
      );
    } else {
      // Reset actor claims
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          claims: it.claims.filter((c) => c.name !== actor),
        }))
      );
      addLog(`[Simulator] Broadcast: User "${actor}" cleared all their claims`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-slate-950 to-black text-zinc-100 antialiased font-sans">
      
      {/* Navbar Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-violet-500/20">
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

          {/* SSE Stream Connection Badge */}
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

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        
        {/* Top Session Share Card */}
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
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-semibold transition-all duration-200 active:scale-95"
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

            <a
              href="/"
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:bg-zinc-900 text-sm font-semibold text-zinc-300 hover:text-white transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              <span>Back Home</span>
            </a>
          </div>
        </section>

        {/* User Identity / Join section */}
        {!isJoined ? (
          <section className="bg-gradient-to-br from-violet-950/20 via-zinc-900/40 to-indigo-950/20 border border-violet-900/20 backdrop-blur-md rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_0_50px_rgba(99,102,241,0.05)]">
            <div className="space-y-2 max-w-xl">
              <h2 className="text-xl font-bold text-white">Join the Bill Claiming</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Enter your guest name to start selecting items you consumed. The system calculates your proportional taxes and services instantly.
              </p>
            </div>

            <form onSubmit={handleJoin} className="flex flex-col sm:flex-row items-stretch gap-3 w-full md:max-w-md">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name (e.g. Charlie)"
                required
                maxLength={20}
                className="flex-1 px-4 py-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 font-medium transition-all"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-violet-600/30 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Join & Claim</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </form>
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
              onClick={() => {
                setIsJoined(false);
                addLog(`Cleared user identity session name.`);
              }}
              className="text-xs text-zinc-400 hover:text-white hover:underline transition-all"
            >
              Change Name
            </button>
          </section>
        )}

        {/* Claim progress banner */}
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

        {/* Main Grid: Left (Items Table) and Right (Individual Summary calculations) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Panel: Items list */}
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
                {items.map((item) => {
                  const totalClaimed = getTotalClaimedShares(item);
                  const userClaimAmt = isJoined ? getUserClaimShares(item, userName) : 0;
                  const isFullyClaimed = totalClaimed >= item.quantity;
                  const remainingQty = item.quantity - totalClaimed;

                  return (
                    <div
                      key={item.id}
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

                        {/* Avatars of claimants */}
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
                            onClick={() => handleUpdateClaim(item.id, -0.5)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold hover:bg-zinc-800 active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent text-zinc-400 hover:text-white transition-all"
                            title="Unclaim 0.5 portion"
                          >
                            -
                          </button>
                          
                          <div className="w-14 text-center font-mono text-xs font-bold flex flex-col justify-center">
                            <span className="text-[10px] text-zinc-500 block leading-none">CLAIM</span>
                            <span className="text-zinc-200 text-sm mt-0.5">{userClaimAmt}</span>
                          </div>

                          <button
                            disabled={!isJoined || isFullyClaimed}
                            onClick={() => handleUpdateClaim(item.id, 0.5)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold hover:bg-zinc-800 active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent text-zinc-400 hover:text-white transition-all"
                            title="Claim 0.5 portion"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel: Summary calculations */}
          <div className="space-y-6">
            
            {/* Bill Info Summary */}
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

            {/* Proportional breakdown calculations per person */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md rounded-3xl p-6 space-y-6">
              <h2 className="text-lg font-bold text-white flex items-center justify-between">
                <span>Proportional Splitting</span>
                <span className="text-xs text-zinc-500 font-semibold">{participants.length} active</span>
              </h2>

              {participantBreakdowns.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No one has claimed any items yet.</p>
              ) : (
                <div className="space-y-5">
                  {participantBreakdowns.map((p, idx) => {
                    const isCurrentUser = isJoined && p.name === userName.trim();
                    const percentOfReceipt = totalSubtotal > 0 ? Math.round((p.subtotal / totalSubtotal) * 100) : 0;

                    return (
                      <div
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

                        {/* Calculation components */}
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

                        {/* List of claimed items */}
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payer Payment Target Info */}
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
        <section className="bg-zinc-950/40 border border-zinc-800/60 rounded-3xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>Dev Simulation Panel</span>
              </h3>
              <p className="text-xs text-zinc-500">Simulate incoming Server-Sent Events to test real-time collaboration.</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleSimulateClientAction("Alice", "claim")}
                className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold transition"
              >
                + Alice Claim
              </button>
              <button
                onClick={() => handleSimulateClientAction("Bob", "claim")}
                className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold transition"
              >
                + Bob Claim
              </button>
              <button
                onClick={() => {
                  handleSimulateClientAction("Alice", "reset");
                  handleSimulateClientAction("Bob", "reset");
                }}
                className="px-3 py-1 rounded bg-zinc-800/50 hover:bg-rose-950/30 hover:text-rose-400 hover:border-rose-900 border border-transparent text-[11px] font-semibold transition"
              >
                Clear Simulators
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const customMsg = `Demo Broadcast event fired at ${new Date().toLocaleTimeString()}`;
                addLog(`[Simulator] Sending custom broadcast message: "${customMsg}"`);
                // Simulate an SSE event arriving
                const event = new MessageEvent("message", {
                  data: JSON.stringify({
                    message: customMsg,
                    timestamp: Date.now()
                  })
                });
                window.dispatchEvent(new CustomEvent("simulate-sse", { detail: event }));
              }}
              className="px-4 py-2 rounded-xl bg-violet-950/20 border border-violet-900/40 hover:bg-violet-900/30 text-xs font-semibold text-violet-300 transition"
            >
              Broadcast Mock Text Message
            </button>

            <button
              onClick={() => {
                // Generate a random bill status structure & broadcast it
                const simulationItems = items.map(it => {
                  // Randomize claims somewhat
                  const rand = Math.random();
                  const simulatedClaims = [...it.claims];
                  if (rand > 0.6 && getTotalClaimedShares(it) < it.quantity) {
                    simulatedClaims.push({ name: "David", shares: 0.5 });
                  }
                  return {
                    id: it.id,
                    name: it.name,
                    price: it.price,
                    quantity: it.quantity,
                    claims: simulatedClaims
                  };
                });
                const payload = JSON.stringify({
                  items: simulationItems,
                  tax: tax,
                  serviceCharge: serviceCharge
                });
                addLog(`[Simulator] Simulating server push of full receipt update.`);
                
                // Trigger the handler directly by invoking message callback
                // In our SSE useEffect we listen on EventSource, so we simulate EventSource dispatch or trigger state directly
                setItems(simulationItems);
                addLog(`[Simulator] SSE JSON update applied.`);
              }}
              className="px-4 py-2 rounded-xl bg-indigo-950/20 border border-indigo-900/40 hover:bg-indigo-900/30 text-xs font-semibold text-indigo-300 transition"
            >
              Push Mock Receipt Update
            </button>
          </div>
        </section>

        {/* Console Event Logs Panel */}
        <section className="bg-zinc-950/80 border border-zinc-900 rounded-3xl overflow-hidden shadow-inner flex flex-col h-64">
          <div className="px-5 py-3.5 bg-zinc-900/50 border-b border-zinc-900 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-extrabold text-zinc-400">Live SSE Event Logs</span>
            <button
              onClick={() => setLogs([])}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase font-semibold transition"
            >
              Clear Logs
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] text-zinc-300 space-y-2 select-text">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className={`py-0.5 border-l-2 pl-2 ${
                  log.includes("[Error]")
                    ? "border-rose-500 text-rose-300 bg-rose-950/10"
                    : log.includes("[System]")
                    ? "border-violet-500 text-violet-300"
                    : log.includes("[SSE]")
                    ? "border-emerald-500 text-emerald-300"
                    : log.includes("[Simulator]")
                    ? "border-amber-500 text-amber-300"
                    : "border-zinc-800 text-zinc-400"
                }`}
              >
                {log}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-zinc-900 bg-zinc-950/50 text-center text-xs text-zinc-600">
        <p>© 2026 SplitBill AI. Built for seamless and proportional expense sharing.</p>
      </footer>
    </div>
  );
}
