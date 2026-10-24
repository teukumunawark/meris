"use client";

import { useI18n } from "@/shared/i18n";

export default function LanguageToggle() {
  const { locale, m, setLocale } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "id" ? "en" : "id")}
      aria-label={m.language.switchLabel}
      title={m.language.switchLabel}
      className="text-foreground/70 hover:text-foreground focus-visible:outline-sage flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2.5 font-sans text-xs font-semibold transition-colors hover:bg-[var(--glass-highlight)] focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {m.language.targetShort}
    </button>
  );
}
