"use client";

import { useState } from "react";
import { useSession } from "@/entities/session/model/SessionContext";
import { apiFetch } from "@/shared/api/client";

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
        if (parsed && parsed.name.toLowerCase() === trimmedName.toLowerCase()) {
          cachedToken = parsed.token;
        }
      } catch {}
    }

    try {
      const participant = await apiFetch<any>(`/session/${sessionId}/join`, {
        method: "POST",
        body: { name: trimmedName, token: cachedToken },
      });

      setParticipantData(participant.id, trimmedName, participant.token);
      localStorage.setItem(
        `meris_session_${sessionId}_participant`,
        JSON.stringify({
          id: participant.id,
          name: trimmedName,
          token: participant.token,
        })
      );
    } catch (err: any) {
      setJoinError(err.message || "Failed to join session.");
    }
  };

  const changeName = () => {
    setIsJoined(false);
  };

  return { joinSession, changeName, joinError };
}
