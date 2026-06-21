"use client";

import { useCallback } from "react";
import { useSession } from "@/entities/session";
import { apiFetch } from "@/shared/api/client";

export function useManageItems() {
  const { sessionId, participantToken } = useSession();

  const addItem = useCallback(async (name: string, price: number, quantity: number) => {
    try {
      await apiFetch(`/session/${sessionId}/item`, {
        method: "POST",
        body: { name, price, quantity, token: participantToken },
      });
      return true;
    } catch (err) {
      console.error("Failed to add item:", err);
      return false;
    }
  }, [sessionId, participantToken]);

  const updateItem = useCallback(async (itemId: string, name: string, price: number, quantity: number) => {
    try {
      await apiFetch(`/session/${sessionId}/item/${itemId}`, {
        method: "PUT",
        body: { name, price, quantity, token: participantToken },
      });
      return true;
    } catch (err) {
      console.error("Failed to update item:", err);
      return false;
    }
  }, [sessionId, participantToken]);

  const deleteItem = useCallback(async (itemId: string) => {
    try {
      await apiFetch(`/session/${sessionId}/item/${itemId}?token=${participantToken}`, {
        method: "DELETE",
      });
      return true;
    } catch (err) {
      console.error("Failed to delete item:", err);
      return false;
    }
  }, [sessionId, participantToken]);

  const addBill = useCallback(async (file: File, payerName: string, billName: string) => {
    try {
      const formData = new FormData();
      formData.append("receipt", file);
      formData.append("payerName", payerName);
      formData.append("name", billName);
      formData.append("token", participantToken);

      await apiFetch(`/session/${sessionId}/bill`, {
        method: "POST",
        body: formData,
      });
      return true;
    } catch (err) {
      console.error("Failed to add bill stop:", err);
      return false;
    }
  }, [sessionId, participantToken]);

  const updateBill = useCallback(async (billId: string, name: string, payerName: string, tax: number, serviceCharge: number, grandTotal: number) => {
    try {
      await apiFetch(`/session/${sessionId}/bill/${billId}`, {
        method: "PUT",
        body: {
          name,
          payerName,
          tax,
          serviceCharge,
          grandTotal,
          token: participantToken,
        },
      });
      return true;
    } catch (err) {
      console.error("Failed to update bill stop:", err);
      return false;
    }
  }, [sessionId, participantToken]);

  const deleteBill = useCallback(async (billId: string) => {
    try {
      await apiFetch(`/session/${sessionId}/bill/${billId}?token=${participantToken}`, {
        method: "DELETE",
      });
      return true;
    } catch (err) {
      console.error("Failed to delete bill stop:", err);
      return false;
    }
  }, [sessionId, participantToken]);

  const updateParticipantBank = useCallback(async (participantId: number, bankName: string, bankAccount: string) => {
    try {
      await apiFetch(`/session/${sessionId}/participant/${participantId}/bank`, {
        method: "PUT",
        body: {
          bankName,
          bankAccount,
          token: participantToken,
        },
      });
      return true;
    } catch (err) {
      console.error("Failed to update participant bank details:", err);
      return false;
    }
  }, [sessionId, participantToken]);

  return { addItem, updateItem, deleteItem, addBill, updateBill, deleteBill, updateParticipantBank };
}
