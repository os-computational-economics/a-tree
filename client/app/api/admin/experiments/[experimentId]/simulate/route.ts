import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experiments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveFullRun } from "@/lib/experiment/params";
import { resolveTemplates, renderTemplate } from "@/lib/experiment/template";
import { TEMPLATE_KINDS } from "@/lib/experiment/types";

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
    const [experiment] = await db
      .select()
      .from(experiments)
      .where(eq(experiments.id, experimentId));

    if (!experiment) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    const config = experiment.config;
    const runResults = resolveFullRun(config);

    const simulation = runResults.map((entry) => {
      const templates = resolveTemplates(config, entry.blockIndex, entry.roundIndex);

      const segmentsByTemplate: Record<string, ReturnType<typeof renderTemplate>> = {};
      for (const kind of TEMPLATE_KINDS) {
        const field = `${kind}Template` as keyof typeof templates;
        segmentsByTemplate[kind] = renderTemplate(templates[field], entry.params);
      }

      return {
        blockIndex: entry.blockIndex,
        roundIndex: entry.roundIndex,
        blockId: entry.blockId,
        roundId: entry.roundId,
        blockLabel: config.blocks[entry.blockIndex]?.label,
        params: entry.params,
        templates,
        segmentsByTemplate,
      };
    });

    return NextResponse.json({ simulation });
  } catch (error) {
    console.error("Error simulating experiment:", error);
    const message = error instanceof Error ? error.message : "Failed to simulate experiment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
