"use client";

import Script from "next/script";
import { AlertCircle, ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Lock, LockKeyhole, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CreditCardPreview } from "@/components/credit-card-preview";
import { IbanSection } from "@/components/iban-section";
import type { Branding, InitialDonation } from "@/lib/branding";
import type { IbanAccount, InstallmentOption, PayResponse } from "@/lib/types";
import { luhnCheck, normalizeDigits, validateAmount, validateDonor } from "@/lib/validation";

declare global {
  interface Window {
    turnstile?: {
      render: (selector: string, options: { sitekey: string; callback: (token: string) => void }) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const presetAmounts = [250, 500, 1000];
const countryCodes = [
  { label: "TR +90", value: "+90" },
  { label: "DE +49", value: "+49" },
  { label: "US +1", value: "+1" },
  { label: "GB +44", value: "+44" },
  { label: "FR +33", value: "+33" }
];

const steps = ["Tutar", "Bilgiler", "Odeme"] as const;

type Step = 1 | 2 | 3;
type DonationMode = "one_time" | "recurring";

type DonationFlowProps = {
  branding: Branding;
  ibanAccounts: IbanAccount[];
  initialDonation: InitialDonation;
};

export function DonationFlow({ branding, ibanAccounts, initialDonation }: DonationFlowProps) {
  const [step, setStep] = useState<Step>(1);
  const [donationMode, setDonationMode] = useState<DonationMode>("recurring");
  const [recurringCount, setRecurringCount] = useState(12);
  const [amount, setAmount] = useState(initialDonation.amount && presetAmounts.includes(initialDonation.amount) ? initialDonation.amount : 500);
  const [customAmount, setCustomAmount] = useState(
    initialDonation.amount && !presetAmounts.includes(initialDonation.amount) ? String(initialDonation.amount) : ""
  );
  const [note, setNote] = useState(initialDonation.note);
  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("+90");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [foreignCard, setForeignCard] = useState(false);
  const [installments, setInstallments] = useState<InstallmentOption[]>([]);
  const [selectedInstallment, setSelectedInstallment] = useState<InstallmentOption | null>(null);
  const [installmentState, setInstallmentState] = useState<"idle" | "loading" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const [payResponse, setPayResponse] = useState<PayResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const turnstileWidgetId = useRef<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const activeAmount = useMemo(() => {
    const custom = Number(customAmount.replace(",", "."));
    return customAmount ? custom : amount;
  }, [amount, customAmount]);
  const frequency = donationMode === "one_time" ? "one_time" : "monthly";
  const safeRecurringCount = Math.min(Math.max(Number(recurringCount) || 1, 1), 12);
  const recurringTotal = activeAmount * safeRecurringCount;

  const bin = normalizeDigits(cardNumber).slice(0, 8);
  const canFetchInstallments = !foreignCard && bin.length >= 8 && validateAmount(activeAmount) === null;

  useEffect(() => {
    if (!canFetchInstallments) {
      setInstallments([]);
      setSelectedInstallment(null);
      setInstallmentState("idle");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setInstallmentState("loading");
      try {
        const response = await fetch("/api/donations/installments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: activeAmount, bin }),
          signal: controller.signal
        });
        const data = (await response.json()) as { installments?: InstallmentOption[]; message?: string };
        if (!response.ok) throw new Error(data.message ?? "Taksit secenekleri alinamadi.");
        const options = data.installments ?? [];
        setInstallments(options);
        setSelectedInstallment(options[0] ?? null);
        setInstallmentState("idle");
      } catch {
        if (controller.signal.aborted) return;
        setInstallments([]);
        setSelectedInstallment(null);
        setInstallmentState("error");
      }
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeAmount, bin, canFetchInstallments]);

  function renderTurnstile() {
    if (!turnstileSiteKey || turnstileWidgetId.current || !window.turnstile) return;
    turnstileWidgetId.current = window.turnstile.render("#turnstile-widget", {
      sitekey: turnstileSiteKey,
      callback: setTurnstileToken
    });
  }

  function validateStep(nextStep: Step) {
    const nextErrors: Record<string, string> = {};

    if (step === 1) {
      const amountError = validateAmount(activeAmount);
      if (amountError) nextErrors.amount = amountError;
    }

    if (step === 2) {
      const donor = validateDonor({ fullName, email, countryCode, phone });
      Object.assign(nextErrors, donor.errors);
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setStep(nextStep);
    }
  }

  function validatePayment() {
    const nextErrors: Record<string, string> = {};
    const digits = normalizeDigits(cardNumber);

    if (!cardHolderName.trim()) nextErrors.cardHolderName = "Kart uzerindeki adi yazin.";
    if (!luhnCheck(digits)) nextErrors.cardNumber = "Kart numarasini kontrol edin.";
    if (!/^(0[1-9]|1[0-2])$/.test(expiryMonth)) nextErrors.expiryMonth = "Ay 01-12 araliginda olmali.";
    if (!/^20\d{2}$/.test(expiryYear)) nextErrors.expiryYear = "Yili 4 haneli yazin.";
    if (!/^\d{3,4}$/.test(cvv)) nextErrors.cvv = "CVV 3 veya 4 haneli olmali.";
    if (!foreignCard && installments.length > 0 && !selectedInstallment) nextErrors.installment = "Taksit secimi yapin.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPayResponse(null);
    if (!validatePayment()) return;

    const donor = validateDonor({ fullName, email, countryCode, phone });
    if (!donor.ok) {
      setErrors(donor.errors);
      setStep(2);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/donations/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frequency,
          amount: activeAmount,
          donor: donor.value,
          card: {
            holderName: cardHolderName,
            number: normalizeDigits(cardNumber),
            month: expiryMonth,
            year: expiryYear,
            cvv
          },
          foreignCard,
          installment: foreignCard ? null : selectedInstallment,
          note: note.trim(),
          recurring: {
            period: "monthly",
            count: safeRecurringCount
          },
          turnstileToken
        })
      });

      const data = (await response.json()) as PayResponse;
      setPayResponse(data);
      if (!response.ok || data.status === "failed") {
        window.turnstile?.reset(turnstileWidgetId.current ?? undefined);
        setTurnstileToken("");
      }
    } catch {
      setPayResponse({ status: "failed", message: "Odeme istegi su anda tamamlanamadi. Lutfen tekrar deneyin." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-1.5rem)] flex-col gap-3">
      {turnstileSiteKey ? (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer onLoad={renderTurnstile} />
      ) : null}

      <BrandHeader branding={branding} />

      <form onSubmit={submitPayment} className="rounded-lg bg-white p-4 shadow-soft sm:p-6">
        <TimelineStepIndicator step={step} />

        {step === 1 ? (
          <section className="space-y-4 sm:space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Bagis tutari</h2>
              <p className="mt-1 text-sm text-slate-600">Desteginizin sikligini ve tutarini secin.</p>
            </div>

            <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDonationMode("recurring")}
                className={`rounded-md px-4 py-3 text-sm font-semibold transition ${
                  donationMode === "recurring" ? "bg-white text-[var(--brand-700)] shadow-sm" : "text-slate-600"
                }`}
              >
                Tekrar odeme
              </button>
              <button
                type="button"
                onClick={() => setDonationMode("one_time")}
                className={`rounded-md px-4 py-3 text-sm font-semibold transition ${
                  donationMode === "one_time" ? "bg-white text-[var(--brand-700)] shadow-sm" : "text-slate-600"
                }`}
              >
                Tek seferlik
              </button>
            </div>

            {donationMode === "recurring" ? (
              <div className="rounded-lg border border-[var(--brand-100)] bg-[var(--brand-50)] p-3">
                <div className="grid grid-cols-2 rounded-md bg-white/70 p-1">
                  <button
                    type="button"
                    onClick={() => setRecurringCount(12)}
                    className="rounded bg-[var(--brand-700)] px-3 py-2 text-sm font-semibold text-white"
                  >
                    Aylik
                  </button>
                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded px-3 py-2 text-sm font-semibold text-slate-400"
                    title="Nkolay duzenli odeme servisi 30 gunluk periyot destekler."
                  >
                    Gunluk
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_9rem] sm:items-end">
                  <p className="text-sm leading-6 text-[var(--brand-800)]">
                    {activeAmount.toLocaleString("tr-TR")} TL tutarindaki aylik odeme, {safeRecurringCount} kez alinacak.
                  </p>
                  <label className="block">
                    <span className="text-xs font-semibold text-[var(--brand-800)]">Odeme adedi</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={12}
                      value={recurringCount}
                      onChange={(event) => setRecurringCount(Number(event.target.value))}
                      className="mt-1 w-full rounded-md border border-[var(--brand-200)] bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                    />
                  </label>
                </div>

                <div className="mt-3 rounded-md border border-[var(--brand-100)] bg-white px-3 py-2 text-sm text-slate-700">
                  Toplam odeme:{" "}
                  <strong className="text-[var(--brand-800)]">
                    {activeAmount.toLocaleString("tr-TR")} TL x {safeRecurringCount} = {recurringTotal.toLocaleString("tr-TR")} TL
                  </strong>
                </div>
                <p className="mt-2 text-xs text-slate-500">Nkolay duzenli odeme servisi dokumana gore sadece 30 gunluk periyot ve en fazla 12 odeme destekler.</p>
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-3">
              {presetAmounts.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  disabled={initialDonation.amountLocked}
                  onClick={() => {
                    setAmount(preset);
                    setCustomAmount("");
                  }}
                  className={`rounded-lg border px-3 py-4 text-base font-semibold transition ${
                    !customAmount && amount === preset
                      ? "border-[var(--brand-700)] bg-[var(--brand-50)] text-[var(--brand-800)]"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55"
                  }`}
                >
                  {preset.toLocaleString("tr-TR")} TL
                </button>
              ))}
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Serbest tutar</span>
              <input
                inputMode="decimal"
                value={customAmount}
                onChange={(event) => setCustomAmount(event.target.value)}
                readOnly={initialDonation.amountLocked}
                placeholder="Orn. 750"
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-base read-only:bg-slate-50 read-only:text-slate-500"
              />
            </label>
            {errors.amount ? <p className="text-sm text-red-600">{errors.amount}</p> : null}
            {initialDonation.amountLocked ? <p className="text-xs font-medium text-[var(--brand-700)]">Bu tutar bagis linki ile sabitlendi.</p> : null}

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Bagis notu</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, 180))}
                readOnly={initialDonation.noteLocked}
                placeholder="Orn. Kurban, burs, zekat"
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-base read-only:bg-slate-50 read-only:text-slate-500"
              />
              {initialDonation.noteLocked ? <span className="mt-1 block text-xs font-medium text-[var(--brand-700)]">Bu not bagis linki ile sabitlendi.</span> : null}
            </label>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4 sm:space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Kisisel bilgiler</h2>
              <p className="mt-1 text-sm text-slate-600">Makbuz ve odeme bilgilendirmesi icin gereklidir.</p>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Ad Soyad</span>
              <input
                name="name"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-base"
              />
              {errors.fullName ? <span className="mt-1 block text-sm text-red-600">{errors.fullName}</span> : null}
            </label>

            <div className="grid grid-cols-[minmax(5.25rem,22%)_1fr] gap-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Kod</span>
                <select
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-3 text-sm sm:px-3 sm:text-base"
                  aria-label="Ulke kodu"
                >
                  {countryCodes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Telefon</span>
                <input
                  name="tel"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="555 555 55 55"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-base"
                />
                {errors.phone ? <span className="mt-1 block text-sm text-red-600">{errors.phone}</span> : null}
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">E-posta</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-base"
              />
              {errors.email ? <span className="mt-1 block text-sm text-red-600">{errors.email}</span> : null}
            </label>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Guvenli odeme</h2>
              <p className="mt-1 text-sm text-slate-600">
                {activeAmount.toLocaleString("tr-TR")} TL ·{" "}
                {frequency === "one_time" ? "Tek seferlik bagis" : "Aylik tekrar odeme"}
              </p>
              {frequency !== "one_time" ? (
                <p className="mt-1 text-xs font-medium text-[var(--brand-700)]">
                  {safeRecurringCount} odeme sonunda toplam {recurringTotal.toLocaleString("tr-TR")} TL tahsil edilir.
                </p>
              ) : null}
            </div>

            <CreditCardPreview holderName={cardHolderName} number={cardNumber} expiryMonth={expiryMonth} expiryYear={expiryYear} />

            <div className="grid gap-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Kart uzerindeki ad</span>
                <input
                  autoComplete="cc-name"
                  value={cardHolderName}
                  onChange={(event) => setCardHolderName(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-base"
                />
                {errors.cardHolderName ? <span className="mt-1 block text-sm text-red-600">{errors.cardHolderName}</span> : null}
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Kart numarasi</span>
                <input
                  autoComplete="cc-number"
                  inputMode="numeric"
                  value={cardNumber}
                  onChange={(event) => setCardNumber(event.target.value)}
                  className="card-number-mask mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-base"
                  maxLength={23}
                />
                {errors.cardNumber ? <span className="mt-1 block text-sm text-red-600">{errors.cardNumber}</span> : null}
              </label>

              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Ay</span>
                  <input
                    autoComplete="cc-exp-month"
                    inputMode="numeric"
                    placeholder="AA"
                    value={expiryMonth}
                    onChange={(event) => setExpiryMonth(normalizeDigits(event.target.value).slice(0, 2))}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-base"
                  />
                  {errors.expiryMonth ? <span className="mt-1 block text-xs text-red-600">{errors.expiryMonth}</span> : null}
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Yil</span>
                  <input
                    autoComplete="cc-exp-year"
                    inputMode="numeric"
                    placeholder="YYYY"
                    value={expiryYear}
                    onChange={(event) => setExpiryYear(normalizeDigits(event.target.value).slice(0, 4))}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-base"
                  />
                  {errors.expiryYear ? <span className="mt-1 block text-xs text-red-600">{errors.expiryYear}</span> : null}
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">CVV</span>
                  <input
                    autoComplete="cc-csc"
                    inputMode="numeric"
                    value={cvv}
                    onChange={(event) => setCvv(normalizeDigits(event.target.value).slice(0, 4))}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-base"
                  />
                  {errors.cvv ? <span className="mt-1 block text-xs text-red-600">{errors.cvv}</span> : null}
                </label>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-[var(--brand-100)] bg-[var(--brand-50)] p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={foreignCard}
                onChange={(event) => setForeignCard(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[var(--brand-700)]"
              />
              <span>
                <strong className="block text-slate-900">Odemeyi yurt disi karti ile yapiyorum</strong>
                Secilirse taksit kapatilir. 3D olmadan cekim sadece kurum tarafindan etkinlestirildiyse uygulanir.
              </span>
            </label>

            {!foreignCard ? (
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CalendarDays className="h-4 w-4 text-[var(--brand-700)]" />
                  Taksit secenekleri
                </div>
                {installmentState === "loading" ? <p className="mt-3 text-sm text-slate-500">Taksitler sorgulaniyor...</p> : null}
                {installmentState === "error" ? <p className="mt-3 text-sm text-red-600">Taksit secenekleri alinamadi.</p> : null}
                {installments.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {installments.map((option) => (
                      <label key={`${option.count}-${option.encodedValue}`} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                        <input
                          type="radio"
                          name="installment"
                          checked={selectedInstallment?.encodedValue === option.encodedValue}
                          onChange={() => setSelectedInstallment(option)}
                          className="h-4 w-4 text-[var(--brand-700)]"
                        />
                        <span className="text-sm text-slate-700">
                          <strong className="text-slate-900">{option.label}</strong>
                          {option.bankName ? ` · ${option.bankName}` : ""}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : installmentState === "idle" ? (
                  <p className="mt-3 text-sm text-slate-500">Kartin ilk 8 hanesi girildiginde listelenir.</p>
                ) : null}
                {errors.installment ? <p className="mt-2 text-sm text-red-600">{errors.installment}</p> : null}
              </div>
            ) : null}

            {turnstileSiteKey ? <div id="turnstile-widget" className="min-h-16" /> : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-700)] px-5 py-4 text-base font-semibold text-white transition hover:bg-[var(--brand-800)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Lock className="h-4 w-4" />
              {submitting ? "Isleniyor..." : "Odemeyi tamamla"}
            </button>
          </section>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-5 sm:mt-6 sm:pt-0">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as Step)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Geri
            </button>
          ) : (
            <span />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => validateStep((step + 1) as Step)}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-700)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-800)]"
            >
              Devam
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {payResponse ? <PaymentResult response={payResponse} /> : null}
      </form>

      <details className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Havale / EFT bilgileri
        </summary>
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-3 text-sm text-slate-600">Dilerseniz banka hesaplarina dogrudan bagis yapabilirsiniz.</p>
          <IbanSection accounts={ibanAccounts} embedded />
        </div>
      </details>

      <SecurityStrip />
    </div>
  );
}

function BrandHeader({ branding }: { branding: Branding }) {
  return (
    <header className="mb-4 flex items-center justify-center sm:mb-5">
      <div className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--brand-100)] bg-[var(--brand-50)] px-4 py-2">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt={`${branding.name} logo`} className="h-8 max-w-28 object-contain" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--brand-700)] text-sm font-bold text-white">
            {branding.name.slice(0, 1).toLocaleUpperCase("tr-TR")}
          </div>
        )}
        <span className="text-sm font-semibold text-[var(--brand-800)]">{branding.name}</span>
      </div>
    </header>
  );
}

