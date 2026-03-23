import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experimentTrials, experiments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { saveExperimentAudio, getExperimentAudio } from "@/lib/storage/s3";
import type { ChatLogEntry } from "@/lib/experiment/types";
import { waitUntil } from "@vercel/functions";

const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ trialId: string }> },
) {
  try {
    const { trialId } = await params;

    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const payload = await verifyAccessToken(accessToken);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

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

    const body = await request.json();
    const { blockId, timestamp, text } = body as {
      blockId: string;
      timestamp: number;
      text: string;
    };

    if (!blockId || !timestamp || !text) {
      return NextResponse.json(
        { error: "blockId, timestamp, and text are required" },
        { status: 400 },
      );
    }

    // Cache-first: check S3 for existing audio
    const cacheStart = Date.now();
    const cached = await getExperimentAudio(trialId, blockId, timestamp);
    if (cached) {
      console.log(`[TTS] Cache HIT for ${blockId}/${timestamp} (${Date.now() - cacheStart}ms, ${cached.length} bytes)`);
      return new NextResponse(new Uint8Array(cached), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "private, max-age=86400",
        },
      });
    }
    console.log(`[TTS] Cache MISS for ${blockId}/${timestamp} — calling OpenAI TTS...`);

    // Cache miss: verify the block exists and has voice mode
    const [experiment] = await db
      .select()
      .from(experiments)
      .where(eq(experiments.id, trial.experimentId))
      .limit(1);

    if (!experiment) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    const block = experiment.config.blocks.find((b) => b.id === blockId);
    if (!block || block.type !== "ai_chat") {
      return NextResponse.json(
        { error: "AI Chat block not found" },
        { status: 404 },
      );
    }

    if (block.responseMode !== "voice") {
      return NextResponse.json(
        { error: "Block is not configured for voice response" },
        { status: 400 },
      );
    }

    // Generate TTS audio
    const ttsStart = Date.now();
    const mp3 = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: block.ttsVoice || "coral",
      input: text,
      ...(block.ttsInstructions ? { instructions: block.ttsInstructions } : {}),
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    console.log(`[TTS] OpenAI TTS done in ${Date.now() - ttsStart}ms (${buffer.length} bytes) — saving to S3...`);

    // Save to S3 and update chatLogs in background
    const audioKey = await saveExperimentAudio(trialId, blockId, timestamp, buffer);

    waitUntil(
      (async () => {
        try {
          const existingLogs = (trial.chatLogs as Record<string, ChatLogEntry[]>) || {};
          const blockLogs = existingLogs[blockId] || [];
          const updatedBlockLogs = blockLogs.map((entry) =>
            entry.role === "assistant" && entry.timestamp === timestamp
              ? { ...entry, audioKey }
              : entry,
          );
          const updatedLogs = { ...existingLogs, [blockId]: updatedBlockLogs };

          await db
            .update(experimentTrials)
            .set({ chatLogs: updatedLogs, updatedAt: new Date() })
            .where(eq(experimentTrials.id, trialId));
        } catch (err) {
          console.error("Failed to update audioKey in chat logs:", err);
        }
      })(),
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Error in TTS generation:", error);
    return NextResponse.json(
      { error: "Failed to generate audio" },
      { status: 500 },
    );
  }
}
