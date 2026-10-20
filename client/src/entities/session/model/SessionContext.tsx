"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReceiptItem } from "@/shared/types";
import { apiFetch } from "@/shared/api/client";

export interface Bill {
  id: string;
  payerName: string;
  name: string;
  tax: number;
  serviceCharge: number;
  grandTotal: number;
  createdAt: string;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export interface BilateralTransfer {
  from: string;     // consumer
  to: string;       // payer
  billName: string; // stop name
  amount: number;
}

export interface SSEServerUpdatePayload {
  items?: Array<{
    id?: string;
    name?: string;
    price?: number;
    quantity?: number;
    parentId?: string;
    billId?: string;
    claims?: Array<{
      participantId?: number;
      participant?: {
        id?: number;
        name: string;
      };
      name?: string;
      shares: number;
    }>;
  }>;
  tax?: number;
  serviceCharge?: number;
  payerName?: string;
  payerBankName?: string;
  payerBankAccount?: string;
  participants?: Array<{
    id: number;
    name: string;
    totalOwed?: number;
    subtotal?: number;
    tax?: number;
    serviceCharge?: number;
    bankName?: string;
    bankAccount?: string;
  }>;
  bills?: Bill[];
  transfers?: Transfer[];
  rawDebts?: BilateralTransfer[];
}

interface SessionContextType {
  sessionId: string;
  userName: string;
  setUserName: (name: string) => void;
  participantId: number | null;
  participantToken: string;
  isJoined: boolean;
  setIsJoined: (val: boolean) => void;
  setParticipantData: (id: number, name: string, token: string) => void;

  items: ReceiptItem[];
  setItems: React.Dispatch<React.SetStateAction<ReceiptItem[]>>;
  tax: number;
  serviceCharge: number;
  payerName: string;
  payerBankName: string;
  payerBankAccount: string;
  participants: Array<{
    id: number;
    name: string;
    totalOwed?: number;
    subtotal?: number;
    tax?: number;
    serviceCharge?: number;
    bankName?: string;
    bankAccount?: string;
  }>;
  bills: Bill[];
  transfers: Transfer[];
  rawDebts: BilateralTransfer[];
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ sessionId, children }: { sessionId: string, children: React.ReactNode }) {
  const [userName, setUserName] = useState<string>("");
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [participantToken, setParticipantToken] = useState<string>("");
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [justJoined, setJustJoined] = useState<boolean>(false);

  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [tax, setTax] = useState<number>(0);
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [payerName, setPayerName] = useState<string>("");
  const [payerBankName, setPayerBankName] = useState<string>("");
  const [payerBankAccount, setPayerBankAccount] = useState<string>("");
  const [participants, setParticipants] = useState<Array<{
    id: number;
    name: string;
    totalOwed?: number;
    subtotal?: number;
    tax?: number;
    serviceCharge?: number;
    bankName?: string;
    bankAccount?: string;
  }>>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [rawDebts, setRawDebts] = useState<BilateralTransfer[]>([]);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8091";

  const setParticipantData = useCallback((id: number, name: string, token: string) => {
    setUserName(name);
    setParticipantId(id);
    setParticipantToken(token);
    setIsJoined(true);
    setJustJoined(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionId) {
      const stored = localStorage.getItem(`meris_session_${sessionId}_participant`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.id && parsed.name && parsed.token) {
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
        parentId: item.parentId,
        billId: item.billId,
        claims: Array.isArray(item.claims)
          ? item.claims.map((claim) => ({
              name: claim.participant?.name || claim.name || "Unknown",
              shares: typeof claim?.shares === "number" ? claim.shares : 0,
            })).filter(c => c.shares > 0)
          : [],
      }));
      setItems(updatedItems);
    }
    if (typeof data.tax === "number") setTax(data.tax);
    if (typeof data.serviceCharge === "number") setServiceCharge(data.serviceCharge);

    const currentPayerName = data.payerName;
    if (currentPayerName) {
      setPayerName(currentPayerName);
      if (typeof window !== "undefined") {
        const totalSub = Array.isArray(data.items) ? data.items.reduce((s, it) => s + (it.price || 0) * (it.quantity || 0), 0) : 0;
        const computedGrand = totalSub + (data.tax || 0) + (data.serviceCharge || 0);

        const stored = localStorage.getItem("meris_recent_sessions");
        let list: Array<{ id: string; payerName: string; grandTotal: number; joinedAt: number }> = [];
        if (stored) {
          try { list = JSON.parse(stored); } catch {}
        }
        const existing = list.find(item => item.id === sessionId);
        if (!existing) {
          list.unshift({
            id: sessionId,
            payerName: currentPayerName,
            grandTotal: computedGrand,
            joinedAt: Date.now(),
          });
          localStorage.setItem("meris_recent_sessions", JSON.stringify(list));
        } else if (existing.payerName !== currentPayerName || existing.grandTotal !== computedGrand) {
          list = list.map(item =>
            item.id === sessionId
              ? { ...item, payerName: currentPayerName, grandTotal: computedGrand }
              : item
          );
          localStorage.setItem("meris_recent_sessions", JSON.stringify(list));
        }
      }
    }
    if (data.payerBankName) setPayerBankName(data.payerBankName);
    if (data.payerBankAccount) setPayerBankAccount(data.payerBankAccount);
    if (Array.isArray(data.participants)) setParticipants(data.participants);
    if (Array.isArray(data.bills)) setBills(data.bills);
    if (Array.isArray(data.transfers)) setTransfers(data.transfers);
    if (Array.isArray(data.rawDebts)) setRawDebts(data.rawDebts);
  }, [sessionId]);

  useEffect(() => {
    if (isJoined && participantId !== null && participants.length > 0) {
      const stillJoined = participants.some((p) => p.id === participantId);
      if (stillJoined) {
        setJustJoined(false);
      } else if (!justJoined) {
        setIsJoined(false);
        setParticipantId(null);
        setParticipantToken("");
        localStorage.removeItem(`meris_session_${sessionId}_participant`);
      }
    }
  }, [participants, isJoined, participantId, justJoined, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const fetchInitialState = async () => {
      try {
        const data = await apiFetch<SSEServerUpdatePayload>(`/session/${sessionId}`);
        if (data) mapBackendState(data);
      } catch (err) {
        console.error("Initial fetch error:", err);
      }
    };
    fetchInitialState();

    let eventSource: EventSource | null = null;
    try {
      const sseUrl = `${backendUrl}/stream?sessionId=${sessionId}`;
      eventSource = new EventSource(sseUrl);
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as SSEServerUpdatePayload;
          if (parsed && typeof parsed === "object") mapBackendState(parsed);
        } catch (err) {
          console.debug("SSE non-JSON message:", err);
        }
      };
      eventSource.onerror = (err) => console.error("SSE connection error:", err);
    } catch (err) {
      console.error("EventSource construction failed:", err);
    }
    return () => { if (eventSource) eventSource.close(); };
  }, [sessionId, backendUrl, mapBackendState]);

  return (
    <SessionContext.Provider value={{
      sessionId,
      userName,
      setUserName,
      participantId,
      participantToken,
      isJoined,
      setIsJoined,
      setParticipantData,
      items,
      setItems,
      tax,
      serviceCharge,
      payerName,
      payerBankName,
      payerBankAccount,
      participants,
      bills,
      transfers,
      rawDebts
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
