import { NextResponse } from "next/server";
import { reloadPlugins } from "@/plugins/registry";

export async function POST() {
  try {
    await reloadPlugins();
    return NextResponse.json({ message: "Plugins reloaded" });
  } catch (err) {
    console.error("Failed to reload plugins:", err);
    return NextResponse.json(
      { error: "Failed to reload plugins" },
      { status: 500 }
    );
  }
}
