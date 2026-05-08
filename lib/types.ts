export type DonationFrequency = "one_time" | "monthly";

export type InstallmentOption = {
  count: number;
  label: string;
  totalAmount: number;
  monthlyAmount?: number;
  encodedValue: string;
  bankName?: string;
};

export type IbanAccount = {
  id: string;
  bankName: string;
  accountName: string;
  iban: string;
  currency: string;
};

export type PayResponse =
  | { status: "success"; message: string; transactionId?: string }
  | { status: "requires_3d"; html: string; transactionId?: string }
  | { status: "subscription_embed"; embedUrl?: string; html?: string; transactionId?: string }
  | { status: "failed"; message: string };
