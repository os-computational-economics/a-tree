import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experimentTrials, experiments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

    const [experiment] = await db
      .select()
      .from(experiments)
      .where(eq(experiments.id, trial.experimentId))
      .limit(1);

    if (!experiment) {
      return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
    }

    const body = await request.json();
    const { blockId, message, chatHistory, aiInitiate } = body as {
      blockId: string;
      message: string;
      chatHistory: ChatLogEntry[];
      aiInitiate?: boolean;
    };

    if (!blockId || (!message && !aiInitiate)) {
      return NextResponse.json(
        { error: "blockId and message are required" },
        { status: 400 },
      );
    }

    const block = experiment.config.blocks.find((b) => b.id === blockId);
    if (!block || block.type !== "ai_chat") {
      return NextResponse.json(
        { error: "AI Chat block not found" },
        { status: 404 },
      );
    }

    let renderedPrompt = block.systemPromptTemplate;
    const allValues: Record<string, string | number | boolean> = {};
    if (trial.historyTable && Array.isArray(trial.historyTable)) {
      for (const row of trial.historyTable) {
        for (const [k, v] of Object.entries(row.values)) {
          if (v != null) allValues[k] = v;
        }
      }
    }
    renderedPrompt = renderedPrompt.replace(
      /\{\{(\w+)\}\}/g,
      (match, paramId) => {
        return allValues[paramId] != null ? String(allValues[paramId]) : match;
      },
    );

    const surveyAnswerMap: Record<string, string> = {};
    const aiChatBlockIndex = experiment.config.blocks.findIndex((b) => b.id === blockId);
    for (let i = 0; i < aiChatBlockIndex; i++) {
      const b = experiment.config.blocks[i];
      if (b.type === "survey") {
        const blockResponses = (trial.surveyResponses as Record<string, Record<string, string>>)?.[b.id] || {};
        for (const q of b.questions) {
          surveyAnswerMap[q.id] = blockResponses[q.id]?.trim() || "[No response provided]";
        }
      }
    }
    renderedPrompt = renderedPrompt.replace(
      /\{\{survey:(\w+)\}\}/g,
      (match, qId) => surveyAnswerMap[qId] ?? match,
    );

    const systemPrompt =
      `You are a helpful AI assistant within an experiment.\n\n` +
      `--- Experiment Context ---\n${renderedPrompt}\n--- End Context ---`;

    const llmMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const entry of chatHistory || []) {
      llmMessages.push({
        role: entry.role as "user" | "assistant",
        content: entry.content,
      });
    }

    if (!aiInitiate) {
      llmMessages.push({ role: "user", content: message });
    } else {
      llmMessages.push({ role: "user", content: "Start the conversation." });
    }

    const serverTimestamp = Date.now();

    const llmStream = await openai.chat.completions.create({
      model: "gpt-5.4",
      messages: llmMessages,
      stream: true,
    });

    const encoder = new TextEncoder();
    let fullText = "";
    let streamResolve: () => void;
    const streamDone = new Promise<void>((r) => { streamResolve = r; });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of llmStream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
              fullText += delta;
              controller.enqueue(
                encoder.encode(JSON.stringify({ type: "text", content: fullText }) + "\n"),
              );
            }
          }
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "assistant_timestamp", timestamp: serverTimestamp }) + "\n"),
          );
        } catch (err) {
          console.error("LLM stream error:", err);
        } finally {
          streamResolve();
          controller.close();
        }
      },
    });

    waitUntil(
      streamDone.then(async () => {
        try {
          const newEntry: ChatLogEntry = {
            role: "assistant",
            content: fullText,
            timestamp: serverTimestamp,
          };

          const userEntry: ChatLogEntry = {
            role: "user",
            content: message,
            timestamp: Date.now(),
          };

          const existingLogs = (trial.chatLogs as Record<string, ChatLogEntry[]>) || {};
          const blockLogs = existingLogs[blockId] || [];
          const newEntries = aiInitiate ? [newEntry] : [userEntry, newEntry];
          const updatedLogs = {
            ...existingLogs,
            [blockId]: [...blockLogs, ...newEntries],
          };

          await db
            .update(experimentTrials)
            .set({ chatLogs: updatedLogs, updatedAt: new Date() })
            .where(eq(experimentTrials.id, trialId));
        } catch (err) {
          console.error("Failed to save experiment chat log:", err);
        }
      }),
    );

    return new NextResponse(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Error in experiment chat:", error);
    return NextResponse.json(
      { error: "Failed to process chat" },
      { status: 500 },
    );
  }
}
