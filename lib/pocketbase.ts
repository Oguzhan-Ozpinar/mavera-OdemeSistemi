import { getRuntimeConfig, requireConfigured } from "@/lib/config";
import { sanitizePaymentPayload } from "@/lib/sanitize";

type PocketBaseList<T> = {
  page: number;
  perPage: number;
  totalItems: number;
  items: T[];
};

export type PocketRecord = Record<string, unknown> & { id: string };

let authCache: { token: string; expiresAt: number } | null = null;

function tokenExpiry(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: number };
    return payload.exp ?? 0;
  } catch {
    return 0;
  }
}

async function pocketBaseAuthToken() {
  const config = getRuntimeConfig();
  requireConfigured("PocketBase", {
    POCKETBASE_URL: config.pocketbase.url
  });

  if (config.pocketbase.adminToken) {
    return config.pocketbase.adminToken;
  }

  if (authCache && authCache.expiresAt - 60 > Date.now() / 1000) {
    return authCache.token;
  }

  requireConfigured("PocketBase auth", {
    POCKETBASE_ADMIN_EMAIL: config.pocketbase.adminEmail,
    POCKETBASE_ADMIN_PASSWORD: config.pocketbase.adminPassword
  });

  const response = await fetch(`${config.pocketbase.url}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity: config.pocketbase.adminEmail,
      password: config.pocketbase.adminPassword
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`PocketBase auth failed: ${response.status}`);
  }

  const data = (await response.json()) as { token?: string };
  if (!data.token) {
    throw new Error("PocketBase auth did not return a token");
  }

  authCache = {
    token: data.token,
    expiresAt: tokenExpiry(data.token)
  };
  return data.token;
}

async function pbFetch<T>(path: string, init?: RequestInit) {
  const config = getRuntimeConfig();
  requireConfigured("PocketBase", {
    POCKETBASE_URL: config.pocketbase.url
  });
  const token = await pocketBaseAuthToken();

  const response = await fetch(`${config.pocketbase.url}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: token.startsWith("Bearer ") ? token : token,
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`PocketBase request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function createRecord<T extends PocketRecord>(collection: string, data: Record<string, unknown>) {
  return pbFetch<T>(`/api/collections/${collection}/records`, {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function updateRecord<T extends PocketRecord>(collection: string, id: string, data: Record<string, unknown>) {
  return pbFetch<T>(`/api/collections/${collection}/records/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data)
  });
}

export async function listRecords<T extends PocketRecord>(collection: string, query = "") {
  return pbFetch<PocketBaseList<T>>(`/api/collections/${collection}/records${query}`);
}

export async function createPaymentEvent(data: {
  transaction?: string;
  type: string;
  provider: "nkolay" | "system";
  payload: unknown;
}) {
  return createRecord("payment_events", {
    transaction: data.transaction,
    type: data.type,
    provider: data.provider,
    payload: sanitizePaymentPayload(data.payload),
    created_at: new Date().toISOString()
  });
}

export async function findTransactionByClientRef(clientRefCode: string) {
  const encoded = encodeURIComponent(`client_ref_code="${clientRefCode}"`);
  const result = await listRecords<PocketRecord>("transactions", `?filter=${encoded}&perPage=1`);
  return result.items[0] ?? null;
}
