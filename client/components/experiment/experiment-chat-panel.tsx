"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Spinner } from "@heroui/spinner";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { Bot, Send, Mic, Square, Play, Pause, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { siteConfig } from "@/config/site";
import { useVoiceRecorder } from "@/components/chat/use-voice-recorder";
import type { ChatLogEntry } from "@/lib/experiment/types";
import type { MessageContentPart } from "@/lib/llm/types";

interface ExperimentChatPanelProps {
  trialId: string;
  blockId: string;
  blockLabel?: string;
  initialMessages: ChatLogEntry[];
  onMessagesChange: (blockId: string, messages: ChatLogEntry[]) => void;
  responseMode?: "text" | "voice";
  initiator?: "user" | "ai";
}

function VoiceMessageBubble({
  trialId,
  blockId,
  msg,
  autoPlay,
  activeTimestamp,
  onPlayStart,
}: {
  trialId: string;
  blockId: string;
  msg: ChatLogEntry;
  autoPlay: boolean;
  activeTimestamp: number | null;
  onPlayStart: (timestamp: number) => void;
}) {
  const t = useTranslations("experimentRunner");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showText, setShowText] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoPlayed = useRef(false);
  const audioBlobUrlRef = useRef<string | null>(null);

  // Stop playback when another message becomes active
  useEffect(() => {
    if (activeTimestamp !== null && activeTimestamp !== msg.timestamp && isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [activeTimestamp, msg.timestamp, isPlaying]);

  const fetchAudio = useCallback(async (): Promise<string | null> => {
    if (audioBlobUrlRef.current) return audioBlobUrlRef.current;
    setIsLoadingAudio(true);
    try {
      const res = await fetch(`/api/experiments/trials/${trialId}/chat/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockId,
          timestamp: msg.timestamp,
          text: msg.content,
        }),
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioBlobUrlRef.current = url;
      setAudioBlobUrl(url);
      return url;
    } catch (e) {
      console.error("Failed to fetch TTS audio:", e);
      return null;
    } finally {
      setIsLoadingAudio(false);
    }
  }, [trialId, blockId, msg.timestamp, msg.content]);

  const playAudio = useCallback(async (url?: string | null) => {
    const blobUrl = url ?? (await fetchAudio());
    if (!blobUrl) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    onPlayStart(msg.timestamp);
    const audio = new Audio(blobUrl);
    audioRef.current = audio;
    setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onpause = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    try {
      await audio.play();
    } catch {
      setIsPlaying(false);
    }
  }, [fetchAudio, onPlayStart, msg.timestamp]);

  const togglePlay = useCallback(() => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      playAudio();
    }
  }, [isPlaying, playAudio]);

  useEffect(() => {
    if (autoPlay && !hasAutoPlayed.current) {
      hasAutoPlayed.current = true;
      fetchAudio().then((url) => {
        if (url) playAudio(url);
      });
    }
  }, [autoPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-1 max-w-full">
      <Card className="shadow-none bg-default-100 dark:bg-default-50/10">
        <CardBody className="p-3">
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              color="primary"
              onPress={togglePlay}
              isLoading={isLoadingAudio}
              aria-label={isPlaying ? t("pause") : t("replay")}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <div className="flex-1 flex items-center gap-1.5">
              {isLoadingAudio ? (
                <span className="text-tiny text-default-400">{t("generatingAudio")}</span>
              ) : (
                <div className="flex gap-[3px] items-center h-6">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-[3px] rounded-full transition-all ${isPlaying ? "bg-primary animate-pulse" : "bg-default-300"}`}
                      style={{ height: `${Math.max(4, Math.sin(i * 0.7) * 12 + 12)}px` }}
                    />
                  ))}
                </div>
              )}
            </div>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => setShowText((v) => !v)}
              aria-label={showText ? t("hideText") : t("showText")}
            >
              {showText ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </div>
          <AnimatePresence>
            {showText && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-2 mt-2 border-t border-divider">
                  <div className="prose dark:prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardBody>
      </Card>
    </div>
  );
}

