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
      participantId?: number;
      participant?: {
        id?: number;
        name: string;
      };
      name?: string; // Fallback for legacy/mock
      shares: number;
    }>;
  }>;
  tax?: number;
  service_charge?: number;
  serviceCharge?: number;
  payerName?: string;
  payerBank?: string;
  participants?: Array<{
    id: number;
    name: string;
  }>;
}

export function useClaimSession(sessionId: string) {
  const [userName, setUserName] = useState<string>("");
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [tax, setTax] = useState<number>(0);
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [payerName, setPayerName] = useState<string>("");
  const [payerBank, setPayerBank] = useState<string>("");

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

  const mapBackendState = useCallback((data: SSEServerUpdatePayload) => {
    if (Array.isArray(data.items)) {
      const updatedItems = data.items.map((item, idx: number) => ({
        id: item.id || `item-${idx}`,
        name: item.name || "Unnamed Item",
        price: typeof item.price === "number" ? item.price : 0,
        quantity: typeof item.quantity === "number" ? item.quantity : 1,
        claims: Array.isArray(item.claims)
          ? item.claims.map((claim) => ({
              name: claim.participant?.name || claim.name || "Unknown",
              shares: typeof claim?.shares === "number" ? claim.shares : 0,
            })).filter(c => c.shares > 0)
          : [],
      }));
      setItems(updatedItems);
    }
    if (typeof data.tax === "number") {
      setTax(data.tax);
    }
    const sCharge = data.serviceCharge ?? data.service_charge;
    if (typeof sCharge === "number") {
      setServiceCharge(sCharge);
    }
    if (data.payerName) setPayerName(data.payerName);
    if (data.payerBank) setPayerBank(data.payerBank);

    // Auto-join if user name from local storage exists in participant list
    if (!isJoined) {
      const storedName = localStorage.getItem("meris_username");
      if (storedName && Array.isArray(data.participants)) {
        const found = data.participants.find(p => p.name.trim().toLowerCase() === storedName.trim().toLowerCase());
        if (found) {
          setUserName(found.name);
          setParticipantId(found.id);
          setIsJoined(true);
        }
      }
    }
  }, [isJoined]);

  // Task 1: Fetch Initial Session State
  useEffect(() => {
    if (!sessionId) return;

    const fetchInitialState = async () => {
      try {
        const response = await fetch(`${backendUrl}/session/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          mapBackendState(data);
        }
      } catch (err) {
        console.error("Failed to fetch initial session state:", err);
      }
    };

    fetchInitialState();
  }, [sessionId, backendUrl, mapBackendState]);

  // Task 2: Update SSE Payload Parser
  useEffect(() => {
    if (!sessionId) return;

    const sseUrl = `${backendUrl}/stream?sessionId=${sessionId}`;

    let eventSource: EventSource;
    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as SSEServerUpdatePayload;
          if (parsed && typeof parsed === "object") {
            mapBackendState(parsed);
          }
        } catch (err) {
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
  }, [sessionId, backendUrl, mapBackendState]);

  // Task 4: Integrate ClaimItem API
  const syncClaimToBackend = useCallback(async (itemId: string, shares: number): Promise<boolean> => {
    if (!participantId) return false;

    const url = `${backendUrl}/session/${sessionId}/claim`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participantId: participantId,
          itemId: itemId,
          shares: shares,
        }),
      });

      return response.ok;
    } catch (err) {
      console.warn("Outbound claim sync failed:", err);
      return false;
    }
  }, [participantId, sessionId, backendUrl]);

  // Task 3: Integrate JoinSession API
  const joinSession = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      const response = await fetch(`${backendUrl}/session/${sessionId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (response.ok) {
        const participant = await response.json();
        setUserName(trimmedName);
        setParticipantId(participant.id);
        setIsJoined(true);
      } else {
        console.error("Failed to join session");
      }
    } catch (err) {
      console.error("Error joining session:", err);
    }
  };

  const changeName = () => {
    setIsJoined(false);
  };

  // Claim portion of an item (Optimistic Update)
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
    payerName,
    payerBank,
    joinSession,
    changeName,
    updateClaim,
  };
}
