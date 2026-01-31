import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getChatHistory, saveChatHistory } from "@/lib/storage/s3";
import { createLLMClient } from "@/lib/llm/client";
import {
  Message,
  PARALLEL_VARIANT_COUNT,
} from "@/lib/llm/types";
import { agent1 } from "@/lib/agents/agent-1";
import { waitUntil } from "@vercel/functions";
import { recordEvent } from "@/lib/telemetry";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const requestStartTime = Date.now();
  console.log("[Perf] Request received", "[0ms]");
  try {
    const { chatId } = await params;
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const payload = await verifyAccessToken(accessToken);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      undefined;

    // Parse JSON request
    const json = await request.json();
    const content: string = json.content || "";
    const systemPromptOverride: string | undefined = json.systemPromptOverride;

    // Validate: must have content
    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Record user sent message event
    await recordEvent(
      "user_sent_message",
      payload.userId,
      {
        chatId,
        content,
        systemPromptOverride,
      },
      ipAddress
    );

    // Verify ownership or admin status
    const isAdmin = payload.roles?.includes("admin");
    let chat;

    if (isAdmin) {
      [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
    } else {
      [chat] = await db
        .select()
        .from(chats)
        .where(and(eq(chats.id, chatId), eq(chats.userId, payload.userId)));
    }
    console.log(
      "[Perf] Ownership verified",
      `[${Date.now() - requestStartTime}ms]`
    );

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Get existing history
    const history = await getChatHistory(chatId);
    console.log(
      "[Perf] Chat history Got",
      `[${Date.now() - requestStartTime}ms]`
    );

    // Construct new user message
    const userMessage: Message = { 
      role: "user", 
      content, 
      createdAt: Date.now() 
    };

    console.log("[Perf] Calling agent", `[${Date.now() - requestStartTime}ms]`);

    // Use Agent 1 with parallel variants
    const { stream: agentStream, completions } =
      await agent1.processRequestParallel(
        history,
        userMessage,
        payload.userId,
        isAdmin ?? false,
        PARALLEL_VARIANT_COUNT,
        requestStartTime,
        false, // precisionEditing
        [], // imageIds
        isAdmin ? systemPromptOverride : undefined
      );

    // Handle background completion (saving history)
    waitUntil(
      completions
        .then(async (finalMessages) => {
          const timestamp = Date.now();
          const messagesToSave: Message[] = finalMessages.map((msg, idx) => ({
            ...msg,
            createdAt: msg.createdAt || timestamp,
          }));

          const updatedHistory = [
            ...history,
            userMessage,
            ...messagesToSave,
          ];
          await saveChatHistory(chatId, updatedHistory);

          // Use the first variant for name generation
          const primaryMessage = messagesToSave[0];

          // Generate chat name if needed (check for 1 user message + N variants)
          const isFirstInteraction =
            history.length === 0 &&
            updatedHistory.length === 1 + PARALLEL_VARIANT_COUNT;
          if (isFirstInteraction) {
            const llmClient = createLLMClient({
              apiKey: process.env.LLM_API_KEY,
              provider: "openai",
              model: "gpt-4.1",
            });

            try {
              const messagesForNaming = [userMessage, primaryMessage];
              const namePrompt: Message[] = [
                {
                  role: "system",
                  content:
                    "You are a helpful assistant that generates concise names for chat sessions. " +
                    "Based on the first two messages of a conversation, generate a short, descriptive name. " +
                    "The name MUST be very concise and no longer than 50 characters. " +
                    "Give the name in the same language as the messages. " +
                    'Output JSON only. Format: {"chat_name": "Your Chat Name"}',
                },
                ...messagesForNaming.map((msg) => {
                  if (typeof msg.content === "string") {
                    return msg;
                  }
                  const textContent = msg.content
                    .filter((c) => c.type === "text")
                    .map((c) => (c as { type: "text"; text: string }).text)
                    .join("\n");

                  return {
                    role: msg.role,
                    content: textContent,
                  };
                }),
              ];

              const nameResponse = await llmClient.chatComplete(namePrompt);
              let newChatName = chat.name;

              if (nameResponse) {
                try {
                  const cleanResponse = nameResponse
                    .replace(/```json\n?|```/g, "")
                    .trim();
                  const parsed = JSON.parse(cleanResponse);
                  if (parsed && parsed.chat_name) {
                    newChatName = parsed.chat_name.trim().slice(0, 255);
                  }
                } catch (e) {
                  if (
                    nameResponse.length < 255 &&
                    !nameResponse.includes("{")
                  ) {
                    newChatName = nameResponse.trim();
                  }
                }
              }

              await db
                .update(chats)
                .set({
                  updatedAt: new Date(),
                  name: newChatName,
                })
                .where(eq(chats.id, chatId));
            } catch (err) {
              console.error("Failed to generate chat name:", err);
            }
          } else {
            await db
              .update(chats)
              .set({
                updatedAt: new Date(),
              })
              .where(eq(chats.id, chatId));
          }
        })
        .catch((err) => {
          console.error("Agent completion failed:", err);
        })
    );

    return new NextResponse(agentStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
