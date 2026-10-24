"use client";

import { useState } from "react";
import { useSession } from "@/entities/session/model/SessionContext";
import { apiFetch } from "@/shared/api/client";
import { apiErrorMessage, useI18n } from "@/shared/i18n";
import type { components } from "@/shared/api/generated/api";

type ParticipantResponse = components["schemas"]["ParticipantResponse"];

function readCachedParticipant(raw: string | null): { name?: unknown; token?: string } | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function useJoinSession() {
  const { sessionId, setParticipantData } = useSession();
  const { m } = useI18n();
  const [joinError, setJoinError] = useState<string | null>(null);

  const joinSession = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setJoinError(null);

    const cached = readCachedParticipant(localStorage.getItem(`meris_session_${sessionId}_participant`));
    const isSamePersonRejoining =
      !!cached && typeof cached.name === "string" && cached.name.toLowerCase() === trimmedName.toLowerCase();
    const cachedToken = isSamePersonRejoining ? cached.token ?? "" : "";

    try {
      const participant = await apiFetch<ParticipantResponse>(`/session/${sessionId}/join`, {
        method: "POST",
        body: { name: trimmedName, token: cachedToken },
      });

      if (participant.id !== undefined && participant.token) {
        const savedName = participant.name ?? trimmedName;
        setParticipantData(participant.id, savedName, participant.token);
        localStorage.setItem("meris_username", savedName);
        localStorage.setItem(
          `meris_session_${sessionId}_participant`,
          JSON.stringify({
            id: participant.id,
            name: savedName,
            token: participant.token,
          })
        );
      }
    } catch (err: unknown) {
      setJoinError(apiErrorMessage(err, m, m.join.failed));
    }
  };

  return { joinSession, joinError };
}