function TimelineStepIndicator({ step }: { step: Step }) {
  return (
    <div className="mb-5 px-1 sm:mb-6" aria-label="Bagis adimlari">
      <div className="relative flex items-start justify-between">
        <div className="absolute left-[16%] right-[16%] top-4 h-0.5 bg-[var(--brand-100)]" aria-hidden="true" />
        <div
          className="absolute left-[16%] top-4 h-0.5 bg-[var(--brand-700)] transition-all"
          style={{ width: step === 1 ? "0%" : step === 2 ? "34%" : "68%" }}
          aria-hidden="true"
        />
        {steps.map((label, index) => {
          const itemStep = (index + 1) as Step;
          const active = step === itemStep;
          const complete = step > itemStep;

          return (
            <div key={label} className="relative z-10 flex w-20 flex-col items-center gap-1 text-center" aria-current={active ? "step" : undefined}>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  active || complete
                    ? "border-[var(--brand-700)] bg-[var(--brand-700)] text-white"
                    : "border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                {complete ? <BadgeCheck className="h-4 w-4" aria-hidden="true" /> : itemStep}
              </span>
              <span className={`text-xs font-semibold sm:text-sm ${active || complete ? "text-[var(--brand-800)]" : "text-slate-500"}`}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SecurityStrip() {
  const badges = ["SSL", "3D Secure", "PCI DSS"];

  return (
    <section className="mt-auto rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-700)]" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Guvenli islem</h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-600 sm:text-sm">
              Kart bilgileriniz saklanmaz; odeme verileri sadece guvenli sunucu rotalari uzerinden islenir.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--brand-100)] bg-[var(--brand-50)] px-2 py-1 text-[11px] font-bold text-[var(--brand-800)]"
            >
              <LockKeyhole className="h-3 w-3" aria-hidden="true" />
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function PaymentResult({ response }: { response: PayResponse }) {
  if (response.status === "requires_3d" || response.status === "subscription_embed") {
    return (
      <div className="mt-5 rounded-lg border border-[var(--brand-100)] bg-[var(--brand-50)] p-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--brand-800)]">
          <Lock className="h-4 w-4" />
          Odeme dogrulamasi
        </div>
        {response.html ? (
          <iframe
            title="Odeme dogrulama"
            srcDoc={response.html}
            sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation-by-user-activation"
            className="h-[540px] w-full rounded-lg border border-slate-200 bg-white"
          />
        ) : response.status === "subscription_embed" && response.embedUrl ? (
          <iframe
            title="Duzenli odeme"
            src={response.embedUrl}
            sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation-by-user-activation"
            className="h-[540px] w-full rounded-lg border border-slate-200 bg-white"
          />
        ) : null}
      </div>
    );
  }

  if (response.status === "success") {
    return (
      <div className="mt-5 rounded-lg border border-[var(--brand-100)] bg-[var(--brand-50)] p-4 text-sm text-[var(--brand-800)]">
        <strong className="block">Tesekkur ederiz.</strong>
        {response.message}
      </div>
    );
  }

  return (
    <div className="mt-5 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{response.message}</span>
    </div>
  );
}
