import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experimentTrials } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const payload = await verifyAccessToken(accessToken);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const trials = await db
      .select({
        id: experimentTrials.id,
        trialCode: experimentTrials.trialCode,
        experimentId: experimentTrials.experimentId,
        status: experimentTrials.status,
        historyTable: experimentTrials.historyTable,
        currentStepIndex: experimentTrials.currentStepIndex,
        currentTemplateIndex: experimentTrials.currentTemplateIndex,
        createdAt: experimentTrials.createdAt,
        updatedAt: experimentTrials.updatedAt,
      })
      .from(experimentTrials)
      .where(eq(experimentTrials.userId, payload.userId))
      .orderBy(desc(experimentTrials.createdAt));

    return NextResponse.json({ trials });
  } catch (error) {
    console.error("Error fetching user trials:", error);
    return NextResponse.json({ error: "Failed to fetch trials" }, { status: 500 });
  }
}
