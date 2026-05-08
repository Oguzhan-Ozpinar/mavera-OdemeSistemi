"use client";

import { CreditCard } from "lucide-react";
import { normalizeDigits } from "@/lib/validation";

type CreditCardPreviewProps = {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
};

function maskCardNumber(value: string) {
  const digits = normalizeDigits(value).padEnd(16, "•").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

export function CreditCardPreview({ holderName, number, expiryMonth, expiryYear }: CreditCardPreviewProps) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-slate-900 p-5 text-white shadow-soft">
      <div className="absolute inset-x-0 top-0 h-1 bg-[var(--brand-200)]" />
      <div className="flex items-center justify-between">
        <CreditCard className="h-7 w-7 text-[var(--brand-100)]" aria-hidden="true" />
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">Guvenli POS</span>
      </div>
      <div className="card-number-mask mt-8 text-xl font-semibold sm:text-2xl">{maskCardNumber(number)}</div>
      <div className="mt-8 flex items-end justify-between gap-4 text-xs uppercase text-slate-300">
        <div className="min-w-0">
          <span className="block text-[10px] text-slate-400">Kart sahibi</span>
          <strong className="block truncate text-sm normal-case text-white">{holderName || "Ad Soyad"}</strong>
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-[10px] text-slate-400">SKT</span>
          <strong className="text-sm text-white">
            {expiryMonth || "AA"}/{expiryYear ? expiryYear.slice(-2) : "YY"}
          </strong>
        </div>
      </div>
    </div>
  );
}
