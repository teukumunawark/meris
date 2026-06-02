"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [tax, setTax] = useState<number>(16800);
  const [serviceCharge, setServiceCharge] = useState<number>(8400);

  // SSE EventSource Connection
  useEffect(() => {
    if (!sessionId) return;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const sseUrl = `${backendUrl}/stream?sessionId=${sessionId}`;

    let eventSource: EventSource;
    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        const rawData = event.data;
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
          // JSON parsing failure is expected for non-JSON broadcast messages
          console.debug("SSE non-JSON message:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE connection error:", err);
      };
    } catch (err) {
      console.error("EventSource construction failed:", err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [sessionId]);

  // Outbound claims syncing to backend
  const syncClaimToBackend = useCallback(async (itemId: string, shares: number): Promise<boolean> => {
    if (process.env.NEXT_PUBLIC_MOCK_API === "true") {
      return true;
    }

    const targetUser = userName.trim();
    if (!targetUser) return false;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const url = `${backendUrl}/session/${sessionId}/claim`;

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

      return response.ok;
    } catch (err) {
      console.warn("Outbound claim sync failed:", err);
      return false;
    }
  }, [userName, sessionId]);

  // Join session handler
  const joinSession = (name: string) => {
    if (!name.trim()) return;
    setUserName(name.trim());
    setIsJoined(true);
  };

  const changeName = () => {
    setIsJoined(false);
  };

  // Claim portion of an item
  const updateClaim = useCallback((itemId: string, increment: number) => {
    const targetUser = userName.trim();
    if (!isJoined || !targetUser) return;

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
        setItems(previousItems);
      }
    }, 0);
  }, [isJoined, userName, items, syncClaimToBackend]);

  return {
    userName,
    setUserName,
    isJoined,
    items,
    tax,
    serviceCharge,
    joinSession,
    changeName,
    updateClaim,
  };
}
