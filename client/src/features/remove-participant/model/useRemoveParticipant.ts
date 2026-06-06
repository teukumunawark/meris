"use client";

import { useCallback } from "react";
import { useSession } from "@/entities/session/model/SessionContext";
import { apiFetch } from "@/shared/api/client";

export function useRemoveParticipant() {
  const { sessionId, participantToken } = useSession();

  const removeParticipant = useCallback(async (targetParticipantId: number): Promise<boolean> => {
    if (!participantToken) return false;
    try {
      await apiFetch(`/session/${sessionId}/participant/${targetParticipantId}?token=${participantToken}`, {
        method: "DELETE",
      });
      return true;
    } catch {
      return false;
    }
  }, [sessionId, participantToken]);

  return { removeParticipant };
}
