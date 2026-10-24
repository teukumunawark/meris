"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getMessages, type Messages } from "./messages";
import { localeCookie, type Locale } from "./locales";

interface I18nContextValue {
  locale: Locale;
  m: Messages;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    document.cookie = localeCookie(next);
    document.documentElement.lang = next;
    document.title = getMessages(next).meta.title;
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, m: getMessages(locale), setLocale }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
