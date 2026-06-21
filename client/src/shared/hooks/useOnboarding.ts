"use client";

import { useState, useEffect } from "react";

export function useOnboarding() {
  const [showJoinHint, setShowJoinHint] = useState(false);
  const [showClaimHint, setShowClaimHint] = useState(false);

  useEffect(() => {
    // Only run on client side
    if (typeof window !== "undefined") {
      const hasSeenJoin = localStorage.getItem("meris_onboarding_join");
      const hasSeenClaim = localStorage.getItem("meris_onboarding_claim");
      
      // Delay slightly so it doesn't flash immediately on mount and gives time for initial render
      if (!hasSeenJoin) {
        setTimeout(() => setShowJoinHint(true), 1000);
      }
      if (!hasSeenClaim) {
        setTimeout(() => setShowClaimHint(true), 1000);
      }
    }
  }, []);

  const completeJoinHint = () => {
    if (showJoinHint) {
      setShowJoinHint(false);
      localStorage.setItem("meris_onboarding_join", "true");
    }
  };

  const completeClaimHint = () => {
    if (showClaimHint) {
      setShowClaimHint(false);
      localStorage.setItem("meris_onboarding_claim", "true");
    }
  };

  return {
    showJoinHint,
    showClaimHint,
    completeJoinHint,
    completeClaimHint,
  };
}
