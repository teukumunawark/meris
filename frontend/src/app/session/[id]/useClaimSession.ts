"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ReceiptItem } from "@/utils/calculations";

export interface SSEServerUpdatePayload {
  items?: Array<{
    id?: string;
    name?: string;
    price?: number;
    quantity?: number;
    claims?: Array<{
      name: string;
      shares: number;
    }>;
  }>;
  tax?: number;
  service_charge?: number;
  serviceCharge?: number;
}

export function useClaimSession(sessionId: string) {
  const [userName, setUserName] = useState<string>("");
  const [isJoined, setIsJoined] = useState<boolean>(false);
  
  // Lazy state initializers
  const [items, setItems] = useState<ReceiptItem[]>(() => [
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
  ]);
  const [tax, setTax] = useState<number>(16800); // Default mock tax
  const [serviceCharge, setServiceCharge] = useState<number>(8400); // Default mock service charge
  const [logs, setLogs] = useState<string[]>(() => {
    const timestamp = new Date().toLocaleTimeString();
    return [`[${timestamp}] System initialized with default mock items.`];
  });
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  const logEndRef = useRef<HTMLDivElement>(null);

  // Logger helper
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  // SSE EventSource Connection
  useEffect(() => {
    if (!sessionId) return;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const sseUrl = `${backendUrl}/stream?sessionId=${sessionId}`;
    addLog(`Connecting to Server-Sent Events stream at: ${sseUrl}`);
    setConnectionStatus((prev) => (prev !== "connecting" ? "connecting" : prev));

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
          const parsed = JSON.parse(rawData) as SSEServerUpdatePayload;
          if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed.items)) {
              const updatedItems = parsed.items.map((item, idx: number) => ({
                id: item.id || `item-${idx}`,
                name: item.name || "Unnamed Item",
                price: typeof item.price === "number" ? item.price : 0,
                quantity: typeof item.quantity === "number" ? item.quantity : 1,
                claims: Array.isArray(item.claims)
                  ? item.claims.map((claim) => ({
                      name: typeof claim?.name === "string" ? claim.name.trim() : "Unknown",
                      shares: typeof claim?.shares === "number" ? claim.shares : 0,
                    })).filter(c => c.shares > 0)
                  : [],
              }));
              setItems(updatedItems);
              addLog("Updated items list based on server broadcast.");
            }
            if (typeof parsed.tax === "number") {
              setTax(parsed.tax);
            }
            const sCharge = parsed.service_charge ?? parsed.serviceCharge;
            if (typeof sCharge === "number") {
              setServiceCharge(sCharge);
            }
          }
        } catch (err) {
          // Log JSON parsing failure error for debug logs inside catch block
          const errMsg = err instanceof Error ? err.message : String(err);
          addLog(`[Debug] Incoming SSE is text format, non-JSON parse status: ${errMsg}`);
        }
      };

      eventSource.onerror = (err) => {
        setConnectionStatus("disconnected");
        addLog(`SSE stream disconnected or server offline. Running offline fallback mode. (Error details logged to console)`);
        console.error("SSE connection error:", err);
      };
    } catch (err) {
      setConnectionStatus("disconnected");
      const errMsg = err instanceof Error ? err.message : String(err);
      addLog(`Failed to construct EventSource: ${errMsg}`);
      console.error("EventSource construction failed:", err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
        addLog("Closed SSE connection stream.");
      }
    };
  }, [sessionId]);

  // Scroll to bottom logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Outbound claims syncing to backend
  const syncClaimToBackend = useCallback(async (itemId: string, shares: number): Promise<boolean> => {
    if (process.env.NEXT_PUBLIC_MOCK_API === "true") {
      addLog(`[Mock] Claim sync skipped (NEXT_PUBLIC_MOCK_API === "true").`);
      return true;
    }

    const targetUser = userName.trim();
    if (!targetUser) return false;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const url = `${backendUrl}/session/${sessionId}/claim`;

    addLog(`[Network] Syncing claim: Item ${itemId}, user: ${targetUser}, shares: ${shares}...`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: targetUser,
          itemId: itemId,
          shares: shares,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP status ${response.status}`);
      }

      addLog(`[Network] Claim synchronized successfully with server.`);
      return true;
    } catch (err) {
      // Log errors inside catch blocks (as requested)
      const errMsg = err instanceof Error ? err.message : String(err);
      addLog(`[Network Warning] Failed to sync claim to backend: ${errMsg}.`);
      console.warn("Outbound claim sync failed:", err);
      return false;
    }
  }, [userName, sessionId]);

  // Join session handler
  const joinSession = (name: string) => {
    if (!name.trim()) return;
    setUserName(name.trim());
    setIsJoined(true);
    addLog(`Joined session as guest user: "${name.trim()}"`);
  };

  const changeName = () => {
    setIsJoined(false);
    addLog(`Cleared user identity session name.`);
  };

  // Claim portion of an item
  const updateClaim = useCallback((itemId: string, increment: number) => {
    const targetUser = userName.trim();
    if (!isJoined || !targetUser) {
      addLog("Warning: Cannot claim item. Please enter your name first.");
      return;
    }

    // Capture previous state for potential rollback
    const previousItems = [...items];

    let updatedShares = 0;

    setItems((prevItems) => {
      return prevItems.map((item) => {
        if (item.id !== itemId) return item;

        const claimsByOthers = item.claims.filter((c) => c.name !== targetUser);
        const totalClaimedByOthers = claimsByOthers.reduce((sum, c) => sum + c.shares, 0);

        const userClaim = item.claims.find((c) => c.name === targetUser);
        const currentShares = userClaim?.shares ?? 0;
        
        let newShares = currentShares + increment;
        if (newShares < 0) newShares = 0;
        if (totalClaimedByOthers + newShares > item.quantity) {
          newShares = item.quantity - totalClaimedByOthers;
        }

        updatedShares = newShares;

        const newClaims = [...claimsByOthers];
        if (newShares > 0) {
          newClaims.push({ name: targetUser, shares: newShares });
        }

        addLog(`Updated claim for "${item.name}": Changed your shares to ${newShares} (Item Qty: ${item.quantity}).`);
        return {
          ...item,
          claims: newClaims,
        };
      });
    });

    // Fire outbound sync call asynchronously
    setTimeout(async () => {
      if (process.env.NEXT_PUBLIC_MOCK_API === "true") {
        return;
      }
      const success = await syncClaimToBackend(itemId, updatedShares);
      if (!success) {
        addLog(`[Network Rollback] Sync failed. Rolling back claim state for Item ${itemId}.`);
        setItems(previousItems);
      }
    }, 0);
  }, [isJoined, userName, items, syncClaimToBackend]);

  // Developer Simulators
  const simulateClientAction = (actor: string, actionType: "claim" | "reset") => {
    if (actionType === "claim") {
      const availableItems = items.filter((item) => {
        const remaining = item.quantity - item.claims.reduce((sum, c) => sum + c.shares, 0);
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
          const currentShares = existingClaim?.shares ?? 0;
          
          const totalClaimed = it.claims.reduce((sum, c) => sum + c.shares, 0);
          const remaining = it.quantity - totalClaimed;
          const claimAmt = remaining >= 1 ? 1 : remaining;
          
          const filteredClaims = it.claims.filter((c) => c.name !== actor);
          const newClaims = [...filteredClaims, { name: actor, shares: currentShares + claimAmt }];

          addLog(`[Simulator] Broadcast: User "${actor}" claimed ${claimAmt} share of "${it.name}"`);
          return { ...it, claims: newClaims };
        })
      );
    } else {
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          claims: it.claims.filter((c) => c.name !== actor),
        }))
      );
      addLog(`[Simulator] Broadcast: User "${actor}" cleared all their claims`);
    }
  };

  const simulateRawMessage = (msg: string) => {
    addLog(`[Simulator] Sending custom broadcast message: "${msg}"`);
  };

  const simulateReceiptUpdate = (simulationItems: ReceiptItem[]) => {
    setItems(simulationItems);
    addLog(`[Simulator] SSE JSON receipt update applied.`);
  };

  return {
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
  };
}
