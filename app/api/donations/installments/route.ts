import { NextRequest, NextResponse } from "next/server";
import { fetchNkolayInstallments } from "@/lib/nkolay";
import { friendlyPaymentMessage } from "@/lib/payment-errors";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { normalizeDigits, validateAmount } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limited = rateLimit(`installments:${ip}`, 40);
  if (!limited.ok) {
    return NextResponse.json({ message: "Cok fazla deneme yapildi. Lutfen biraz sonra tekrar deneyin." }, { status: 429 });
  }

  try {
    const body = (await request.json()) as { amount?: number; bin?: string };
    const amount = Number(body.amount);
    const bin = normalizeDigits(body.bin ?? "").slice(0, 8);
    const amountError = validateAmount(amount);

    if (amountError || bin.length < 6) {
      return NextResponse.json({ message: amountError ?? "Kartin ilk 6-8 hanesini girin." }, { status: 400 });
    }

    const result = await fetchNkolayInstallments(amount, bin);
    return NextResponse.json({ installments: result.installments });
  } catch (error) {
    return NextResponse.json(
      { message: friendlyPaymentMessage(null, error instanceof Error ? error.message : null) },
      { status: 502 }
    );
  }
}
