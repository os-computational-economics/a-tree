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

    // Find ALL active experiments sharing this room code
    const matched = await db
      .select({
        id: experiments.id,
        name: experiments.name,
      })
      .from(experiments)
      .where(
        and(
          eq(experiments.accessCode, normalizedCode),
          eq(experiments.status, "active"),
          isNull(experiments.deletedAt),
        ),
      );

    if (matched.length === 0) {
      return NextResponse.json({ error: "Invalid code" }, { status: 404 });
    }

    // Grant access to every experiment in this room (idempotent)
    await db
      .insert(experimentAccess)
      .values(matched.map((exp) => ({ experimentId: exp.id, userId: payload.userId })))
      .onConflictDoNothing();

    return NextResponse.json({ count: matched.length });
  } catch (error) {
    console.error("Error granting experiment access:", error);
    return NextResponse.json({ error: "Failed to process code" }, { status: 500 });
  }
}
