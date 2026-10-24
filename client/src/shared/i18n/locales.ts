export const LOCALES = ["id", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "id";
export const LOCALE_COOKIE = "meris_locale";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const INTL_LOCALE: Record<Locale, string> = {
  id: "id-ID",
  en: "en-US",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function intlLocale(locale: Locale): string {
  return INTL_LOCALE[locale];
}

function primarySubtag(tag: string): string {
  return tag.trim().split(/[-_]/)[0].toLowerCase();
}

export function localeFromLanguageTags(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const candidate = primarySubtag(tag);
    if (isLocale(candidate)) return candidate;
  }
  return DEFAULT_LOCALE;
}

export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const qualityParam = params.find((p) => p.trim().startsWith("q="));
      const quality = qualityParam ? Number(qualityParam.trim().slice(2)) : 1;
      return { tag, quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter(({ tag, quality }) => tag && quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map(({ tag }) => tag);
}

export function resolveLocale(savedChoice: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(savedChoice)) return savedChoice;
  return localeFromLanguageTags(parseAcceptLanguage(acceptLanguage));
}

export function localeCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

export function readLocaleCookie(cookieHeader: string): string | null {
  const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${LOCALE_COOKIE}=`));
  return match ? match.slice(LOCALE_COOKIE.length + 1) : null;
}

export function detectBrowserLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const saved = readLocaleCookie(document.cookie);
  if (isLocale(saved)) return saved;
  return localeFromLanguageTags(navigator.languages ?? [navigator.language]);
}

export function currentDocumentLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const lang = document.documentElement.lang;
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
}
