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

  return { addItem, updateItem, deleteItem };
}
