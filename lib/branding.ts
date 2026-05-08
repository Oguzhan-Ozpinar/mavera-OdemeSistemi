import type { CSSProperties } from "react";

export type Branding = {
  name: string;
  logoUrl: string;
  color: string;
};

export type InitialDonation = {
  amount?: number;
  amountLocked: boolean;
  note: string;
  noteLocked: boolean;
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeHex(value: string | undefined) {
  const fallback = "#047857";
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed}`;
  return fallback;
}

function hexToRgb(hex: string) {
  const clean = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16)
  };
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case red:
        h = (green - blue) / d + (green < blue ? 6 : 0);
        break;
      case green:
        h = (blue - red) / d + 2;
        break;
      default:
        h = (red - green) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function tone(h: number, s: number, l: number) {
  return `hsl(${h} ${s}% ${l}%)`;
}

export function getBranding(): Branding {
  return {
    name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Mavera",
    logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL ?? "",
    color: normalizeHex(process.env.NEXT_PUBLIC_BRAND_COLOR)
  };
}

export function brandThemeStyle(color: string): CSSProperties {
  const { h, s, l } = rgbToHsl(hexToRgb(color));
  const saturation = Math.max(35, s);

  return {
    "--brand-50": tone(h, Math.min(95, saturation + 18), 96),
    "--brand-100": tone(h, Math.min(92, saturation + 16), 91),
    "--brand-200": tone(h, Math.min(85, saturation + 12), 83),
    "--brand-600": tone(h, saturation, Math.max(34, l + 5)),
    "--brand-700": tone(h, saturation, Math.max(24, l)),
    "--brand-800": tone(h, Math.min(80, saturation + 5), Math.max(18, l - 8)),
    "--brand-ring": tone(h, Math.min(95, saturation + 16), 86)
  } as CSSProperties;
}

export function parseInitialDonation(searchParams: SearchParams): InitialDonation {
  const lockedAmount = firstParam(searchParams.kt);
  const looseAmount = firstParam(searchParams.t);
  const amountSource = lockedAmount ?? looseAmount;
  const parsedAmount = amountSource ? Number(amountSource.replace(",", ".")) : undefined;
  const lockedNote = firstParam(searchParams.kn);
  const looseNote = firstParam(searchParams.n);

  return {
    amount: parsedAmount && Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined,
    amountLocked: Boolean(lockedAmount),
    note: (lockedNote ?? looseNote ?? "").slice(0, 180),
    noteLocked: Boolean(lockedNote)
  };
}
