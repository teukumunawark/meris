import type { Locale } from "../locales";
import { en } from "./en";
import { id, type Messages } from "./id";

const dictionaries: Record<Locale, Messages> = { id, en };

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}

export type { Messages };
