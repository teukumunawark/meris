"use client";

import { useCallback } from "react";
import { useSession } from "@/entities/session/model/SessionContext";
import { apiFetch } from "@/shared/api/client";

export function useClaimItem() {
  const { sessionId, participantId, participantToken, isJoined, userName, items, setItems } = useSession();

  const syncClaimToBackend = useCallback(async (itemId: string, shares: number): Promise<boolean> => {
    if (!participantId || !participantToken) return false;

    try {
      await apiFetch(`/session/${sessionId}/claim`, {
        method: "POST",
        body: {
          participantId: participantId,
          itemId: itemId,
          shares: shares,
          token: participantToken,
        },
      });
      return true;
    } catch (err) {
      console.warn("Outbound claim sync failed:", err);
      return false;
    }
  }, [participantId, participantToken, sessionId]);

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

    setTimeout(async () => {
      const success = await syncClaimToBackend(itemId, updatedShares);
      if (!success) {
        setItems(previousItems);
      }
    }, 0);
  }, [isJoined, userName, items, setItems, syncClaimToBackend]);

  return { updateClaim };
}
