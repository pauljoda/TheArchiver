import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getNextRunDate, validateCron } from "@/lib/cron";
import { emitSSEEvent } from "@/lib/events";

export async function GET() {
  try {
    const db = getDb();
    const schedules = db
      .select()
      .from(schema.scheduledUrls)
      .orderBy(desc(schema.scheduledUrls.createdAt))
      .all();

    return NextResponse.json(schedules);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { label, url, cronExpression } = body as {
      label?: string;
      url?: string;
      cronExpression?: string;
    };

    if (!label?.trim()) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }
    if (!url?.trim()) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }
    if (!cronExpression?.trim()) {
      return NextResponse.json(
        { error: "Schedule is required" },
        { status: 400 }
      );
    }

    const validation = validateCron(cronExpression);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid cron expression: ${validation.error}` },
        { status: 400 }
      );
    }

    const nextRunAt = getNextRunDate(cronExpression);

    const db = getDb();
    const result = db
      .insert(schema.scheduledUrls)
      .values({
        label: label.trim(),
        url: url.trim(),
        cronExpression: cronExpression.trim(),
        nextRunAt,
      })
      .returning()
      .get();

    emitSSEEvent({ type: "schedule:changed", data: { id: result.id } });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("Failed to create schedule:", err);
    return NextResponse.json(
      { error: "Failed to create schedule" },
      { status: 500 }
    );
  }
}
