"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

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
        <input 
          type="text" 
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleJoinSession();
          }}
          placeholder="Enter Session ID" 
          className="rounded-glass-sm text-foreground placeholder:text-foreground/20 focus:border-sage/40 w-full border border-white/5 bg-white/2 px-4 py-3 text-center font-sans text-sm tracking-wider uppercase transition-colors focus:outline-none"
        />
        <button 
          onClick={handleJoinSession}
          style={{ backgroundColor: "#8ba895" }}
          className="rounded-glass-sm text-background w-full cursor-pointer py-3.5 font-sans text-xs font-bold tracking-wider uppercase transition-all hover:brightness-105 active:scale-[0.99]"
        >
          Join Session
        </button>
      </div>
    </div>
  );
}
