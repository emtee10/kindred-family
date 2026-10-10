import { createHash, timingSafeEqual } from "node:crypto";
// Fixed-size digests avoid length-dependent comparisons; Auth.js manages session crypto.
export function passwordMatches(supplied: unknown, expected: string | undefined): boolean {
  if (typeof supplied !== "string" || !supplied || !expected) return false;
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(supplied), digest(expected));
}
