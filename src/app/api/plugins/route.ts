import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";

export async function GET() {
  try {
    const db = getDb();
    const plugins = db
      .select()
      .from(schema.installedPlugins)
      .orderBy(asc(schema.installedPlugins.sortOrder))
      .all();

    const result = plugins.map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      description: p.description,
      author: p.author,
      urlPatterns: JSON.parse(p.urlPatterns) as string[],
      fileTypes: p.fileTypes ? JSON.parse(p.fileTypes) as string[] : [],
      enabled: p.enabled,
      hasSettings: p.hasSettings,
      installedAt: p.installedAt,
      sortOrder: p.sortOrder,
    }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}
