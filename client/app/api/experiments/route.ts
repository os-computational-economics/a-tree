import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experiments, experimentAccess } from "@/lib/db/schema";
import { desc, eq, and, isNull } from "drizzle-orm";

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

    const isAdmin = payload.roles?.includes("admin");

    // Admins see all active experiments regardless of access code.
    if (isAdmin) {
      const allRows = await db
        .select({
          id: experiments.id,
          name: experiments.name,
          description: experiments.description,
          status: experiments.status,
          config: experiments.config,
          createdAt: experiments.createdAt,
        })
        .from(experiments)
        .where(and(eq(experiments.status, "active"), isNull(experiments.deletedAt)))
        .orderBy(desc(experiments.createdAt));

      const list = allRows.map((exp) => ({
        id: exp.id,
        name: exp.name,
        description: exp.description,
        blockCount: exp.config.blocks.length,
        paramCount: Object.keys(exp.config.params).length,
        createdAt: exp.createdAt,
      }));

      return NextResponse.json({ experiments: list });
    }

    // Students: LEFT JOIN experiment_access for this user so we can tell
    // whether the user has been granted access to each experiment.
    const rows = await db
      .select({
        id: experiments.id,
        name: experiments.name,
        description: experiments.description,
        status: experiments.status,
        config: experiments.config,
        accessCode: experiments.accessCode,
        accessGrantedId: experimentAccess.id,
        createdAt: experiments.createdAt,
      })
      .from(experiments)
      .leftJoin(
        experimentAccess,
        and(
          eq(experimentAccess.experimentId, experiments.id),
          eq(experimentAccess.userId, payload.userId),
        ),
      )
      .where(
        and(
          eq(experiments.status, "active"),
          isNull(experiments.deletedAt),
        ),
      )
      .orderBy(desc(experiments.createdAt));

    // Show experiment if:
    //   (a) no access code set → open to everyone
    //   (b) user has an experiment_access row → explicitly granted
    const accessible = rows.filter(
      (row) => row.accessCode === null || row.accessGrantedId !== null,
    );

    const list = accessible.map((exp) => ({
      id: exp.id,
      name: exp.name,
      description: exp.description,
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
