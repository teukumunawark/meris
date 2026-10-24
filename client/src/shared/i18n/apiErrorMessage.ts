import { ApiError } from "@/shared/api/client";
import type { Messages } from "./messages";

const SERVER_LOCALIZED_CODE_PREFIX = "errors.";

function errorCodeOf(error: ApiError): string | undefined {
  const data = error.data;
  if (typeof data === "object" && data !== null && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  return undefined;
}

export function apiErrorMessage(error: unknown, m: Messages, fallback: string): string {
  if (error instanceof TypeError) return m.errors.network;
  if (!(error instanceof ApiError)) return fallback;

  const code = errorCodeOf(error);
  if (code?.startsWith(SERVER_LOCALIZED_CODE_PREFIX) && code !== "errors.internal_error") return error.message;

  if (error.status === 413) return m.errors.fileTooLarge;
  if (error.status === 429) return m.errors.tooManyRequests;
  return fallback;
}
