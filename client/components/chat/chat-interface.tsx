"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@heroui/spinner";
import { Card, CardBody } from "@heroui/card";
import { addToast } from "@heroui/toast";
import { Bot } from "lucide-react";
import { useRouter } from "next/navigation";
import { useChat } from "@/hooks/use-chat";
import {
  NotificationPermissionModal,
  NotificationPermissionModalRef,
} from "@/components/notification-permission-modal";
import {
  Message,
  MessageContentPart,
} from "@/lib/llm/types";
import ChatMessage from "./chat-message";
import ChatInput from "./chat-input";
import { siteConfig } from "@/config/site";
import { useVoiceRecorder } from "./use-voice-recorder";
const SYSTEM_PROMPT_STORAGE_KEY = "system_prompt_override";

interface ChatInterfaceProps {
  chatId?: string;
  initialMessages?: Message[];
}

export default function ChatInterface({
  chatId: initialChatId,
  initialMessages = [],
}: ChatInterfaceProps) {
  const t = useTranslations();
  const { user } = useAuth();
  const { monitorChat, cancelMonitorChat } = useChat();
  const router = useRouter();
  const [chatId, setChatId] = useState<string | undefined>(initialChatId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(
    !!initialChatId && initialMessages.length === 0
  );
  const [isSending, setIsSending] = useState(false);

  // Listen for reset-chat event (triggered when clicking New Chat button while technically already on /chat)
  useEffect(() => {
    const handleReset = () => {
      setChatId(undefined);
      setMessages([]);
      setInput("");
      setIsSending(false);

      // Ensure we clean up any draft that might be lingering
      localStorage.removeItem(`${siteConfig.chatInputPrefix}new-chat`);
    };

    window.addEventListener("reset-chat", handleReset);
    return () => window.removeEventListener("reset-chat", handleReset);
  }, []);

  // Draft saving logic
  const [prevChatId, setPrevChatId] = useState(chatId);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  if (chatId !== prevChatId) {
    setPrevChatId(chatId);
    setIsDraftLoaded(false);
  }

  useEffect(() => {
    const key = `${siteConfig.chatInputPrefix}${chatId || "new-chat"}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      setInput(saved);
    } else {
      setInput("");
    }
    setIsDraftLoaded(true);
  }, [chatId]);

  useEffect(() => {
    if (isDraftLoaded) {
      const key = `${siteConfig.chatInputPrefix}${chatId || "new-chat"}`;
      if (input) {
        localStorage.setItem(key, input);
      } else {
        localStorage.removeItem(key);
      }
    }
  }, [input, chatId, isDraftLoaded]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const notificationModalRef = useRef<NotificationPermissionModalRef>(null);
  const lastUserInputRef = useRef<string>("");

  // Voice recorder hook
  const handleTranscriptionComplete = useCallback((text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
  }, []);

  const {
    isRecording,
    isTranscribing,
    recordingTime,
    startRecording,
    stopRecording,
  } = useVoiceRecorder({
    onTranscriptionComplete: handleTranscriptionComplete,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchChat = async () => {
      if (!chatId) return;
      if (messages.length > 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(`/api/chat/${chatId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages);
        }
      } catch (error) {
        console.error("Failed to fetch chat", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user && chatId) {
      fetchChat();
    } else {
      setIsLoading(false);
    }
  }, [chatId, user]);

  const handleSend = async () => {
    if (
      !input.trim() ||
      isSending ||
      isRecording ||
      isTranscribing
    )
      return;

    const currentInput = input;

    // Save the original input for potential retry exhausted scenario
    lastUserInputRef.current = input;

    const userMessage: Message = {
      role: "user",
      content: currentInput,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Clear input
    setInput("");

    setIsSending(true);

    try {
      // Check for notification permission when user sends a message
      notificationModalRef.current?.checkPermission();

      let currentChatId = chatId;

      if (!currentChatId) {
        const createRes = await fetch("/api/chat", { method: "POST" });
        if (!createRes.ok) throw new Error("Failed to create chat");
        const createData = await createRes.json();
        currentChatId = createData.chat.id;
        setChatId(currentChatId);
        window.history.replaceState(null, "", `/chat/${currentChatId}`);
        window.dispatchEvent(new Event("refresh-chats"));
      }

      // Start monitoring for background completion (in case user leaves)
      if (currentChatId) {
        monitorChat(currentChatId, messages.length + 1);
      }

      // Build the JSON payload
      const payload: any = {
        content: currentInput,
      };

      // Check for system prompt override
      const overrideEnabled =
        localStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY + "_enabled") === "true";
      if (overrideEnabled) {
        const overridePrompt = localStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY);
        if (overridePrompt) {
          payload.systemPromptOverride = overridePrompt;
        }
      }

      const res = await fetch(`/api/chat/${currentChatId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to send message");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let isFirstChunk = true;

      const contentParts: MessageContentPart[] = [];
      const assistantTimestamp = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === "invalidate") {
              contentParts.length = 0;
              isFirstChunk = true;

              const cuteMessages = [
                t("chat.retryMessages.rethink"),
                t("chat.retryMessages.rephrase"),
                t("chat.retryMessages.organizing"),
                t("chat.retryMessages.better"),
                t("chat.retryMessages.sparkle"),
              ];
              const randomMessage =
                cuteMessages[Math.floor(Math.random() * cuteMessages.length)];

              addToast({
                title: randomMessage,
                color: "primary",
              });

              setMessages((prev) => {
                const newMessages = [...prev];
                for (let i = newMessages.length - 1; i >= 0; i--) {
                  if (newMessages[i].role === "assistant" && newMessages[i].createdAt === assistantTimestamp) {
                    newMessages[i] = { ...newMessages[i], content: [] };
                    break;
                  }
                }
                return newMessages;
              });
              continue;
            }

            if (event.type === "retry_exhausted") {
              console.log(`[Chat] All retries failed: ${event.reason}`);

              if (currentChatId) {
                cancelMonitorChat(currentChatId);
              }

              const cuteErrorMessages = [
                t("chat.errorMessages.overwhelmed"),
                t("chat.errorMessages.coffeeBreak"),
                t("chat.errorMessages.tripped"),
              ];
              const randomErrorMessage =
                cuteErrorMessages[
                  Math.floor(Math.random() * cuteErrorMessages.length)
                ];

              addToast({
                title: randomErrorMessage,
                color: "danger",
              });

              setInput(lastUserInputRef.current);

              setMessages((prev) =>
                prev.filter(
                  (msg) =>
                    !(msg.role === "assistant" && msg.createdAt === assistantTimestamp) &&
                    !(msg.role === "user" && msg === userMessage)
                )
              );
              continue;
            }

            // Initialize assistant message on first content chunk
            if (isFirstChunk) {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: [],
                  createdAt: assistantTimestamp,
                },
              ]);
              isFirstChunk = false;
            }

            if (event.type === "internal_think") {
              contentParts.push({
                type: "internal_think",
                text: event.content,
              });
            } else if (event.type === "text") {
              if (
                contentParts.length === 0 ||
                contentParts[0].type !== "text"
              ) {
                contentParts.unshift({ type: "text", text: event.content });
              } else {
                contentParts[0] = { type: "text", text: event.content };
              }
            } else if (event.type === "part") {
              contentParts.push(event.part);
            } else if (event.type === "part_update") {
              if (event.index !== undefined) {
                const hasThink = contentParts.some(
                  (p) => p.type === "internal_think"
                );
                const offset = hasThink ? 2 : 1;
                if (contentParts[event.index + offset]) {
                  contentParts[event.index + offset] = event.part;
                }
              }
            }

            // Update the assistant message
            setMessages((prev) => {
              const newMessages = [...prev];
              for (let i = newMessages.length - 1; i >= 0; i--) {
                if (newMessages[i].role === "assistant" && newMessages[i].createdAt === assistantTimestamp) {
                  newMessages[i] = {
                    ...newMessages[i],
                    content: [...contentParts],
                  };
                  break;
                }
              }
              return newMessages;
            });
          } catch (e) {
            console.error("Parse error", e);
          }
        }
      }

      if (messages.length <= 1) {
        setTimeout(() => {
          window.dispatchEvent(new Event("refresh-chats"));
        }, 3000);
      }
    } catch (error) {
      console.error("Error sending message", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleForkChat = async (messageIndex: number) => {
    if (!chatId) return;

    try {
      const res = await fetch(`/api/chat/${chatId}/fork`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageIndex }),
      });

      if (!res.ok) {
        throw new Error("Failed to fork chat");
      }

      const data = await res.json();
      const newChatId = data.chatId;
      const originalMessage = data.originalMessage;

      // Save draft for new chat
      const draftKey = `${siteConfig.chatInputPrefix}${newChatId}`;
      let content = "";
      if (typeof originalMessage.content === "string") {
        content = originalMessage.content;
      } else if (Array.isArray(originalMessage.content)) {
        content = originalMessage.content
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join("\n");
      }
      localStorage.setItem(draftKey, content);

      // Trigger chat refresh
      window.dispatchEvent(new Event("refresh-chats"));

      // Redirect to new chat
      router.push(`/chat/${newChatId}`);
    } catch (error) {
      console.error("Error forking chat:", error);
      addToast({
        title: t("chat.failedToForkChat"),
        color: "danger",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex-1 overflow-y-auto space-y-6 pb-24 pr-2 pt-4 scrollbar-hide">
        {messages.length === 0 && (
          <div className="text-center text-default-500 mt-60">
            <Bot size={48} className="mx-auto mb-4 opacity-20" />
            <p>{t("chat.startConversation")}</p>
          </div>
        )}

        {messages.map((message, idx) => (
          <ChatMessage
            key={`msg-${idx}`}
            message={message}
            messageIndex={idx}
            chatId={chatId}
            user={user}
            onForkChat={handleForkChat}
          />
        ))}

        {isSending &&
          messages.length > 0 &&
          messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3 max-w-3xl mx-auto justify-start items-center">
              <div className="hidden md:flex w-8 h-8 rounded-full bg-primary/10 items-center justify-center shrink-0">
                <Bot size={16} className="text-primary" />
              </div>
              <Card className="max-w-full md:max-w-[80%] shadow-none bg-default-100 dark:bg-default-50/10">
                <CardBody className="px-4 pt-[2px] pb-1 overflow-hidden flex justify-center">
                  <Spinner variant="dots" size="md" />
                </CardBody>
              </Card>
            </div>
          )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        isSending={isSending}
        isRecording={isRecording}
        isTranscribing={isTranscribing}
        recordingTime={recordingTime}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
      />

      <NotificationPermissionModal ref={notificationModalRef} />
    </div>
  );
}
