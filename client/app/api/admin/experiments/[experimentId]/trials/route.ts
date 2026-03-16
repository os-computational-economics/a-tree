import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experimentTrials } from "@/lib/db/schema";
import { eq, desc, and, isNull, inArray } from "drizzle-orm";

export async function GET(
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

    const trials = await db
      .select({
        id: experimentTrials.id,
        trialCode: experimentTrials.trialCode,
        status: experimentTrials.status,
        historyTable: experimentTrials.historyTable,
        chatLogs: experimentTrials.chatLogs,
        surveyResponses: experimentTrials.surveyResponses,
        createdAt: experimentTrials.createdAt,
        updatedAt: experimentTrials.updatedAt,
      })
      .from(experimentTrials)
      .where(and(eq(experimentTrials.experimentId, experimentId), isNull(experimentTrials.deletedAt)))
      .orderBy(desc(experimentTrials.createdAt));

    return NextResponse.json({ trials });
  } catch (error) {
    console.error("Error fetching trials:", error);
    return NextResponse.json({ error: "Failed to fetch trials" }, { status: 500 });
  }
}

export async function DELETE(
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
    const body = await request.json();
    const { trialIds } = body as { trialIds: string[] };

    if (!trialIds || trialIds.length === 0) {
      return NextResponse.json({ error: "No trial IDs provided" }, { status: 400 });
    }

    const updated = await db
      .update(experimentTrials)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(experimentTrials.experimentId, experimentId),
          inArray(experimentTrials.id, trialIds),
          isNull(experimentTrials.deletedAt),
        ),
      )
      .returning({ id: experimentTrials.id });

    return NextResponse.json({ deleted: updated.length });
  } catch (error) {
    console.error("Error deleting trials:", error);
    return NextResponse.json({ error: "Failed to delete trials" }, { status: 500 });
  }
}
