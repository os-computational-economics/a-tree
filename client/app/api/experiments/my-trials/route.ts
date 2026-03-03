import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experimentTrials, experiments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { ExperimentConfig } from "@/lib/experiment/types";

function getDisplayableParamIds(config: ExperimentConfig): string[] {
  const ids = new Set<string>();
  for (const [id, def] of Object.entries(config.params)) {
    if (def.displayOnStudentSide) ids.add(id);
  }
  for (const block of config.blocks) {
    if (block.type === "static" || block.type === "ai_chat" || !block.params) continue;
    for (const [id, def] of Object.entries(block.params)) {
      if (def.displayOnStudentSide) ids.add(id);
    }
    for (const round of block.rounds) {
      if (!round.params) continue;
      for (const [id, def] of Object.entries(round.params)) {
        if (def.displayOnStudentSide) ids.add(id);
      }
    }
  }
  return Array.from(ids);
}

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

    const rows = await db
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
        experimentConfig: experiments.config,
      })
      .from(experimentTrials)
      .innerJoin(experiments, eq(experimentTrials.experimentId, experiments.id))
      .where(eq(experimentTrials.userId, payload.userId))
      .orderBy(desc(experimentTrials.createdAt));

    const trials = rows.map((row) => ({
      id: row.id,
      trialCode: row.trialCode,
      experimentId: row.experimentId,
      status: row.status,
      historyTable: row.historyTable,
      currentStepIndex: row.currentStepIndex,
      currentTemplateIndex: row.currentTemplateIndex,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      displayableParamIds: getDisplayableParamIds(row.experimentConfig),
    }));

    return NextResponse.json({ trials });
  } catch (error) {
    console.error("Error fetching user trials:", error);
    return NextResponse.json({ error: "Failed to fetch trials" }, { status: 500 });
  }
}
