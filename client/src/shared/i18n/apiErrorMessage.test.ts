import { describe, expect, test } from "bun:test";
import { ApiError } from "@/shared/api/client";
import { apiErrorMessage } from "./apiErrorMessage";
import { getMessages } from "./messages";

const m = getMessages("id");
const fallback = "pesan cadangan";

const serverError = (status: number, code: string, message: string) =>
  new ApiError(message, status, { error: code, message });

describe("apiErrorMessage", () => {
  test("shows the localized message the server already wrote", () => {
    const error = serverError(409, "errors.name_conflict", "Nama April sudah dipakai di sesi ini. Pakai nama lain.");
    expect(apiErrorMessage(error, m, fallback)).toBe("Nama April sudah dipakai di sesi ini. Pakai nama lain.");
  });

  test("shows the receipt reader failure instead of blaming the photo", () => {
    const error = serverError(502, "errors.receipt_service_unavailable", "Pembaca struk sedang bermasalah.");
    expect(apiErrorMessage(error, m, fallback)).toBe("Pembaca struk sedang bermasalah.");
  });

  test("keeps the caller's fallback for unexpected server errors", () => {
    const error = serverError(500, "errors.internal_error", "Ada yang gagal di server.");
    expect(apiErrorMessage(error, m, fallback)).toBe(fallback);
  });

  test("explains a dropped connection", () => {
    expect(apiErrorMessage(new TypeError("Failed to fetch"), m, fallback)).toBe(m.errors.network);
  });

  test("recognises proxy responses that do not use the JSON contract", () => {
    expect(apiErrorMessage(new ApiError("Payload Too Large", 413, { message: "<html>" }), m, fallback)).toBe(m.errors.fileTooLarge);
    expect(apiErrorMessage(new ApiError("Too Many Requests", 429, { message: "Too many requests" }), m, fallback)).toBe(m.errors.tooManyRequests);
  });

  test("uses the fallback for anything else", () => {
    expect(apiErrorMessage(new Error("boom"), m, fallback)).toBe(fallback);
    expect(apiErrorMessage(new ApiError("Bad Gateway", 502, { message: "<html>" }), m, fallback)).toBe(fallback);
  });
});
