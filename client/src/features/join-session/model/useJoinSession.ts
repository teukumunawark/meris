"use client";

import { useState } from "react";
import { useSession } from "@/entities/session/model/SessionContext";
import { apiFetch } from "@/shared/api/client";
import type { components } from "@/shared/api/generated/api";

type ParticipantResponse = components["schemas"]["ParticipantResponse"];

export function useJoinSession() {
  const { sessionId, setParticipantData, setIsJoined } = useSession();
  const [joinError, setJoinError] = useState<string | null>(null);

  const joinSession = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setJoinError(null);

    const stored = localStorage.getItem(`meris_session_${sessionId}_participant`);
    let cachedToken = "";
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.name === "string" && parsed.name.toLowerCase() === trimmedName.toLowerCase()) {
          cachedToken = parsed.token;
        }
      } catch {
        // Ignore JSON parse errors for corrupt cached session state
      }
    }

    try {
      const participant = await apiFetch<ParticipantResponse>(`/session/${sessionId}/join`, {
        method: "POST",
        body: { name: trimmedName, token: cachedToken },
      });

      if (participant.id !== undefined && participant.token) {
        setParticipantData(participant.id, trimmedName, participant.token);
        localStorage.setItem(
          `meris_session_${sessionId}_participant`,
          JSON.stringify({
            id: participant.id,
            name: trimmedName,
            token: participant.token,
          })
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to join session.";
      setJoinError(message);
    }
  };

  const changeName = () => {
    setIsJoined(false);
  };

  return { joinSession, changeName, joinError };
}
