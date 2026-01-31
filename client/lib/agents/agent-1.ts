import { Agent, AgentResponse, ParallelAgentResponse } from "./types";
import { Message, MessageContentPart } from "@/lib/llm/types";
import OpenAI from "openai";
import { getSystemPrompt } from "./system-prompts";

// Maximum number of retries for failed operations
const MAX_RETRY = 2;

// Maximum number of user messages to send to AI (excluding the first user message)
const MAX_USER_MESSAGES = 15;

interface PreparedMessages {
  messages: any[];
}

export class Agent1 implements Agent {
  id = "agent-1";
  name = "Creative Assistant";

  async processRequest(
    history: Message[],
    userMessage: Message,
    userId: string,
    isAdmin: boolean,
    requestStartTime?: number,
    precisionEditing?: boolean,
    imageIds?: string[],
    systemPromptOverride?: string
  ): Promise<AgentResponse> {
    const startTime = requestStartTime || Date.now();
    console.log(
      "[Perf] Agent processRequest start",
      `[${Date.now() - startTime}ms]`
    );

    // Step 1: Prepare messages
    const prepared = await this.prepareMessages(
      history,
      userMessage,
      startTime,
      systemPromptOverride
    );

    // Step 2: Call LLM and parse response
    const { stream, completion } = await this.callLLMAndParse(
      prepared,
      startTime,
      isAdmin,
      userId
    );

    return { stream, completion };
  }

  /**
   * Filter conversation history to keep only the first user message, first assistant message,
   * and the last N user messages (and their subsequent messages)
   */
  private filterMessagesByUserCount(history: Message[]): Message[] {
    if (history.length === 0) {
      return history;
    }

    // Find indices of all user messages
    const userMessageIndices: number[] = [];
    for (let i = 0; i < history.length; i++) {
      if (history[i].role === "user") {
        userMessageIndices.push(i);
      }
    }

    // If we have fewer user messages than the limit + 1 (first user), return all
    if (userMessageIndices.length <= MAX_USER_MESSAGES + 1) {
      return history;
    }

    // Find the index of the first user message
    const firstUserIndex = userMessageIndices[0];

    // Find the index of the first assistant message (should be after first user)
    let firstAssistantIndex = -1;
    for (let i = firstUserIndex + 1; i < history.length; i++) {
      if (history[i].role === "assistant") {
        firstAssistantIndex = i;
        break;
      }
    }

    // If no assistant message found after first user, just return all
    if (firstAssistantIndex === -1) {
      return history;
    }

    // Find the index of the Nth user message from the end
    const cutoffUserMessageIndex =
      userMessageIndices[userMessageIndices.length - MAX_USER_MESSAGES];

    // Keep: [0...firstAssistantIndex] + [cutoffUserMessageIndex...end]
    const filteredHistory = [
      ...history.slice(0, firstAssistantIndex + 1),
      ...history.slice(cutoffUserMessageIndex),
    ];

    return filteredHistory;
  }

  private async prepareMessages(
    history: Message[],
    userMessage: Message,
    startTime: number,
    systemPromptOverride?: string
  ): Promise<PreparedMessages> {
    const systemPrompt = systemPromptOverride || getSystemPrompt(this.id);

    // Convert previous messages, filtering out image-related content
    const cleanHistory = history.map((m) => {
      if (Array.isArray(m.content)) {
        return {
          ...m,
          content: m.content
            .filter((p) => p.type === "text" || p.type === "internal_think")
            .map((p) => {
              if (p.type === "internal_think") {
                return { type: "text" as const, text: `(thinking) ${p.text}` };
              }
              return p;
            }),
        };
      }
      return m;
    });

    // Filter history to keep only relevant messages
    const filteredHistory = this.filterMessagesByUserCount(cleanHistory);

    if (cleanHistory.length !== filteredHistory.length) {
      console.log(
        `[Agent-1] Conversation history filtered: ${cleanHistory.length} → ${filteredHistory.length} messages`
      );
    }

    const formattedUserMessage: any = {
      role: userMessage.role,
      content: Array.isArray(userMessage.content)
        ? userMessage.content
            .filter((p) => p.type === "text")
            .map((p) => p)
        : [{ type: "text", text: userMessage.content as string }],
    };

    // Find last think part location in filteredHistory
    let lastThinkMessageIndex = -1;
    let lastThinkPartIndex = -1;

    for (let i = 0; i < filteredHistory.length; i++) {
      const msg = filteredHistory[i];
      if (Array.isArray(msg.content)) {
        for (let j = 0; j < msg.content.length; j++) {
          if (msg.content[j].type === "internal_think") {
            lastThinkMessageIndex = i;
            lastThinkPartIndex = j;
          }
        }
      }
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...filteredHistory.map((m, mIdx) => {
        if (Array.isArray(m.content)) {
          const newContent = m.content
            .map((c, pIdx) => {
              if (c.type === "internal_think") {
                // Only keep the latest think part
                if (
                  mIdx === lastThinkMessageIndex &&
                  pIdx === lastThinkPartIndex
                ) {
                  return {
                    type: "text",
                    text: `(agent thinking process)\n${c.text}`,
                  };
                }
                return null;
              }
              return c;
            })
            .filter((c) => c !== null);

          return {
            role: m.role,
            content: newContent,
          };
        }
        return m;
      }),
      formattedUserMessage,
    ];
    console.log(
      "[Perf] Agent messages prepared",
      `[${Date.now() - startTime}ms]`
    );

    return { messages };
  }

