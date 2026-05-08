import type { IbanAccount } from "@/lib/types";
import { getRuntimeConfig } from "@/lib/config";
import { listRecords, type PocketRecord } from "@/lib/pocketbase";

export const defaultIbanAccounts: IbanAccount[] = [
  {
    id: "try-main",
    bankName: "Kuveyt Turk",
    accountName: "Mavera Dernegi",
    iban: "TR00 0000 0000 0000 0000 0000 00",
    currency: "TRY"
  },
  {
    id: "eur-main",
    bankName: "Ziraat Bankasi",
    accountName: "Mavera Dernegi",
    iban: "TR00 0000 0000 0000 0000 0000 01",
    currency: "EUR"
  }
];

export async function getIbanAccounts() {
  const config = getRuntimeConfig();
  if (!config.pocketbase.url || (!config.pocketbase.adminToken && (!config.pocketbase.adminEmail || !config.pocketbase.adminPassword))) {
    return defaultIbanAccounts;
  }

  try {
    const result = await listRecords<PocketRecord>("iban_accounts", "?filter=active=true&sort=sort_order&perPage=20");
    const accounts = result.items
      .map((item) => ({
        id: item.id,
        bankName: String(item.bank_name ?? ""),
        accountName: String(item.account_name ?? ""),
        iban: String(item.iban ?? ""),
        currency: String(item.currency ?? "TRY")
      }))
      .filter((item) => item.bankName && item.iban);

    return accounts.length > 0 ? accounts : defaultIbanAccounts;
  } catch {
    return defaultIbanAccounts;
  }
}
