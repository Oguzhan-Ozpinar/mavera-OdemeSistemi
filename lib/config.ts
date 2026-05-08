export type RuntimeConfig = {
  siteUrl: string;
  enableForeignCard2D: boolean;
  enableDigitalWallets: boolean;
  nkolay: {
    baseUrl: string;
    paymentEndpoint: string;
    installmentsEndpoint: string;
    recurringCreateEndpoint: string;
    recurringListEndpoint: string;
    recurringCancelEndpoint: string;
    hostedPaymentEndpoint: string;
    sx: string;
    sxList: string;
    sxCancel: string;
    secretKey: string;
    customerKey: string;
    merchantCustomerNo: string;
    currencyNumber: string;
    defaultInstalments: string;
  };
  pocketbase: {
    url: string;
    adminToken: string;
    adminEmail: string;
    adminPassword: string;
  };
  security: {
    turnstileSecretKey: string;
    cronSecret: string;
    adminExportToken: string;
  };
};

function boolEnv(value: string | undefined) {
  return value === "true" || value === "1";
}

function cleanUrl(value: string | undefined, fallback = "") {
  return (value ?? fallback).replace(/\/$/, "");
}

export function getRuntimeConfig(): RuntimeConfig {
  return {
    siteUrl: cleanUrl(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000"),
    enableForeignCard2D: boolEnv(process.env.ENABLE_FOREIGN_CARD_2D),
    enableDigitalWallets: boolEnv(process.env.ENABLE_DIGITAL_WALLETS),
    nkolay: {
      baseUrl: cleanUrl(process.env.NKOLAY_BASE_URL, "https://paynkolaytest.nkolayislem.com.tr"),
      paymentEndpoint: process.env.NKOLAY_PAYMENT_ENDPOINT ?? "/Vpos/Payment/Payment",
      installmentsEndpoint: process.env.NKOLAY_INSTALLMENTS_ENDPOINT ?? "/Vpos/Payment/PaymentInstallments",
      recurringCreateEndpoint: process.env.NKOLAY_RECURRING_CREATE_ENDPOINT ?? "/Vpos/api/RecurringPaymentCreate",
      recurringListEndpoint: process.env.NKOLAY_RECURRING_LIST_ENDPOINT ?? "/Vpos/api/RecurringPaymentList",
      recurringCancelEndpoint: process.env.NKOLAY_RECURRING_CANCEL_ENDPOINT ?? "/Vpos/api/RecurringPaymentCancel",
      hostedPaymentEndpoint: process.env.NKOLAY_HOSTED_PAYMENT_ENDPOINT ?? "/Vpos",
      sx: process.env.NKOLAY_SX ?? "",
      sxList: process.env.NKOLAY_SX_LIST ?? "",
      sxCancel: process.env.NKOLAY_SX_CANCEL ?? "",
      secretKey: process.env.NKOLAY_SECRET_KEY ?? "",
      customerKey: process.env.NKOLAY_CUSTOMER_KEY ?? "",
      merchantCustomerNo: process.env.NKOLAY_MERCHANT_CUSTOMER_NO ?? "",
      currencyNumber: process.env.NKOLAY_CURRENCY_NUMBER ?? "949",
      defaultInstalments: process.env.NKOLAY_DEFAULT_INSTALMENTS ?? "12"
    },
    pocketbase: {
      url: cleanUrl(process.env.POCKETBASE_URL),
      adminToken: process.env.POCKETBASE_ADMIN_TOKEN ?? "",
      adminEmail: process.env.POCKETBASE_ADMIN_EMAIL ?? process.env.POCKETBASE_SUPERUSER_EMAIL ?? "",
      adminPassword: process.env.POCKETBASE_ADMIN_PASSWORD ?? process.env.POCKETBASE_SUPERUSER_PASSWORD ?? ""
    },
    security: {
      turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY ?? "",
      cronSecret: process.env.CRON_SECRET ?? "",
      adminExportToken: process.env.ADMIN_EXPORT_TOKEN ?? ""
    }
  };
}

export function requireConfigured(name: string, values: Record<string, string>) {
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`${name} configuration is missing: ${missing.join(", ")}`);
  }
}
