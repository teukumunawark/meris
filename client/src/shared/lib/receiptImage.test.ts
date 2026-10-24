import { describe, expect, test } from "bun:test";
import { receiptLongSideLimit } from "./receiptImage";

describe("receiptLongSideLimit", () => {
  test("shrinks an ordinary phone photo to the default size", () => {
    expect(receiptLongSideLimit(3000, 4000)).toBe(1600);
  });

  test("keeps a long receipt wide enough to read", () => {
    const longSide = receiptLongSideLimit(1500, 6000);
    const shortSideAfterResize = (1500 * longSide) / 6000;
    expect(longSide).toBe(4096);
    expect(shortSideAfterResize).toBeGreaterThan(1000);
  });

  test("keeps the full width of a narrow long receipt within the cap", () => {
    expect(receiptLongSideLimit(1100, 3500)).toBe(3500);
  });

  test("never enlarges a small image", () => {
    expect(receiptLongSideLimit(800, 1000)).toBe(1000);
  });

  test("works for landscape photos", () => {
    expect(receiptLongSideLimit(4000, 3000)).toBe(1600);
  });

  test("falls back to the default for a broken size", () => {
    expect(receiptLongSideLimit(0, 0)).toBe(1600);
  });
});
