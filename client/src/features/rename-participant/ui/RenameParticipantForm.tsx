"use client";

import React, { useState } from "react";
import { useSession } from "@/entities/session/model/SessionContext";
import { useRenameParticipant } from "../model/useRenameParticipant";
import { useI18n } from "@/shared/i18n";

interface RenameParticipantFormProps {
  onDone: () => void;
  className?: string;
}

export default function RenameParticipantForm({ onDone, className = "" }: RenameParticipantFormProps) {
  const { myName: userName } = useSession();
  const { m } = useI18n();
  const { renameParticipant, renameError, clearRenameError } = useRenameParticipant();
  const [draft, setDraft] = useState(userName);
  const [isSaving, setIsSaving] = useState(false);

  const trimmedDraft = draft.trim();

  const handleSave = async () => {
    if (!trimmedDraft || isSaving) return;
    if (trimmedDraft === userName.trim()) {
      onDone();
      return;
    }
    setIsSaving(true);
    const success = await renameParticipant(trimmedDraft);
    setIsSaving(false);
    if (success) onDone();
  };

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (renameError) clearRenameError();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") onDone();
          }}
          maxLength={20}
          autoFocus
          aria-label={m.renameParticipant.label}
          className="text-foreground placeholder:text-foreground/30 focus:border-sage min-w-0 flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-1.5 text-base transition-colors focus:outline-none sm:text-sm"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!trimmedDraft || isSaving}
          className="bg-sage text-background hover:bg-sage/90 flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-xl px-3.5 text-xs font-bold transition-all active:scale-95 disabled:opacity-30"
        >
          {isSaving ? m.common.saving : m.common.save}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={isSaving}
          className="text-foreground/60 hover:text-foreground flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-xl px-2 text-xs font-semibold transition-colors disabled:opacity-30"
        >
          {m.common.cancel}
        </button>
      </div>
      {renameError && (
        <p className="font-sans text-xs text-rose-400">{renameError}</p>
      )}
    </div>
  );
}
