"use client";

import { useState, useEffect, useCallback } from "react";
import { ReceiptItem } from "@/types";

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
  payerBankName?: string;
  payerBankAccount?: string;
  participants?: Array<{
    id: number;
    name: string;
  }>;
}

export function useClaimSession(sessionId: string) {
  const [userName, setUserName] = useState<string>("");
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [participantToken, setParticipantToken] = useState<string>("");
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [justJoined, setJustJoined] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [tax, setTax] = useState<number>(0);
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [payerName, setPayerName] = useState<string>("");
  const [payerBankName, setPayerBankName] = useState<string>("");
  const [payerBankAccount, setPayerBankAccount] = useState<string>("");
  const [participants, setParticipants] = useState<Array<{ id: number; name: string }>>([]);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

  useEffect(() => {
    if (typeof window !== "undefined" && sessionId) {
      const stored = localStorage.getItem(`meris_session_${sessionId}_participant`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.id && parsed.name && parsed.token) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setUserName(parsed.name);
            setParticipantId(parsed.id);
            setParticipantToken(parsed.token);
            setIsJoined(true);
            setJustJoined(false);
          }
        } catch {
          localStorage.removeItem(`meris_session_${sessionId}_participant`);
        }
      }
    }
  }, [sessionId]);

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
    if (data.payerName) {
      setPayerName(data.payerName);
      const totalSub = Array.isArray(data.items) ? data.items.reduce((s, it) => s + (it.price || 0) * (it.quantity || 0), 0) : 0;
      const computedGrand = totalSub + (data.tax || 0) + (data.serviceCharge ?? data.service_charge ?? 0);

      const stored = localStorage.getItem("meris_recent_sessions");
      let list: Array<{ id: string; payerName: string; grandTotal: number; joinedAt: number }> = [];
      if (stored) {
        try {
          list = JSON.parse(stored);
        } catch {}
      }
      list = list.filter(item => item.id !== sessionId);
      list.unshift({
        id: sessionId,
        payerName: data.payerName,
        grandTotal: computedGrand,
        joinedAt: Date.now(),
      });
      localStorage.setItem("meris_recent_sessions", JSON.stringify(list));
    }
    if (data.payerBankName) setPayerBankName(data.payerBankName);
    if (data.payerBankAccount) setPayerBankAccount(data.payerBankAccount);
    if (Array.isArray(data.participants)) {
      setParticipants(data.participants);
    }
  }, [sessionId]);
  useEffect(() => {
    if (isJoined && participantId !== null && participants.length > 0) {
      const stillJoined = participants.some((p) => p.id === participantId);
      if (stillJoined) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setJustJoined(false);
      } else if (!justJoined) {
        setIsJoined(false);
        setParticipantId(null);
        setParticipantToken("");
        localStorage.removeItem(`meris_session_${sessionId}_participant`);
      }
    }
  }, [participants, isJoined, participantId, justJoined, sessionId]);

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

  const syncClaimToBackend = useCallback(async (itemId: string, shares: number): Promise<boolean> => {
    if (!participantId || !participantToken) return false;

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
          token: participantToken,
        }),
      });

      return response.ok;
    } catch (err) {
      console.warn("Outbound claim sync failed:", err);
      return false;
    }
  }, [participantId, participantToken, sessionId, backendUrl]);

  const joinSession = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setJoinError(null);

    const stored = localStorage.getItem(`meris_session_${sessionId}_participant`);
    let cachedToken = "";
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.name.toLowerCase() === trimmedName.toLowerCase()) {
          cachedToken = parsed.token;
        }
      } catch {}
    }

    try {
      const response = await fetch(`${backendUrl}/session/${sessionId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName, token: cachedToken }),
      });

      if (response.ok) {
        const participant = await response.json();
        setUserName(trimmedName);
        setParticipantId(participant.id);
        setParticipantToken(participant.token);
        setIsJoined(true);
        setJustJoined(true);
        localStorage.setItem(
          `meris_session_${sessionId}_participant`,
          JSON.stringify({
            id: participant.id,
            name: trimmedName,
            token: participant.token,
          })
        );
      } else if (response.status === 409) {
        setJoinError("This name is already taken. Please choose another name to join.");
      } else {
        setJoinError("Failed to join session. Please try again later.");
      }
    } catch {
      setJoinError("Network error. Unable to connect to the server.");
    }
  };

  const changeName = () => {
    setIsJoined(false);
    setJustJoined(false);
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

  const renameItem = useCallback(async (itemId: string, newName: string): Promise<boolean> => {
    const previousItems = [...items];
    setItems((prevItems) =>
      prevItems.map((item) => (item.id === itemId ? { ...item, name: newName } : item))
    );
    try {
      const response = await fetch(`${backendUrl}/session/${sessionId}/item/${itemId}/rename`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName }),
      });
      if (!response.ok) {
        setItems(previousItems);
        return false;
      }
      return true;
    } catch {
      setItems(previousItems);
      return false;
    }
  }, [sessionId, backendUrl, items]);

  const removeParticipant = useCallback(async (targetParticipantId: number): Promise<boolean> => {
    if (!participantToken) return false;
    try {
      const response = await fetch(`${backendUrl}/session/${sessionId}/participant/${targetParticipantId}?token=${participantToken}`, {
        method: "DELETE",
      });
      return response.ok;
    } catch {
      return false;
    }
  }, [sessionId, backendUrl, participantToken]);

  return {
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
  };
}
