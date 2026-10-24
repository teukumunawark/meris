import { describe, expect, test } from "bun:test";
import { parseAcceptLanguage, readLocaleCookie, resolveLocale } from "./locales";

describe("resolveLocale", () => {
  test("a saved choice wins over the browser", () => {
    expect(resolveLocale("en", "id-ID,id;q=0.9")).toBe("en");
  });

  test("uses the first supported browser language", () => {
    expect(resolveLocale(null, "en-US,en;q=0.9,id;q=0.8")).toBe("en");
    expect(resolveLocale(null, "id-ID,id;q=0.9,en;q=0.8")).toBe("id");
  });

  test("respects quality order over header order", () => {
    expect(resolveLocale(null, "id;q=0.5,en;q=0.9")).toBe("en");
  });

  test("skips unsupported languages", () => {
    expect(resolveLocale(null, "ja-JP,ja;q=0.9,en;q=0.8")).toBe("en");
  });

  test("falls back to Indonesian", () => {
    expect(resolveLocale(null, "fr-FR")).toBe("id");
    expect(resolveLocale(undefined, null)).toBe("id");
    expect(resolveLocale("xx", "")).toBe("id");
  });
});

describe("parseAcceptLanguage", () => {
  test("drops languages with zero quality", () => {
    expect(parseAcceptLanguage("en;q=0,id")).toEqual(["id"]);
  });
});

describe("readLocaleCookie", () => {
  test("finds the locale among other cookies", () => {
    expect(readLocaleCookie("theme=dark; meris_locale=en; other=1")).toBe("en");
    expect(readLocaleCookie("theme=dark")).toBeNull();
  });
});
