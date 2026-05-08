import { NextRequest, NextResponse } from "next/server";
import { findTransactionByClientRef, createPaymentEvent, updateRecord } from "@/lib/pocketbase";
import { friendlyPaymentMessage } from "@/lib/payment-errors";
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

async function handleFail(request: NextRequest) {
  const payload = await readCallback(request);
  const clientRefCode = clientRefFrom(payload);
  const errorCode = String(payload.ERROR_CODE ?? payload.errorCode ?? "");
  const errorMessage = String(payload.ERROR_MESSAGE ?? payload.errorMessage ?? payload.RESPONSE_DATA ?? "");
  const transaction = clientRefCode ? await findTransactionByClientRef(clientRefCode) : null;

  if (transaction) {
    await updateRecord("transactions", transaction.id, {
      status: "failed",
      error_code: errorCode,
      error_message: errorMessage
    });
    await createPaymentEvent({ transaction: transaction.id, type: "callback_failed", provider: "nkolay", payload: sanitizePaymentPayload(payload) });
  }

  const message = friendlyPaymentMessage(errorCode, errorMessage);
  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;padding:24px"><h1>Odeme tamamlanamadi</h1><p>${message}</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function POST(request: NextRequest) {
  return handleFail(request);
}

export async function GET(request: NextRequest) {
  return handleFail(request);
}
