import { NextRequest, NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/config";
import { getClientIp } from "@/lib/http";
import {
  createNkolayPayment,
  createNkolayRecurringPayment,
  extractNkolayHtml,
  extractNkolayLink
} from "@/lib/nkolay";
import { friendlyPaymentMessage } from "@/lib/payment-errors";
import { createPaymentEvent, createRecord, updateRecord } from "@/lib/pocketbase";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/security";
import type { InstallmentOption } from "@/lib/types";
import { luhnCheck, normalizeDigits, validateAmount } from "@/lib/validation";

export const runtime = "nodejs";

type PayBody = {
  frequency?: "one_time" | "monthly";
  amount?: number;
  donor?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    phoneE164?: string;
  };
  card?: {
    holderName?: string;
    number?: string;
    month?: string;
    year?: string;
    cvv?: string;
  };
  foreignCard?: boolean;
  installment?: InstallmentOption | null;
  note?: string;
  recurring?: {
    period?: "monthly";
    count?: number;
  };
  turnstileToken?: string;
};

function validatePayBody(body: PayBody) {
  const errors: string[] = [];
  const amount = Number(body.amount);
  const amountError = validateAmount(amount);
  if (amountError) errors.push(amountError);
  if (body.frequency !== "one_time" && body.frequency !== "monthly") errors.push("Bagis turu gecersiz.");
  if (body.frequency !== "one_time") {
    const count = Number(body.recurring?.count);
    if (!Number.isFinite(count) || count < 1 || count > 12) errors.push("Tekrar odeme adedi gecersiz.");
  }
  if (!body.donor?.firstName || !body.donor.lastName || !body.donor.email || !body.donor.phoneE164) {
    errors.push("Bagisci bilgileri eksik.");
  }
  if (!body.card?.holderName || !luhnCheck(normalizeDigits(body.card?.number ?? ""))) {
    errors.push("Kart bilgileri gecersiz.");
  }
  if (!/^(0[1-9]|1[0-2])$/.test(body.card?.month ?? "") || !/^20\d{2}$/.test(body.card?.year ?? "")) {
    errors.push("Kart son kullanma tarihi gecersiz.");
  }
  if (!/^\d{3,4}$/.test(body.card?.cvv ?? "")) errors.push("CVV gecersiz.");

  return { ok: errors.length === 0, errors, amount };
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limited = rateLimit(`pay:${ip}`, 8);
  if (!limited.ok) {
    return NextResponse.json({ status: "failed", message: "Cok fazla odeme denemesi yapildi. Lutfen biraz sonra tekrar deneyin." }, { status: 429 });
  }

  let transactionId: string | undefined;

  try {
    const body = (await request.json()) as PayBody;
    const validation = validatePayBody(body);
    if (!validation.ok) {
      return NextResponse.json({ status: "failed", message: validation.errors[0] }, { status: 400 });
    }

    const turnstileOk = await verifyTurnstile(body.turnstileToken, ip);
    if (!turnstileOk) {
      return NextResponse.json({ status: "failed", message: "Guvenlik dogrulamasi basarisiz oldu. Lutfen tekrar deneyin." }, { status: 403 });
    }

    const config = getRuntimeConfig();
    const recurringCount = Math.min(Math.max(Number(body.recurring?.count) || 1, 1), 12);
    const recurringPeriodDays = 30;
    const donor = await createRecord("donors", {
      first_name: body.donor!.firstName,
      last_name: body.donor!.lastName,
      full_name: body.donor!.fullName,
      email: body.donor!.email,
      phone_e164: body.donor!.phoneE164
    });

    const transaction = await createRecord("transactions", {
      donor: donor.id,
      frequency: body.frequency,
      amount: validation.amount,
      currency: "TRY",
      status: "pending",
      donation_note: body.note?.slice(0, 180) ?? "",
      recurring_count: body.frequency === "one_time" ? null : recurringCount,
      recurring_period_days: body.frequency === "one_time" ? null : recurringPeriodDays,
      total_committed_amount: body.frequency === "one_time" ? validation.amount : validation.amount * recurringCount,
      foreign_card: Boolean(body.foreignCard),
      payment_mode: body.foreignCard && config.enableForeignCard2D ? "2d" : "3d",
      installment: body.foreignCard ? 1 : body.installment?.count ?? 1
    });
    transactionId = transaction.id;

    await updateRecord("transactions", transaction.id, { client_ref_code: transaction.id });

    if (body.frequency !== "one_time") {
      const recurringResponse = await createNkolayRecurringPayment({
        amount: validation.amount,
        clientRefCode: transaction.id,
        firstName: body.donor!.firstName!,
        lastName: body.donor!.lastName!,
        email: body.donor!.email!,
        gsm: body.donor!.phoneE164!,
        installmentCount: recurringCount,
        installmentPeriodDays: recurringPeriodDays,
        cardHolderIP: ip
      });
      const embedUrl = extractNkolayLink(recurringResponse);
      const html = extractNkolayHtml(recurringResponse) ?? undefined;
      const instructionNumber = recurringResponse.INSTRUCTION_NUMBER;

      await createPaymentEvent({ transaction: transaction.id, type: "recurring_created", provider: "nkolay", payload: recurringResponse });
      await updateRecord("transactions", transaction.id, {
        status: embedUrl || html ? "awaiting_subscription_confirmation" : "failed",
        nkolay_payment_id: instructionNumber
      });

      if (typeof instructionNumber === "string") {
        await createRecord("subscriptions", {
          donor: donor.id,
          transaction: transaction.id,
          nkolay_instruction_id: instructionNumber,
          amount: validation.amount,
          installment_count: recurringCount,
          installment_period_days: recurringPeriodDays,
          total_committed_amount: validation.amount * recurringCount,
          status: "pending",
          next_payment_date: null,
          failure_reason: null
        });
      }

      if (embedUrl || html) {
        return NextResponse.json({ status: "subscription_embed", embedUrl, html, transactionId: transaction.id });
      }

      return NextResponse.json(
        { status: "failed", message: friendlyPaymentMessage(String(recurringResponse.ERROR_CODE ?? ""), String(recurringResponse.ERROR_MESSAGE ?? "")) },
        { status: 502 }
      );
    }

    const use3D = !(body.foreignCard && config.enableForeignCard2D);
    const paymentResponse = await createNkolayPayment({
      amount: validation.amount,
      clientRefCode: transaction.id,
      successUrl: `${config.siteUrl}/api/nkolay/callback/success`,
      failUrl: `${config.siteUrl}/api/nkolay/callback/fail`,
      cardHolderName: body.card!.holderName!,
      cardNumber: normalizeDigits(body.card!.number!),
      month: body.card!.month!,
      year: body.card!.year!,
      cvv: body.card!.cvv!,
      encodedValue: body.foreignCard ? "" : body.installment?.encodedValue,
      installmentNo: body.foreignCard ? 1 : body.installment?.count ?? 1,
      use3D,
      cardHolderIP: ip,
      description: body.note?.slice(0, 180) ?? "",
      nameSurname: body.donor!.fullName,
      phone: body.donor!.phoneE164,
      email: body.donor!.email
    });

    await createPaymentEvent({ transaction: transaction.id, type: "payment_requested", provider: "nkolay", payload: paymentResponse });
    const html = extractNkolayHtml(paymentResponse);
    if (html) {
      await updateRecord("transactions", transaction.id, { status: "awaiting_3d" });
      return NextResponse.json({ status: "requires_3d", html, transactionId: transaction.id });
    }

    const responseCode = Number(paymentResponse.RESPONSE_CODE ?? paymentResponse.ResponseCode);
    if (responseCode === 2) {
      await updateRecord("transactions", transaction.id, {
        status: "success",
        nkolay_payment_id: paymentResponse.CORE_TRX_ID_RESERVED ?? paymentResponse.TRANSACTION_ID ?? paymentResponse.sessionId
      });
      return NextResponse.json({ status: "success", message: "Odeme basariyla tamamlandi.", transactionId: transaction.id });
    }

    await updateRecord("transactions", transaction.id, {
      status: "failed",
      error_code: paymentResponse.ERROR_CODE,
      error_message: paymentResponse.ERROR_MESSAGE ?? paymentResponse.RESPONSE_DATA
    });

    return NextResponse.json(
      { status: "failed", message: friendlyPaymentMessage(String(paymentResponse.ERROR_CODE ?? ""), String(paymentResponse.ERROR_MESSAGE ?? "")) },
      { status: 402 }
    );
  } catch (error) {
    if (transactionId) {
      await updateRecord("transactions", transactionId, {
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown payment error"
      }).catch(() => undefined);
    }

    return NextResponse.json(
      { status: "failed", message: friendlyPaymentMessage(null, error instanceof Error ? error.message : null) },
      { status: 500 }
    );
  }
}
