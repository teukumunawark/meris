"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

export default function JoinSessionForm() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");

  const handleJoinSession = () => {
    if (sessionId.trim()) {
      router.push(`/session/${sessionId.trim()}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <Input 
          type="text" 
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleJoinSession();
          }}
          placeholder="Enter Session ID" 
          className="text-center tracking-wider uppercase"
        />
        <Button onClick={handleJoinSession} className="w-full">
          Join Session
        </Button>
      </div>
    </div>
  );
}
