import { NextRequest, NextResponse } from "next/server";
import { getAllSettingsGrouped, setSettings } from "@/lib/settings";

export async function GET() {
  try {
    const groups = getAllSettingsGrouped();
    return NextResponse.json({ groups });
  } catch (err) {
    console.error("Error fetching settings:", err);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const updates: Array<{ key: string; value: unknown }> = body.settings;

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { error: "settings must be an array of { key, value }" },
        { status: 400 }
      );
    }

    await setSettings(updates);

    const groups = getAllSettingsGrouped();
    return NextResponse.json({ groups });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
