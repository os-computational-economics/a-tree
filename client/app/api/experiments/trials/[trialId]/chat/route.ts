import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { experimentTrials, experiments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { agent1 } from "@/lib/agents/agent-1";
import { Message } from "@/lib/llm/types";
import type { ChatLogEntry } from "@/lib/experiment/types";
import { waitUntil } from "@vercel/functions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ trialId: string }> },
) {
  const requestStartTime = Date.now();
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
    const { blockId, message, chatHistory } = body as {
      blockId: string;
      message: string;
      chatHistory: ChatLogEntry[];
    };

    if (!blockId || !message) {
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

    // Render the system prompt template by replacing {{param}} placeholders
    // with resolved values from the current trial's history table
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

    // Build the full system prompt: agent format instructions + experiment context
    const systemPrompt =
      `You are a helpful AI assistant within an experiment.\n\n` +
      `--- Experiment Context ---\n${renderedPrompt}\n--- End Context ---\n\n` +
      `Thinking Process:\n` +
      `Before responding, you MUST provide a thinking block wrapped in <think>...</think> tags. This block should contain:\n` +
      `1. Your analysis of what the user is asking\n` +
      `2. Key points to address in your response\n` +
      `3. Any relevant context or considerations\n\n` +
      `Response Generation:\n` +
      `After the thinking process, generate your response wrapped in <TEXT>...</TEXT> tags.\n\n` +
      `Output Format:\n` +
      `1. Start with <think>...</think> containing your internal analysis.\n` +
      `2. Wrap your response in <TEXT>...</TEXT> tags.\n` +
      `3. Do NOT output markdown code blocks around the tags. Just the raw tags.`;

    // Convert chatHistory into Message[] for the agent
    const history: Message[] = (chatHistory || []).map((entry: ChatLogEntry) => ({
      role: entry.role as "user" | "assistant",
      content: entry.content,
      createdAt: entry.timestamp,
    }));

    const userMessage: Message = {
      role: "user",
      content: message,
      createdAt: Date.now(),
    };

    const isAdmin = payload.roles?.includes("admin") ?? false;

    const { stream: agentStream, completion } = await agent1.processRequest(
      history,
      userMessage,
      payload.userId,
      isAdmin,
      requestStartTime,
      false,
      [],
      systemPrompt,
    );

    // Save chat logs in the background after the response completes
    waitUntil(
      completion
        .then(async (assistantMessage) => {
          let assistantText = "";
          if (typeof assistantMessage.content === "string") {
            assistantText = assistantMessage.content;
          } else if (Array.isArray(assistantMessage.content)) {
            assistantText = assistantMessage.content
              .filter((p) => p.type === "text")
              .map((p) => p.text)
              .join("\n");
          }

          const newEntry: ChatLogEntry = {
            role: "assistant",
            content: assistantText,
            timestamp: Date.now(),
          };

          const userEntry: ChatLogEntry = {
            role: "user",
            content: message,
            timestamp: userMessage.createdAt!,
          };

          const existingLogs = (trial.chatLogs as Record<string, ChatLogEntry[]>) || {};
          const blockLogs = existingLogs[blockId] || [];
          const updatedLogs = {
            ...existingLogs,
            [blockId]: [...blockLogs, userEntry, newEntry],
          };

          await db
            .update(experimentTrials)
            .set({ chatLogs: updatedLogs, updatedAt: new Date() })
            .where(eq(experimentTrials.id, trialId));
        })
        .catch((err) => {
          console.error("Failed to save experiment chat log:", err);
        }),
    );

    return new NextResponse(agentStream, {
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
