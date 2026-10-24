"use client";

import { useCallback } from "react";
import { useSession } from "@/entities/session/model/SessionContext";
import { apiFetch } from "@/shared/api/client";

export function useClaimItem() {
  const { sessionId, participantId, participantToken, isJoined, myName, items, setItems } = useSession();

  const syncClaimToBackend = useCallback(async (itemId: string, shares: number): Promise<boolean> => {
    if (!participantId || !participantToken) return false;

    try {
      await apiFetch(`/session/${sessionId}/claim`, {
        method: "POST",
        body: {
          participantId,
          itemId,
          shares,
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
    const targetUser = myName;
    if (!isJoined || !targetUser) return;

    const targetItem = items.find((item) => item.id === itemId);
    if (!targetItem) return;

    const claimsByOthers = targetItem.claims.filter((c) => c.name !== targetUser);
    const totalClaimedByOthers = claimsByOthers.reduce((sum, c) => sum + c.shares, 0);

    const userClaim = targetItem.claims.find((c) => c.name === targetUser);
    const currentShares = userClaim?.shares ?? 0;

    let newShares = currentShares + increment;
    if (newShares < 0) newShares = 0;
    if (totalClaimedByOthers + newShares > targetItem.quantity) {
      newShares = Math.floor((targetItem.quantity - totalClaimedByOthers) * 1000) / 1000;
    }

    if (newShares === currentShares) return;

    const previousClaims = targetItem.claims;

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== itemId) return item;

        const claimsOthers = item.claims.filter((c) => c.name !== targetUser);
        const newClaims = [...claimsOthers];
        if (newShares > 0) {
          newClaims.push({ name: targetUser, shares: newShares });
        }

        return {
          ...item,
          claims: newClaims,
        };
      })
    );

    void syncClaimToBackend(itemId, newShares).then((success) => {
      if (!success) {
        setItems((prevItems) =>
          prevItems.map((item) => {
            if (item.id !== itemId) return item;
            return {
              ...item,
              claims: previousClaims,
            };
          })
        );
      }
    });
  }, [isJoined, myName, items, setItems, syncClaimToBackend]);

  return { updateClaim };
}
