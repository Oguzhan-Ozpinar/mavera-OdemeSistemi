import { NextRequest, NextResponse } from "next/server";
import { findTransactionByClientRef, createPaymentEvent, updateRecord } from "@/lib/pocketbase";
import { sanitizePaymentPayload } from "@/lib/sanitize";

export const runtime = "nodejs";

async function readCallback(request: NextRequest) {
  if (request.method === "GET") {
    return Object.fromEntries(request.nextUrl.searchParams.entries());
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, unknown>;
  }

  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

function clientRefFrom(payload: Record<string, unknown>) {
  return String(payload.clientRefCode ?? payload.CLIENT_REF_CODE ?? payload.ClientRefCode ?? payload.orderId ?? "");
}

async function handleSuccess(request: NextRequest) {
  const payload = await readCallback(request);
  const clientRefCode = clientRefFrom(payload);
  const transaction = clientRefCode ? await findTransactionByClientRef(clientRefCode) : null;

  if (transaction) {
    await updateRecord("transactions", transaction.id, {
      status: "success",
      nkolay_payment_id: payload.CORE_TRX_ID_RESERVED ?? payload.paymentId ?? payload.sessionId,
      error_code: null,
      error_message: null
    });
    await createPaymentEvent({ transaction: transaction.id, type: "callback_success", provider: "nkolay", payload: sanitizePaymentPayload(payload) });
  }

  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;padding:24px"><h1>Odeme tamamlandi</h1><p>Bu pencereyi kapatabilirsiniz.</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function POST(request: NextRequest) {
  return handleSuccess(request);
}

export async function GET(request: NextRequest) {
  return handleSuccess(request);
}
