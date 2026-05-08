import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/config";

const cookieName = "mavera_admin";
const maxAge = 60 * 60 * 8;

function adminUser() {
  return process.env.ADMIN_USERNAME ?? "admin";
}

function adminPassword() {
  return process.env.ADMIN_PASSWORD ?? "admin123";
}

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || getRuntimeConfig().security.adminExportToken || "dev-admin-session-secret";
}

function sign(value: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function sessionValue(username: string) {
  const payload = `${username}:${Math.floor(Date.now() / 1000)}`;
  return `${payload}.${sign(payload)}`;
}

function verifySession(value: string | undefined) {
  if (!value) return false;
  const separator = value.lastIndexOf(".");
  if (separator < 0) return false;

  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (sign(payload) !== signature) return false;

  const [username, issuedAtRaw] = payload.split(":");
  const issuedAt = Number(issuedAtRaw);
  if (username !== adminUser() || !Number.isFinite(issuedAt)) return false;

  return Date.now() / 1000 - issuedAt <= maxAge;
}

export async function isAdminSession() {
  const store = await cookies();
  return verifySession(store.get(cookieName)?.value);
}

export function isAdminRequest(request: NextRequest) {
  return verifySession(request.cookies.get(cookieName)?.value);
}

export function validateAdminCredentials(username: string, password: string) {
  return username === adminUser() && password === adminPassword();
}

export function setAdminCookie(response: NextResponse, username: string) {
  response.cookies.set(cookieName, sessionValue(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  });
}

export function clearAdminCookie(response: NextResponse) {
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
