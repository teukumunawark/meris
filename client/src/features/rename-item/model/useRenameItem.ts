"use client";

import { useCallback } from "react";
import { useSession } from "@/entities/session/model/SessionContext";
import { apiFetch } from "@/shared/api/client";

export function useRenameItem() {
  const { sessionId, items, setItems } = useSession();

  const renameItem = useCallback(async (itemId: string, newName: string): Promise<boolean> => {
    const previousItems = [...items];
    setItems((prevItems) =>
      prevItems.map((item) => (item.id === itemId ? { ...item, name: newName } : item))
    );
    try {
      await apiFetch(`/session/${sessionId}/item/${itemId}/rename`, {
        method: "PUT",
        body: { name: newName },
      });
      return true;
    } catch {
      setItems(previousItems);
      return false;
    }
  }, [sessionId, items, setItems]);

  return { renameItem };
}
