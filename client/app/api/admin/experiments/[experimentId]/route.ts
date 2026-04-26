import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experiments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { experimentTrials } from "@/lib/db/schema";

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
    const [experiment] = await db
      .select()
      .from(experiments)
      .where(eq(experiments.id, experimentId));

    if (!experiment) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    return NextResponse.json({ experiment });
  } catch (error) {
    console.error("Error fetching experiment:", error);
    return NextResponse.json({ error: "Failed to fetch experiment" }, { status: 500 });
  }
}

export async function PATCH(
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
    const body = await request.json();
    const { name, description, status, config, accessCode } = body;

    const [updated] = await db
      .update(experiments)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(config !== undefined && { config }),
        // Normalize to uppercase, store null when empty string passed
        ...(accessCode !== undefined && {
          accessCode: accessCode ? String(accessCode).toUpperCase().trim() || null : null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(experiments.id, experimentId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    return NextResponse.json({ experiment: updated });
  } catch (error) {
    console.error("Error updating experiment:", error);
    return NextResponse.json({ error: "Failed to update experiment" }, { status: 500 });
  }
}

export async function DELETE(
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
    const [deleted] = await db
      .update(experiments)
      .set({ deletedAt: new Date() })
      .where(eq(experiments.id, experimentId))
      .returning({ id: experiments.id });

    if (!deleted) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting experiment:", error);
    return NextResponse.json({ error: "Failed to delete experiment" }, { status: 500 });
  }
}
