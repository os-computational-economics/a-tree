import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experiments } from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const payload = await verifyAccessToken(accessToken);
    if (!payload || !payload.roles?.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { experimentId } = await params;

    const [source] = await db
      .select()
      .from(experiments)
      .where(and(eq(experiments.id, experimentId), isNull(experiments.deletedAt)));

    if (!source) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    const [created] = await db
      .insert(experiments)
      .values({
        name: `${source.name} (Copy)`,
        description: source.description,
        status: "draft",
        config: source.config,
        createdBy: payload.userId,
      })
      .returning();

    return NextResponse.json({ experiment: created }, { status: 201 });
  } catch (error) {
    console.error("Error duplicating experiment:", error);
    return NextResponse.json({ error: "Failed to duplicate experiment" }, { status: 500 });
  }
}
