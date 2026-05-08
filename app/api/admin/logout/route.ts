import { NextRequest, NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/admin", request.url), { status: 303 });
  clearAdminCookie(response);
  return response;
}
