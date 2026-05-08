import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { cancelNkolayRecurringPayment } from "@/lib/nkolay";
import { createPaymentEvent, updateRecord } from "@/lib/pocketbase";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(new URL("/admin?error=auth", request.url), { status: 303 });
  }

  const { id } = await context.params;
  const form = await request.formData();
  const instructionNumber = String(form.get("instructionNumber") ?? "");

  if (!instructionNumber) {
    return NextResponse.redirect(new URL("/admin?error=missing_instruction", request.url), { status: 303 });
  }

  try {
    const result = await cancelNkolayRecurringPayment(instructionNumber);
    await updateRecord("subscriptions", id, {
      status: "cancelled",
      failure_reason: "Admin tarafindan iptal edildi"
    });
    await createPaymentEvent({
      type: "recurring_cancelled",
      provider: "nkolay",
      payload: { subscription: id, instructionNumber, result }
    });
    return NextResponse.redirect(new URL("/admin?cancelled=1", request.url), { status: 303 });
  } catch (error) {
    await createPaymentEvent({
      type: "recurring_cancel_failed",
      provider: "nkolay",
      payload: { subscription: id, instructionNumber, error: error instanceof Error ? error.message : "Unknown error" }
    }).catch(() => undefined);
    return NextResponse.redirect(new URL("/admin?error=cancel_failed", request.url), { status: 303 });
  }
}
