import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experiments, experimentTrials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function generateTrialCode(): string {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
}

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
    const { experimentId } = body as { experimentId: string };

    if (!experimentId) {
      return NextResponse.json({ error: "experimentId is required" }, { status: 400 });
    }

    const [experiment] = await db
      .select({ id: experiments.id, status: experiments.status })
      .from(experiments)
      .where(eq(experiments.id, experimentId))
      .limit(1);

    if (!experiment) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }
    if (experiment.status !== "active") {
      return NextResponse.json({ error: "Experiment is not active" }, { status: 400 });
    }

    let trialCode: string;
    let attempts = 0;
    const maxAttempts = 20;

    while (true) {
      trialCode = generateTrialCode();
      const [existing] = await db
        .select({ id: experimentTrials.id })
        .from(experimentTrials)
        .where(eq(experimentTrials.trialCode, trialCode))
        .limit(1);

      if (!existing) break;

      attempts++;
      if (attempts >= maxAttempts) {
        return NextResponse.json({ error: "Failed to generate unique trial code" }, { status: 500 });
      }
    }

    const [trial] = await db
      .insert(experimentTrials)
      .values({
        trialCode,
        experimentId,
        userId: payload.userId,
      })
      .returning();

    return NextResponse.json({ trialId: trial.id, trialCode: trial.trialCode }, { status: 201 });
  } catch (error) {
    console.error("Error joining experiment:", error);
    return NextResponse.json({ error: "Failed to join experiment" }, { status: 500 });
  }
}
