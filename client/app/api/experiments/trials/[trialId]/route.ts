import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experimentTrials, experiments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trialId: string }> },
) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const payload = await verifyAccessToken(accessToken);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { trialId } = await params;

    const [trial] = await db
      .select()
      .from(experimentTrials)
      .where(
        and(
          eq(experimentTrials.id, trialId),
          eq(experimentTrials.userId, payload.userId),
        ),
      )
      .limit(1);

    if (!trial) {
      return NextResponse.json({ error: "Trial not found" }, { status: 404 });
    }

    const [experiment] = await db
      .select()
      .from(experiments)
      .where(eq(experiments.id, trial.experimentId))
      .limit(1);

    if (!experiment) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    return NextResponse.json({
      trial: {
        id: trial.id,
        trialCode: trial.trialCode,
        experimentId: trial.experimentId,
        status: trial.status,
        historyTable: trial.historyTable,
        currentStepIndex: trial.currentStepIndex,
        currentTemplateIndex: trial.currentTemplateIndex,
        createdAt: trial.createdAt,
        updatedAt: trial.updatedAt,
      },
      experiment: {
        id: experiment.id,
        name: experiment.name,
        description: experiment.description,
        config: experiment.config,
      },
    });
  } catch (error) {
    console.error("Error fetching trial:", error);
    return NextResponse.json({ error: "Failed to fetch trial" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ trialId: string }> },
) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const payload = await verifyAccessToken(accessToken);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { trialId } = await params;

    const [existing] = await db
      .select({ id: experimentTrials.id, userId: experimentTrials.userId })
      .from(experimentTrials)
      .where(eq(experimentTrials.id, trialId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Trial not found" }, { status: 404 });
    }
    if (existing.userId !== payload.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { historyTable, currentStepIndex, currentTemplateIndex, status } = body;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (historyTable !== undefined) updates.historyTable = historyTable;
    if (currentStepIndex !== undefined) updates.currentStepIndex = currentStepIndex;
    if (currentTemplateIndex !== undefined) updates.currentTemplateIndex = currentTemplateIndex;
    if (status !== undefined) updates.status = status;

    const [updated] = await db
      .update(experimentTrials)
      .set(updates)
      .where(eq(experimentTrials.id, trialId))
      .returning();

    return NextResponse.json({ trial: updated });
  } catch (error) {
    console.error("Error updating trial:", error);
    return NextResponse.json({ error: "Failed to update trial" }, { status: 500 });
  }
}
