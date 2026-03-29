import { NextResponse } from "next/server";
import { getLogEntries } from "@/lib/log-buffer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = getLogEntries(500);
    return NextResponse.json(entries);
  } catch {
    return NextResponse.json([]);
  }
}
