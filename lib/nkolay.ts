import crypto from "node:crypto";
import { getRuntimeConfig, requireConfigured } from "@/lib/config";
import type { InstallmentOption } from "@/lib/types";

type NkolayJson = Record<string, unknown>;

export type NkolayPaymentInput = {
  amount: number;
  clientRefCode: string;
  successUrl: string;
  failUrl: string;
  cardHolderName: string;
  cardNumber: string;
  month: string;
  year: string;
  cvv: string;
  encodedValue?: string;
  installmentNo: number;
  use3D: boolean;
  cardHolderIP: string;
  description?: string;
  nameSurname?: string;
  phone?: string;
  email?: string;
};

export type NkolayRecurringInput = {
  amount: number;
  clientRefCode: string;
  firstName: string;
  lastName: string;
  email: string;
  gsm: string;
  installmentCount: number;
  installmentPeriodDays: number;
  cardHolderIP: string;
};

function amountString(amount: number) {
  return amount.toFixed(2);
}

export function hashBase64(value: string) {
  return crypto.createHash("sha512").update(value, "utf8").digest("base64");
}

function paymentHash(input: {
  sx: string;
  clientRefCode: string;
  amount: string;
  successUrl: string;
  failUrl: string;
  rnd: string;
  customerKey: string;
  secretKey: string;
}) {
  return hashBase64(
    `${input.sx}|${input.clientRefCode}|${input.amount}|${input.successUrl}|${input.failUrl}|${input.rnd}|${input.customerKey}|${input.secretKey}`
  );
}

function recurringHash(input: { sx: string; gsm: string; amount: string; clientRefCode: string; secretKey: string }) {
  return hashBase64(`${input.sx}|${input.gsm}|${input.amount}|${input.clientRefCode}|${input.secretKey}`);
}

function recurringCancelHash(input: { sx: string; instructionNumber: string; secretKey: string }) {
  return hashBase64(`${input.sx}|${input.instructionNumber}|${input.secretKey}`);
}

async function readProviderResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as NkolayJson;
  } catch {
    return { raw: text };
  }
}

async function postForm(path: string, form: Record<string, string>) {
  const config = getRuntimeConfig();
  const body = new FormData();
  Object.entries(form).forEach(([key, value]) => body.append(key, value));

  const response = await fetch(`${config.nkolay.baseUrl}${path}`, {
    method: "POST",
    body,
    cache: "no-store"
  });
  const data = await readProviderResponse(response);
  if (!response.ok) throw new Error(`Nkolay form request failed: ${response.status}`);
  return data;
}

