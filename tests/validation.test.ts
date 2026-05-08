import { describe, expect, it } from "vitest";
import { luhnCheck, parseFullName, toE164, validateAmount, validateDonor } from "@/lib/validation";

describe("validation", () => {
  it("normalizes Turkish mobile numbers to E.164", () => {
    expect(toE164("+90", "555 555 55 55")).toBe("+905555555555");
  });

  it("requires first and last name", () => {
    const result = validateDonor({
      fullName: "Serhat",
      email: "serhat@example.org",
      countryCode: "+90",
      phone: "5555555555"
    });

    expect(result.ok).toBe(false);
    expect(result.errors.fullName).toBeTruthy();
  });

  it("splits full names conservatively", () => {
    expect(parseFullName("Ahmet Hamdi Tanpinar")).toEqual({
      firstName: "Ahmet Hamdi",
      lastName: "Tanpinar"
    });
  });

  it("validates donation amount bounds", () => {
    expect(validateAmount(9)).toBeTruthy();
    expect(validateAmount(250)).toBeNull();
  });

  it("checks card numbers with luhn", () => {
    expect(luhnCheck("4546711234567894")).toBe(true);
    expect(luhnCheck("4546711234567890")).toBe(false);
  });
});
