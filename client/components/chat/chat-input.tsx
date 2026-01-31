"use client";

import { useRef, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { siteConfig } from "@/config/site";
import {
  Send,
  Mic,
  Square,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  recordingTime: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export default function ChatInput({
  input,
  onInputChange,
  onSend,
  isSending,
  isRecording,
  isTranscribing,
  recordingTime,
  onStartRecording,
  onStopRecording,
}: ChatInputProps) {
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  // Handle click outside to collapse
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        const target = event.target as Element;

        // Don't collapse if interacting with a portal (dropdown, popover, etc.)
        if (
          target.closest(
            "[data-overlay], [data-state='open'], [role='listbox'], [role='menu']"
          )
        ) {
          return;
        }

        // Don't collapse if audio recording or transcription is in progress
        if (isRecording || isTranscribing) {
          return;
        }

        setIsExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isRecording, isTranscribing]);

  // Auto-expand if recording
  useEffect(() => {
    if (isRecording) {
      setIsExpanded(true);
    }
  }, [isRecording]);

  return (
    <div className="absolute bottom-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div
        ref={containerRef}
        style={{
          maxWidth: isExpanded ? "48rem" : "320px",
          width: "100%",
        }}
        className="bg-background/80 backdrop-blur-md rounded-2xl border border-divider shadow-lg pointer-events-auto overflow-hidden transition-[max-width] duration-300 ease-out"
      >
        <div className="flex flex-col">
          {/* Input Row */}
          <div className={`flex items-center p-2 ${isExpanded ? "gap-2" : ""}`}>
            <AnimatePresence>
              {isExpanded && (
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
                          onPress={isRecording ? onStopRecording : onStartRecording}
                          aria-label={t("chat.recordVoice")}
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
                          {t("chat.timeRemaining", {
                            seconds: Math.max(
                              0,
                              siteConfig.audioRecording.maxDuration - recordingTime
                            ),
                          })}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </motion.div>
              )}
            </AnimatePresence>

            <Textarea
              placeholder={t("chat.typeMessage")}
              minRows={1}
              maxRows={isExpanded ? 5 : 1}
              value={input}
              onValueChange={onInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsExpanded(true)}
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
              aria-label={t("chat.send")}
              onPress={onSend}
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
  );
}
