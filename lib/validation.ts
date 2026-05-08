import { parsePhoneNumberFromString } from "libphonenumber-js";

export type DonorInput = {
  fullName: string;
  email: string;
  countryCode: string;
  phone: string;
};

export function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function parseFullName(fullName: string) {
  const parts = fullName.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? ""
  };
}

export function toE164(countryCode: string, phone: string) {
  const compactCountryCode = countryCode.startsWith("+") ? countryCode : `+${countryCode}`;
  const candidate = `${compactCountryCode}${normalizeDigits(phone)}`;
  const parsed = parsePhoneNumberFromString(candidate);

  if (!parsed?.isValid()) {
    return null;
  }

  return parsed.number;
}

export function validateDonor(input: DonorInput) {
  const errors: Record<string, string> = {};
  const name = parseFullName(input.fullName);
  const email = input.email.trim().toLowerCase();
  const phoneE164 = toE164(input.countryCode, input.phone);

  if (!name.firstName || !name.lastName) {
    errors.fullName = "Lutfen ad ve soyadinizi yazin.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Gecerli bir e-posta adresi yazin.";
  }

  if (!phoneE164) {
    errors.phone = "Telefon numarasini ulke koduyla uyumlu yazin.";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      firstName: name.firstName,
      lastName: name.lastName,
      fullName: input.fullName.trim(),
      email,
      phoneE164: phoneE164 ?? ""
    }
  };
}

export function validateAmount(value: number) {
  if (!Number.isFinite(value) || value < 10) {
    return "Bagis tutari en az 10 TL olmalidir.";
  }

  if (value > 1000000) {
    return "Lutfen daha dusuk bir tutar girin.";
  }

  return null;
}

export function luhnCheck(cardNumber: string) {
  const digits = normalizeDigits(cardNumber);
  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return digits.length >= 12 && sum % 10 === 0;
}