  private async callLLMAndParse(
    prepared: PreparedMessages,
    startTime: number,
    isAdmin: boolean,
    userId: string
  ): Promise<AgentResponse> {
    const encoder = new TextEncoder();
    let resolveCompletion: (value: Message) => void;
    let rejectCompletion: (error: Error) => void;
    const completion = new Promise<Message>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });

    const self = this;

    // Create a wrapper stream that handles retries
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          try {
            // Only stream internal_* to admins
            if (data.type?.startsWith("internal_") && !isAdmin) {
              return;
            }
            controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
          } catch (e) {
            // Controller might be closed
          }
        };

        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
          try {
            if (attempt > 0) {
              console.log(
                `[Agent-1] Retrying LLM call, attempt ${attempt + 1}/${MAX_RETRY + 1}`
              );
              send({ type: "invalidate", reason: "retry" });
            }

            const result = await self.callLLMAndParseCore(
              prepared,
              startTime,
              send,
              userId
            );

            resolveCompletion(result);
            controller.close();
            return;
          } catch (error) {
            lastError = error as Error;
            console.error(
              `[Agent-1] LLM call attempt ${attempt + 1}/${MAX_RETRY + 1} failed:`,
              error
            );
          }
        }

        // All retries exhausted
        console.error(
          `[Agent-1] LLM call failed after ${MAX_RETRY + 1} attempts`
        );

        send({
          type: "retry_exhausted",
          reason: "All retry attempts failed",
          error: lastError?.message || "Unknown error",
        });

        rejectCompletion(lastError || new Error("LLM call failed"));
        try {
          controller.close();
        } catch (e) {}
      },
    });

    return { stream, completion };
  }

  private async callLLMAndParseCore(
    prepared: PreparedMessages,
    startTime: number,
    send: (data: any) => void,
    userId: string
  ): Promise<Message> {
    const client = new OpenAI({
      apiKey: process.env.LLM_API_KEY,
    });

    // Call LLM with stream
    const llmStream = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: prepared.messages as any,
      stream: true,
    });
    console.log(
      "[Perf] Agent LLM stream started",
      `[${Date.now() - startTime}ms]`
    );

    // Track final content for completion
    const finalContent: MessageContentPart[] = [];

    let buffer = "";
    let thoughtSent = false;
    let textSent = false;

    try {
      for await (const chunk of llmStream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        buffer += delta;

        // Parse Thought (if present)
        if (!thoughtSent) {
          const tStart = buffer.indexOf("<think>");
          const tEnd = buffer.indexOf("</think>");

          if (tStart !== -1 && tEnd !== -1) {
            const thoughtText = buffer.substring(tStart + 7, tEnd).trim();
            send({ type: "internal_think", content: thoughtText });
            console.log(
              "[Perf] Agent thought sent",
              `[${Date.now() - startTime}ms]`
            );
            finalContent.push({ type: "internal_think", text: thoughtText });
            thoughtSent = true;
            buffer = buffer.substring(tEnd + 8);
          }
        }

        // Parse Text response
        if (!textSent) {
          const qStart = buffer.indexOf("<TEXT>");
          const qEnd = buffer.indexOf("</TEXT>");

          if (qStart !== -1 && qEnd !== -1) {
            const responseText = buffer.substring(qStart + 6, qEnd).trim();
            send({ type: "text", content: responseText });
            console.log(
              "[Perf] Agent response sent",
              `[${Date.now() - startTime}ms]`
            );
            finalContent.push({ type: "text", text: responseText });
            textSent = true;
            buffer = buffer.substring(qEnd + 7);
          }
        }
      }

      // If no structured response found, use the raw buffer
      if (finalContent.length === 0) {
        const text = buffer.replace(/<[^>]*>/g, "").trim();
        if (text) {
          send({ type: "text", content: text });
          finalContent.push({ type: "text", text });
        }
      }

      return {
        role: "assistant",
        content: finalContent,
        agentId: "agent-1",
      };
    } catch (err) {
      console.error("Stream processing error", err);
      throw err;
    }
  }

  /**
   * Process request with parallel variants
   */
  async processRequestParallel(
    history: Message[],
    userMessage: Message,
    userId: string,
    isAdmin: boolean,
    variantCount: number,
    requestStartTime?: number,
    precisionEditing?: boolean,
    imageIds?: string[],
    systemPromptOverride?: string
  ): Promise<ParallelAgentResponse> {
    const startTime = requestStartTime || Date.now();
    console.log(
      "[Perf] Agent processRequestParallel start with %s variants [%sms]",
      variantCount,
      Date.now() - startTime
    );

    // Prepare messages once (shared across all variants)
    const prepared = await this.prepareMessages(
      history,
      userMessage,
      startTime,
      systemPromptOverride
    );

    const encoder = new TextEncoder();
    const self = this;

    // Generate unique variant IDs
    const variantIds = Array.from(
      { length: variantCount },
      (_, i) =>
        `variant-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );

    // Track completion for each variant
    const completionPromises: Promise<Message>[] = [];
    const variantControllers: {
      controller: ReadableStreamDefaultController<Uint8Array> | null;
      done: boolean;
    }[] = variantIds.map(() => ({ controller: null, done: false }));

    // Create merged stream
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Start all parallel variant processing
        variantIds.forEach((variantId, variantIndex) => {
          const completionPromise = (async () => {
            const send = (data: any) => {
              try {
                if (data.type?.startsWith("internal_") && !isAdmin) {
                  return;
                }
                const eventWithVariant = { ...data, variantId };
                controller.enqueue(
                  encoder.encode(JSON.stringify(eventWithVariant) + "\n")
                );
              } catch (e) {
                // Controller might be closed
              }
            };

            let lastError: Error | undefined;

            for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
              try {
                if (attempt > 0) {
                  console.log(
                    `[Agent-1] Retrying LLM call for variant ${variantId}, attempt ${attempt + 1}/${MAX_RETRY + 1}`
                  );
                  send({ type: "invalidate", reason: "retry" });
                }

                const result = await self.callLLMAndParseCore(
                  prepared,
                  startTime,
                  send,
                  userId
                );

                const messageWithVariant: Message = {
                  ...result,
                  variantId,
                };

                variantControllers[variantIndex].done = true;

                if (variantControllers.every((v) => v.done)) {
                  try {
                    controller.close();
                  } catch (e) {}
                }

                return messageWithVariant;
              } catch (error) {
                lastError = error as Error;
                console.error(
                  `[Agent-1] Variant ${variantId} attempt ${attempt + 1} failed:`,
                  error
                );
              }
            }

            // All retries exhausted for this variant
            send({
              type: "variant_failed",
              reason: "All retry attempts failed",
              error: lastError?.message || "Unknown error",
            });

            variantControllers[variantIndex].done = true;

            if (variantControllers.every((v) => v.done)) {
              try {
                controller.close();
              } catch (e) {}
            }

            const errorMessage: Message = {
              role: "assistant",
              content: [{ type: "text", text: "Failed to generate response" }],
              agentId: self.id,
              variantId,
            };

            return errorMessage;
          })();

          completionPromises.push(completionPromise);
        });
      },
    });

    const completions = Promise.all(completionPromises);

    return { stream, completions };
  }
}

export const agent1 = new Agent1();
