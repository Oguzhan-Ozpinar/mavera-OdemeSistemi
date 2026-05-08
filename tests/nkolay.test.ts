import { describe, expect, it } from "vitest";
import { hashBase64, normalizeInstallments } from "@/lib/nkolay";

describe("nkolay helpers", () => {
  it("normalizes installment options from provider shape", () => {
    const result = normalizeInstallments({
      PAYMENT_BANK_LIST: [
        {
          INSTALLMENT: "1",
          EncodedValue: "abc",
          TOTAL_AMOUNT: "500.00",
          BANK_NAME: "Test Bank"
        },
        {
          INSTALLMENT: "3",
          EncodedValue: "def",
          TOTAL_AMOUNT: "540.00"
        }
      ]
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ count: 1, label: "Tek cekim", bankName: "Test Bank" });
    expect(result[1]).toMatchObject({ count: 3, label: "3 taksit" });
  });

  it("hashes with sha512 base64", () => {
    expect(hashBase64("mavera")).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(hashBase64("mavera")).toHaveLength(88);
  });
});
