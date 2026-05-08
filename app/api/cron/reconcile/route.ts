import { NextRequest, NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/config";
import { bearerToken, getClientIp } from "@/lib/http";
import { listNkolayRecurringPayments } from "@/lib/nkolay";
import { createPaymentEvent, listRecords, updateRecord, type PocketRecord } from "@/lib/pocketbase";

export const runtime = "nodejs";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function isFailedInstruction(status: string) {
  const normalized = status.toLocaleLowerCase("tr-TR");
  return normalized.includes("red") || normalized.includes("reject") || normalized.includes("pasif") || normalized.includes("inactive");
}

export async function POST(request: NextRequest) {
  const config = getRuntimeConfig();
  if (!config.security.cronSecret || bearerToken(request) !== config.security.cronSecret) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 35);

  const payload = await listNkolayRecurringPayments({
    startDate: formatDate(start),
    endDate: formatDate(end),
    cardHolderIP: getClientIp(request)
  });
  await createPaymentEvent({ type: "recurring_reconcile", provider: "nkolay", payload });

  const instructions = Array.isArray(payload.INSTRUCTION_LIST) ? payload.INSTRUCTION_LIST : [];
  let updated = 0;

  for (const instruction of instructions) {
    const row = instruction as Record<string, unknown>;
    const instructionId = String(row.INSTRUCTION_ID ?? row.INSTRUCTION_NUMBER ?? "");
    if (!instructionId) continue;

    const existing = await listRecords<PocketRecord>(
      "subscriptions",
      `?filter=${encodeURIComponent(`nkolay_instruction_id="${instructionId}"`)}&perPage=1`
    );
    const subscription = existing.items[0];
    if (!subscription) continue;

    const status = String(row.INSTRUCTION_STATUS ?? row.ACTIVE ?? "");
    await updateRecord("subscriptions", subscription.id, {
      status: isFailedInstruction(status) ? "failed" : "active",
      next_payment_date: row.NEXT_PAYMENT_DATE || null,
      failure_reason: isFailedInstruction(status) ? status : null
    });
    updated += 1;
  }

  return NextResponse.json({ ok: true, checked: instructions.length, updated });
}
