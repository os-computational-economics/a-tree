import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experiments, experimentAccess } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const payload = await verifyAccessToken(accessToken);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { code } = body as { code: string };

    if (!code?.trim()) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase();

    const [experiment] = await db
      .select({
        id: experiments.id,
        name: experiments.name,
        description: experiments.description,
        status: experiments.status,
        config: experiments.config,
      })
      .from(experiments)
      .where(
        and(
          eq(experiments.accessCode, normalizedCode),
          eq(experiments.status, "active"),
          isNull(experiments.deletedAt),
        ),
      )
      .limit(1);

    if (!experiment) {
      return NextResponse.json({ error: "Invalid code" }, { status: 404 });
    }

    // Upsert access record — idempotent if already granted
    await db
      .insert(experimentAccess)
      .values({ experimentId: experiment.id, userId: payload.userId })
      .onConflictDoNothing();

    return NextResponse.json({
      experiment: {
        id: experiment.id,
        name: experiment.name,
        description: experiment.description,
        blockCount: experiment.config.blocks.length,
        paramCount: Object.keys(experiment.config.params).length,
      },
    });
  } catch (error) {
    console.error("Error granting experiment access:", error);
    return NextResponse.json({ error: "Failed to process code" }, { status: 500 });
  }
}