async function postJson(path: string, payload: Record<string, unknown>) {
  const config = getRuntimeConfig();
  const response = await fetch(`${config.nkolay.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  const data = await readProviderResponse(response);
  if (!response.ok) throw new Error(`Nkolay json request failed: ${response.status}`);
  return data;
}

export function normalizeInstallments(providerResponse: NkolayJson): InstallmentOption[] {
  const list = providerResponse.PAYMENT_BANK_LIST;
  if (!Array.isArray(list)) return [];

  return list
    .map((item): InstallmentOption | null => {
      const row = item as Record<string, unknown>;
      const count = Number(row.INSTALLMENT ?? row.Installment ?? row.installment ?? 1);
      const encodedValue = String(row.EncodedValue ?? row.ENCODED_VALUE ?? "");
      const totalAmount = Number(row.TOTAL_AMOUNT ?? row.TotalAmount ?? row.AMOUNT ?? row.Amount ?? 0);
      const monthlyAmount = Number(row.MONTHLY_AMOUNT ?? row.MonthlyAmount ?? 0);
      const bankName = row.BANK_NAME ?? row.BankName ?? row.BANK;

      if (!encodedValue || !Number.isFinite(count)) return null;
      const option: InstallmentOption = {
        count,
        encodedValue,
        totalAmount,
        label: count <= 1 ? "Tek cekim" : `${count} taksit`
      };

      if (Number.isFinite(monthlyAmount) && monthlyAmount > 0) {
        option.monthlyAmount = monthlyAmount;
      }
      if (typeof bankName === "string") {
        option.bankName = bankName;
      }

      return option;
    })
    .filter((item): item is InstallmentOption => item !== null);
}

export async function fetchNkolayInstallments(amount: number, bin: string) {
  const config = getRuntimeConfig();
  requireConfigured("Nkolay", {
    NKOLAY_SX: config.nkolay.sx
  });

  const response = await postForm(config.nkolay.installmentsEndpoint, {
    sx: config.nkolay.sx,
    amount: amountString(amount),
    cardNumber: bin,
    hosturl: config.siteUrl,
    iscardvalid: "false"
  });

  return {
    raw: response,
    installments: normalizeInstallments(response)
  };
}

export async function createNkolayPayment(input: NkolayPaymentInput) {
  const config = getRuntimeConfig();
  requireConfigured("Nkolay", {
    NKOLAY_SX: config.nkolay.sx,
    NKOLAY_SECRET_KEY: config.nkolay.secretKey
  });

  const amount = amountString(input.amount);
  const rnd = new Date().toLocaleString("tr-TR", { hour12: false }).replace(/\./g, "-");
  const hashDatav2 = paymentHash({
    sx: config.nkolay.sx,
    clientRefCode: input.clientRefCode,
    amount,
    successUrl: input.successUrl,
    failUrl: input.failUrl,
    rnd,
    customerKey: config.nkolay.customerKey,
    secretKey: config.nkolay.secretKey
  });

  return postForm(config.nkolay.paymentEndpoint, {
    EncodedValue: input.encodedValue ?? "",
    installmentNo: String(input.installmentNo),
    instalments: config.nkolay.defaultInstalments,
    amount,
    sx: config.nkolay.sx,
    clientRefCode: input.clientRefCode,
    successUrl: input.successUrl,
    failUrl: input.failUrl,
    cardHolderName: input.cardHolderName,
    month: input.month,
    year: input.year,
    cvv: input.cvv,
    cardNumber: input.cardNumber,
    use3D: input.use3D ? "true" : "false",
    transactionType: "SALES",
    cardHolderIP: input.cardHolderIP,
    rnd,
    hashDatav2,
    environment: "API",
    currencyNumber: config.nkolay.currencyNumber,
    MerchantCustomerNo: config.nkolay.merchantCustomerNo,
    description: input.description ?? "",
    namesurname: input.nameSurname ?? "",
    phone: input.phone ?? "",
    email: input.email ?? ""
  });
}

export async function createNkolayRecurringPayment(input: NkolayRecurringInput) {
  const config = getRuntimeConfig();
  requireConfigured("Nkolay", {
    NKOLAY_SX: config.nkolay.sx,
    NKOLAY_SECRET_KEY: config.nkolay.secretKey
  });

  const amount = amountString(input.amount);
  const hashDatav2 = recurringHash({
    sx: config.nkolay.sx,
    gsm: input.gsm,
    amount,
    clientRefCode: input.clientRefCode,
    secretKey: config.nkolay.secretKey
  });

  return postJson(config.nkolay.recurringCreateEndpoint, {
    sx: config.nkolay.sx,
    language: "tr",
    Instalment: input.installmentCount,
    InstalmentPeriod: input.installmentPeriodDays,
    CustomerName: input.firstName,
    CustomerMiddleName: "",
    CustomerSurname: input.lastName,
    ClientRefCode: input.clientRefCode,
    PaymentStartChose: 1,
    PaymentStartDate: new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date()).replace(/\./g, "/"),
    Email: input.email,
    Gsm: input.gsm,
    Amount: amount,
    Description: "Mavera aylik tekrar odeme",
    hashDatav2,
    cardHolderIP: input.cardHolderIP
  });
}

export async function listNkolayRecurringPayments(input: { startDate: string; endDate: string; cardHolderIP: string }) {
  const config = getRuntimeConfig();
  requireConfigured("Nkolay", { NKOLAY_SX: config.nkolay.sx });

  return postJson(config.nkolay.recurringListEndpoint, {
    sx: config.nkolay.sx,
    startDate: input.startDate,
    endDate: input.endDate,
    nameSurname: "",
    gsm: "",
    cardHolderIP: input.cardHolderIP
  });
}

export async function cancelNkolayRecurringPayment(instructionNumber: string) {
  const config = getRuntimeConfig();
  requireConfigured("Nkolay", {
    NKOLAY_SX: config.nkolay.sx,
    NKOLAY_SECRET_KEY: config.nkolay.secretKey
  });

  return postJson(config.nkolay.recurringCancelEndpoint, {
    sx: config.nkolay.sx,
    InstructionNumber: instructionNumber,
    hashDatav2: recurringCancelHash({
      sx: config.nkolay.sx,
      instructionNumber,
      secretKey: config.nkolay.secretKey
    })
  });
}

export function extractNkolayHtml(response: NkolayJson) {
  const html = response.BANK_REQUEST_MESSAGE ?? response.bankRequestMessage ?? response.raw;
  return typeof html === "string" && html.includes("<") ? html : null;
}

export function extractNkolayLink(response: NkolayJson) {
  const link = response.LINK ?? response.Link ?? response.link ?? response.PAYMENT_LINK;
  return typeof link === "string" ? link : null;
}
