import { NextRequest, NextResponse } from "next/server";
import { setAdminCookie, validateAdminCredentials } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");

  if (!validateAdminCredentials(username, password)) {
    return NextResponse.redirect(new URL("/admin?error=1", request.url), { status: 303 });
  }

  const response = NextResponse.redirect(new URL("/admin", request.url), { status: 303 });
  setAdminCookie(response, username);
  return response;
}
