import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experimentTrials, experiments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const payload = await verifyAccessToken(accessToken);
    if (!payload || !payload.roles?.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const code = request.nextUrl.searchParams.get("code");
    if (!code || code.length !== 6) {
      return NextResponse.json({ error: "A valid 6-digit code is required" }, { status: 400 });
    }

    const [trial] = await db
      .select({
        id: experimentTrials.id,
        trialCode: experimentTrials.trialCode,
        experimentId: experimentTrials.experimentId,
        status: experimentTrials.status,
        historyTable: experimentTrials.historyTable,
        createdAt: experimentTrials.createdAt,
        updatedAt: experimentTrials.updatedAt,
      })
      .from(experimentTrials)
      .where(eq(experimentTrials.trialCode, code))
      .limit(1);

    if (!trial) {
      return NextResponse.json({ error: "Trial not found" }, { status: 404 });
    }

    const [experiment] = await db
      .select({
        id: experiments.id,
        name: experiments.name,
        description: experiments.description,
      })
      .from(experiments)
      .where(eq(experiments.id, trial.experimentId))
      .limit(1);

    return NextResponse.json({
      trial,
      experiment: experiment || null,
    });
  } catch (error) {
    console.error("Error looking up trial:", error);
    return NextResponse.json({ error: "Failed to look up trial" }, { status: 500 });
  }
}
