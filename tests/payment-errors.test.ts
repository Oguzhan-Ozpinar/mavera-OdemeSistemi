import { describe, expect, it } from "vitest";
import { friendlyPaymentMessage } from "@/lib/payment-errors";

describe("friendlyPaymentMessage", () => {
  it("maps insufficient balance messages", () => {
    expect(friendlyPaymentMessage(undefined, "Yetersiz bakiye")).toContain("bakiye");
  });

  it("uses fallback for unknown provider responses", () => {
    expect(friendlyPaymentMessage("UNKNOWN", "raw provider detail")).toContain("tamamlanamadi");
  });
});
