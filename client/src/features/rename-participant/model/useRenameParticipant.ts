"use client";

import { useCallback, useState } from "react";
import { useSession } from "@/entities/session/model/SessionContext";
import { apiFetch } from "@/shared/api/client";
import type { components } from "@/shared/api/generated/api";

type ParticipantResponse = components["schemas"]["ParticipantResponse"];

export function useRenameParticipant() {
  const { sessionId, participantId, participantToken, setUserName } = useSession();
  const [renameError, setRenameError] = useState<string | null>(null);

  const renameParticipant = useCallback(async (newName: string): Promise<boolean> => {
    const trimmedName = newName.trim();
    if (!trimmedName || participantId === null) return false;
    setRenameError(null);

    try {
      const participant = await apiFetch<ParticipantResponse>(
        `/session/${sessionId}/participant/${participantId}/name`,
        {
          method: "PUT",
          body: { name: trimmedName, token: participantToken },
        }
      );

      const savedName = participant.name ?? trimmedName;
      setUserName(savedName);
      localStorage.setItem("meris_username", savedName);
      localStorage.setItem(
        `meris_session_${sessionId}_participant`,
        JSON.stringify({ id: participantId, name: savedName, token: participantToken })
      );
      return true;
    } catch (err: unknown) {
      setRenameError(err instanceof Error ? err.message : "Gagal mengganti nama. Coba lagi.");
      return false;
    }
  }, [sessionId, participantId, participantToken, setUserName]);

  const clearRenameError = useCallback(() => setRenameError(null), []);

  return { renameParticipant, renameError, clearRenameError };
}
