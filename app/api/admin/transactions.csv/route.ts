import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getRuntimeConfig } from "@/lib/config";
import { bearerToken } from "@/lib/http";
import { listRecords, type PocketRecord } from "@/lib/pocketbase";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const config = getRuntimeConfig();
  const validBearer = config.security.adminExportToken && bearerToken(request) === config.security.adminExportToken;
  if (!isAdminRequest(request) && !validBearer) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const result = await listRecords<PocketRecord>("transactions", "?sort=-created&perPage=500");
  const csv = toCsv(result.items);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mavera-transactions.csv"`
    }
  });
}
