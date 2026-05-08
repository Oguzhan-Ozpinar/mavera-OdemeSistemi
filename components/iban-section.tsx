"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { IbanAccount } from "@/lib/types";

type IbanSectionProps = {
  accounts: IbanAccount[];
  embedded?: boolean;
};

export function IbanSection({ accounts, embedded = false }: IbanSectionProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyIban(account: IbanAccount) {
    await navigator.clipboard.writeText(account.iban.replace(/\s/g, ""));
    setCopiedId(account.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  }

  const content = (
    <>
      {!embedded ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Havale / EFT</h2>
            <p className="mt-1 text-sm text-slate-600">Dilerseniz banka hesaplarina dogrudan bagis yapabilirsiniz.</p>
          </div>
        </div>
      ) : null}
      <div className={embedded ? "grid gap-3" : "mt-4 grid gap-3"}>
        {accounts.map((account) => (
          <div key={account.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{account.bankName}</p>
                <p className="truncate text-xs text-slate-500">
                  {account.accountName} · {account.currency}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyIban(account)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                aria-label={`${account.bankName} IBAN kopyala`}
                title="IBAN kopyala"
              >
                {copiedId === account.id ? <Check className="h-4 w-4 text-[var(--brand-700)]" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-3 break-all rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{account.iban}</p>
          </div>
        ))}
      </div>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {content}
    </section>
  );
}
