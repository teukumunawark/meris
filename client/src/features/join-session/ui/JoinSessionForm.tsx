"use client";

import React, { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { useI18n } from "@/shared/i18n";

export default function JoinSessionForm() {
  const router = useRouter();
  const { m } = useI18n();
  const inputId = useId();
  const [sessionId, setSessionId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleJoinSession = () => {
    let trimmed = sessionId.trim();
    if (!trimmed) {
      setValidationError(m.joinForm.required);
      return;
    }
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
          <label htmlFor={inputId} className="text-foreground/75 block font-sans text-xs font-medium">
            {m.joinForm.label}
          </label>
          <Input
            id={inputId}
            type="text"
            value={sessionId}
            onChange={(e) => {
              setSessionId(e.target.value);
              if (validationError) setValidationError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoinSession();
            }}
            placeholder={m.joinForm.placeholder}
            className="block w-full text-base"
          />
        </div>
        <p className="text-foreground/45 font-sans text-xs leading-relaxed">
          {m.joinForm.help}
        </p>
        {validationError && (
          <p className="font-sans text-xs text-rose-400">{validationError}</p>
        )}
        <Button onClick={handleJoinSession} className="min-h-[44px] w-full">
          {m.joinForm.submit}
        </Button>
      </div>
    </div>
  );
}
