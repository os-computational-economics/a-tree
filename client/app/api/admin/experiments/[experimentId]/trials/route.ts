import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experimentTrials } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

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
        createdAt: experimentTrials.createdAt,
        updatedAt: experimentTrials.updatedAt,
      })
      .from(experimentTrials)
      .where(eq(experimentTrials.experimentId, experimentId))
      .orderBy(desc(experimentTrials.createdAt));

    return NextResponse.json({ trials });
  } catch (error) {
    console.error("Error fetching trials:", error);
    return NextResponse.json({ error: "Failed to fetch trials" }, { status: 500 });
  }
}