export function ExperimentChatPanel({
  trialId,
  blockId,
  blockLabel,
  initialMessages,
  onMessagesChange,
  responseMode,
  initiator,
}: ExperimentChatPanelProps) {
  const t = useTranslations("experimentRunner");
  const [messages, setMessages] = useState<ChatLogEntry[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isVoice = responseMode === "voice";
  const [latestVoiceTimestamp, setLatestVoiceTimestamp] = useState<number | null>(null);
  const [activePlayingTimestamp, setActivePlayingTimestamp] = useState<number | null>(null);

  const handlePlayStart = useCallback((timestamp: number) => {
    setActivePlayingTimestamp(timestamp);
  }, []);

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

  useEffect(() => {
    setMessages(initialMessages);
  }, [blockId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const hasInitiated = useRef(false);

  useEffect(() => {
    if (initiator !== "ai" || initialMessages.length > 0 || hasInitiated.current) return;
    hasInitiated.current = true;

    (async () => {
      setIsSending(true);
      try {
        const res = await fetch(`/api/experiments/trials/${trialId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blockId,
            message: "",
            chatHistory: [],
            aiInitiate: true,
          }),
        });

        if (!res.ok || !res.body) throw new Error("Failed to initiate AI chat");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const contentParts: MessageContentPart[] = [];
        const tempTimestamp = Date.now();
        let assistantTimestamp = tempTimestamp;

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
              if (event.type === "invalidate") { contentParts.length = 0; continue; }
              if (event.type === "retry_exhausted") continue;
              if (event.type === "assistant_timestamp") {
                assistantTimestamp = event.timestamp;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.role === "assistant" && m.timestamp === tempTimestamp
                      ? { ...m, timestamp: assistantTimestamp }
                      : m,
                  ),
                );
                continue;
              }
              if (event.type === "text") {
                if (contentParts.length === 0 || contentParts[0].type !== "text") {
                  contentParts.unshift({ type: "text", text: event.content });
                } else {
                  contentParts[0] = { type: "text", text: event.content };
                }
              }

              const text = contentParts.filter((p) => p.type === "text").map((p) => p.text).join("\n");
              const entry: ChatLogEntry = { role: "assistant", content: text, timestamp: tempTimestamp };
              setMessages((prev) => {
                const without = prev.filter((m) => !(m.role === "assistant" && m.timestamp === tempTimestamp));
                return [...without, entry];
              });
            } catch { /* parse error */ }
          }
        }

        const finalText = contentParts.filter((p) => p.type === "text").map((p) => p.text).join("\n");
        const finalEntry: ChatLogEntry = { role: "assistant", content: finalText, timestamp: assistantTimestamp };
        setMessages((prev) => {
          const without = prev.filter(
            (m) => !(m.role === "assistant" && (m.timestamp === tempTimestamp || m.timestamp === assistantTimestamp)),
          );
          return [...without, finalEntry];
        });
        onMessagesChange(blockId, [finalEntry]);

        if (isVoice) {
          setLatestVoiceTimestamp(assistantTimestamp);
        }
      } catch (error) {
        console.error("Error initiating AI chat:", error);
      } finally {
        setIsSending(false);
      }
    })();
  }, [blockId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async () => {
    if (!input.trim() || isSending || isRecording || isTranscribing) return;

    const currentInput = input;
    const userEntry: ChatLogEntry = {
      role: "user",
      content: currentInput,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userEntry];
    setMessages(updatedMessages);
    onMessagesChange(blockId, updatedMessages);
    setInput("");
    setIsSending(true);

    try {
      const tempTimestamp = Date.now();
      let assistantTimestamp = tempTimestamp;
      const res = await fetch(`/api/experiments/trials/${trialId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockId,
          message: currentInput,
          chatHistory: messages,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to send message");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let isFirstChunk = true;
      const contentParts: MessageContentPart[] = [];

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
              continue;
            }

            if (event.type === "retry_exhausted") {
              console.error("[ExperimentChat] All retries failed:", event.reason);
              continue;
            }

            if (event.type === "assistant_timestamp") {
              assistantTimestamp = event.timestamp;
              setMessages((prev) =>
                prev.map((m) =>
                  m.role === "assistant" && m.timestamp === tempTimestamp
                    ? { ...m, timestamp: assistantTimestamp }
                    : m,
                ),
              );
              continue;
            }

            if (isFirstChunk) {
              isFirstChunk = false;
            }

            if (event.type === "internal_think") {
              contentParts.push({ type: "internal_think", text: event.content });
            } else if (event.type === "text") {
              if (contentParts.length === 0 || contentParts[0].type !== "text") {
                contentParts.unshift({ type: "text", text: event.content });
              } else {
                contentParts[0] = { type: "text", text: event.content };
              }
            }

            const assistantText = contentParts
              .filter((p) => p.type === "text")
              .map((p) => p.text)
              .join("\n");

            const assistantEntry: ChatLogEntry = {
              role: "assistant",
              content: assistantText,
              timestamp: tempTimestamp,
            };

            setMessages((prev) => {
              const withoutStreaming = prev.filter(
                (m) => !(m.role === "assistant" && m.timestamp === tempTimestamp),
              );
              const updated = [...withoutStreaming, assistantEntry];
              return updated;
            });
          } catch (e) {
            console.error("Parse error", e);
          }
        }
      }

      // Final save with the completed messages (using the server-authoritative timestamp)
      const assistantText = contentParts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n");
      const finalAssistantEntry: ChatLogEntry = {
        role: "assistant",
        content: assistantText,
        timestamp: assistantTimestamp,
      };
      setMessages((prev) => {
        const withoutStreaming = prev.filter(
          (m) => !(m.role === "assistant" && (m.timestamp === tempTimestamp || m.timestamp === assistantTimestamp)),
        );
        return [...withoutStreaming, finalAssistantEntry];
      });
      onMessagesChange(blockId, [...updatedMessages, finalAssistantEntry]);

      if (isVoice) {
        setLatestVoiceTimestamp(assistantTimestamp);
      }
    } catch (error) {
      console.error("Error sending experiment chat message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 scrollbar-hide">
        {messages.length === 0 && (
          <div className="text-center text-default-500 mt-20">
            <Bot size={48} className="mx-auto mb-4 opacity-20" />
            <p>{t("startConversation")}</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          const isVoiceMessage = isVoice && !isUser;
          const shouldAutoPlay = isVoiceMessage && msg.timestamp === latestVoiceTimestamp;

          return (
            <div
              key={`${msg.timestamp}-${idx}`}
              className={`flex gap-3 max-w-3xl mx-auto ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="hidden md:flex w-8 h-8 rounded-full bg-primary/10 items-center justify-center shrink-0 mt-1">
                  <Bot size={16} className="text-primary" />
                </div>
              )}
              {isVoiceMessage ? (
                <VoiceMessageBubble
                  trialId={trialId}
                  blockId={blockId}
                  msg={msg}
                  autoPlay={shouldAutoPlay}
                  activeTimestamp={activePlayingTimestamp}
                  onPlayStart={handlePlayStart}
                />
              ) : (
                <div className={`flex flex-col gap-1 ${isUser ? "max-w-[80%]" : "max-w-full"}`}>
                  <Card
                    className={`shadow-none ${
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-default-100 dark:bg-default-50/10"
                    }`}
                  >
                    <CardBody className="p-3 overflow-x-auto">
                      <div
                        className={`prose dark:prose-invert prose-sm max-w-none ${
                          isUser
                            ? "prose-headings:text-primary-foreground prose-p:text-primary-foreground prose-strong:text-primary-foreground prose-code:text-primary-foreground"
                            : ""
                        }`}
                      >
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              )}
            </div>
          );
        })}

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

      {/* Input area */}
      <div className="shrink-0 border-t border-divider pt-3 pb-1">
        <div className="max-w-3xl mx-auto">
          <div className="bg-background/80 backdrop-blur-md rounded-2xl border border-divider shadow-sm overflow-hidden">
            <div className="flex items-center p-2 gap-2">
              <AnimatePresence>
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex gap-1 items-center overflow-hidden shrink-0"
                >
                  <Popover
                    isOpen={
                      isRecording &&
                      siteConfig.audioRecording.maxDuration - recordingTime <=
                        siteConfig.audioRecording.countdownThreshold
                    }
                    placement="top"
                  >
                    <PopoverTrigger>
                      <div className="inline-block">
                        <Button
                          isIconOnly
                          variant={isRecording ? "solid" : "flat"}
                          color={isRecording ? "danger" : "default"}
                          onPress={isRecording ? stopRecording : startRecording}
                          aria-label="Record voice"
                          isLoading={isTranscribing}
                        >
                          {isRecording ? (
                            <Square size={20} />
                          ) : (
                            <Mic size={24} className="text-default-500" />
                          )}
                        </Button>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="bg-danger text-danger-foreground">
                      <div className="px-1 py-1">
                        <div className="text-small font-bold">
                          {Math.max(0, siteConfig.audioRecording.maxDuration - recordingTime)}s remaining
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </motion.div>
              </AnimatePresence>

              <Textarea
                placeholder={t("typeMessage")}
                minRows={1}
                maxRows={5}
                value={input}
                onValueChange={setInput}
                onKeyDown={handleKeyDown}
                className="flex-1 min-w-0"
                classNames={{
                  input: "text-base",
                  inputWrapper:
                    "bg-transparent shadow-none hover:bg-transparent focus-within:bg-transparent",
                }}
                isDisabled={isRecording}
              />

              <Button
                isIconOnly
                color="primary"
                aria-label="Send"
                onPress={handleSend}
                isLoading={isSending}
                isDisabled={isRecording || isTranscribing}
                className="shrink-0"
              >
                <Send size={20} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
