const sensitiveKeys = new Set(["cardNumber", "number", "cvv", "cvc", "pan", "creditCardPan"]);

export function sanitizePaymentPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePaymentPayload(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sensitiveKeys.has(key) ? "[redacted]" : sanitizePaymentPayload(item)
      ])
    );
  }

  return value;
}
