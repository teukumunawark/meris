"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

export default function JoinSessionForm() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleJoinSession = () => {
    let trimmed = sessionId.trim();
    if (!trimmed) {
      setValidationError("Masukkan kode sesi atau tempel link yang dibagikan temanmu.");
      return;
    }
    // Automatically extract session ID if user pastes a full URL (e.g. from WhatsApp)
    if (trimmed.includes("/session/")) {
      const parts = trimmed.split("/session/");
      trimmed = parts[parts.length - 1].split(/[?#]/)[0];
    }
    setValidationError(null);
    router.push(`/session/${trimmed}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="space-y-1.5">
          <label className="text-foreground/75 font-sans text-xs font-medium">
            Kode atau Link Sesi
          </label>
          <Input 
            type="text" 
            value={sessionId}
            onChange={(e) => {
              setSessionId(e.target.value);
              if (validationError) setValidationError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoinSession();
            }}
            placeholder="Tempel link atau ketik kode sesi..." 
            className="text-base"
          />
        </div>
        <p className="text-foreground/45 font-sans text-xs leading-relaxed">
          Temanmu bisa membagikan link sesi secara langsung lewat WhatsApp atau pesan lainnya.
        </p>
        {validationError && (
          <p className="font-sans text-xs text-rose-400">{validationError}</p>
        )}
        <Button onClick={handleJoinSession} className="min-h-[44px] w-full">
          Masuk ke Sesi
        </Button>
      </div>
    </div>
  );
}
