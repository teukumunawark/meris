"use client";

import { useCallback, useState } from "react";
import { useSession } from "@/entities/session/model/SessionContext";
import { apiFetch } from "@/shared/api/client";
import { apiErrorMessage, useI18n } from "@/shared/i18n";
import type { components } from "@/shared/api/generated/api";

type ParticipantResponse = components["schemas"]["ParticipantResponse"];

export function useRenameParticipant() {
  const { sessionId, participantId, participantToken, setUserName } = useSession();
  const { m } = useI18n();
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
      setRenameError(apiErrorMessage(err, m, m.renameParticipant.failed));
      return false;
    }
  }, [sessionId, participantId, participantToken, setUserName, m]);

  const clearRenameError = useCallback(() => setRenameError(null), []);

  return { renameParticipant, renameError, clearRenameError };
}
