import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experiments } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

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

    const activeExperiments = await db
      .select({
        id: experiments.id,
        name: experiments.name,
        description: experiments.description,
        status: experiments.status,
        config: experiments.config,
        createdAt: experiments.createdAt,
      })
      .from(experiments)
      .where(eq(experiments.status, "active"))
      .orderBy(desc(experiments.createdAt));

    const list = activeExperiments.map((exp) => ({
      id: exp.id,
      name: exp.name,
      description: exp.description,
      status: exp.status,
      blockCount: exp.config.blocks.length,
      paramCount: Object.keys(exp.config.params).length,
      createdAt: exp.createdAt,
    }));

    return NextResponse.json({ experiments: list });
  } catch (error) {
    console.error("Error fetching experiments:", error);
    return NextResponse.json({ error: "Failed to fetch experiments" }, { status: 500 });
  }
}
