import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export async function PATCH(req: NextRequest) {
  try {
    const { orderedIds } = (await req.json()) as { orderedIds: string[] };

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: "orderedIds must be an array" }, { status: 400 });
    }

    const db = getDb();

    for (let i = 0; i < orderedIds.length; i++) {
      db.update(schema.installedPlugins)
        .set({ sortOrder: i })
        .where(eq(schema.installedPlugins.id, orderedIds[i]))
        .run();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to reorder plugins:", err);
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
}
