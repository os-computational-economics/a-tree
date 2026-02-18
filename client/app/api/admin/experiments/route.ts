import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experiments, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import type { ExperimentConfig } from "@/lib/experiment/types";

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

    const allExperiments = await db
      .select({
        id: experiments.id,
        name: experiments.name,
        description: experiments.description,
        status: experiments.status,
        config: experiments.config,
        createdBy: experiments.createdBy,
        createdAt: experiments.createdAt,
        updatedAt: experiments.updatedAt,
      })
      .from(experiments)
      .orderBy(desc(experiments.createdAt));

    const list = allExperiments.map((exp) => ({
      id: exp.id,
      name: exp.name,
      description: exp.description,
      status: exp.status,
      blockCount: exp.config.blocks.length,
      paramCount: Object.keys(exp.config.params).length,
      createdBy: exp.createdBy,
      createdAt: exp.createdAt,
      updatedAt: exp.updatedAt,
    }));

    return NextResponse.json({ experiments: list });
  } catch (error) {
    console.error("Error fetching experiments:", error);
    return NextResponse.json({ error: "Failed to fetch experiments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const payload = await verifyAccessToken(accessToken);
    if (!payload || !payload.roles?.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, config } = body as {
      name: string;
      description?: string;
      config: ExperimentConfig;
    };

    if (!name || !config) {
      return NextResponse.json({ error: "Name and config are required" }, { status: 400 });
    }

    const [created] = await db
      .insert(experiments)
      .values({
        name,
        description: description || null,
        config,
        createdBy: payload.userId,
      })
      .returning();

    return NextResponse.json({ experiment: created }, { status: 201 });
  } catch (error) {
    console.error("Error creating experiment:", error);
    return NextResponse.json({ error: "Failed to create experiment" }, { status: 500 });
  }
}
