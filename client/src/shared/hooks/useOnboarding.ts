"use client";

import { useState, useEffect } from "react";

const HINT_DELAY_AFTER_MOUNT_MS = 1000;

export function useOnboarding() {
  const [showJoinHint, setShowJoinHint] = useState(false);
  const [showClaimHint, setShowClaimHint] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasSeenJoin = localStorage.getItem("meris_onboarding_join");
      const hasSeenClaim = localStorage.getItem("meris_onboarding_claim");
      
      if (!hasSeenJoin) {
        setTimeout(() => setShowJoinHint(true), HINT_DELAY_AFTER_MOUNT_MS);
      }
      if (!hasSeenClaim) {
        setTimeout(() => setShowClaimHint(true), HINT_DELAY_AFTER_MOUNT_MS);
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
