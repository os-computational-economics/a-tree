"use client";

import { Card, CardBody } from "@heroui/card";
import { Avatar } from "@heroui/avatar";
import { Bot, Pencil, ChevronDown, ChevronRight, Brain } from "lucide-react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import { Message, MessageContentPart } from "@/lib/llm/types";
import { formatTime } from "./utils";
import { Button } from "@heroui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";

interface ChatMessageProps {
  message: Message;
  messageIndex: number;
  chatId?: string;
  user?: {
    firstName?: string | null;
    email?: string | null;
  } | null;
  onForkChat?: (messageIndex: number) => void;
  hideAvatar?: boolean;
}

export default function ChatMessage({
  message,
  messageIndex,
  chatId,
  user,
  onForkChat,
  hideAvatar = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const [isForkPopoverOpen, setIsForkPopoverOpen] = useState(false);
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.roles?.includes("admin");
  const t = useTranslations();

  const renderContent = (
    content: string | MessageContentPart[],
    msgIndex?: number,
    messageTimestamp?: number
  ) => {
    if (typeof content === "string") {
      return <ReactMarkdown>{content}</ReactMarkdown>;
    }

    // Group parts by type for rendering
    const textParts = content.filter((p) => p.type === "text");
    const thinkParts = content.filter((p) => p.type === "internal_think");

    return (
      <div className="space-y-4">
        {isAdmin && thinkParts.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setIsThinkingOpen(!isThinkingOpen)}
              className="flex items-center gap-2 text-xs text-default-400 hover:text-default-600 transition-colors w-full"
            >
              {isThinkingOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              <Brain size={14} />
              <span>{t("chat.thinkingProcess")}</span>
            </button>
            {isThinkingOpen && (
              <div className="mt-2 p-3 bg-default-100 rounded-lg text-xs font-mono text-default-600 whitespace-pre-wrap border border-default-200">
                {thinkParts.map((part: any, i) => (
                  <div key={`think-${i}`}>{part.text}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {textParts.map((part: any, i) => (
          <ReactMarkdown key={`text-${i}`}>{part.text}</ReactMarkdown>
        ))}
      </div>
    );
  };

  return (
    <div
      className={clsx(
        "flex gap-3 max-w-3xl mx-auto group",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && !hideAvatar && (
        <div className="hidden md:flex w-8 h-8 rounded-full bg-primary/10 items-center justify-center shrink-0 mt-1">
          <Bot size={16} className="text-primary" />
        </div>
      )}

      <div
        className={clsx(
          "flex flex-col gap-1",
          isUser ? "max-w-[80%]" : "max-w-full"
        )}
      >
        <Card
          className={clsx(
            "shadow-none",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-default-100 dark:bg-default-50/10"
          )}
        >
          <CardBody className="p-3 overflow-x-auto">
            <div
              className={clsx(
                "prose dark:prose-invert prose-sm max-w-none",
                isUser &&
                  "prose-headings:text-primary-foreground prose-p:text-primary-foreground prose-strong:text-primary-foreground prose-code:text-primary-foreground"
              )}
            >
              {renderContent(message.content, messageIndex, message.createdAt)}
            </div>
          </CardBody>
        </Card>
        {message.createdAt && (
          <div
            className={clsx(
              "flex items-center gap-2",
              isUser ? "justify-end" : "justify-start"
            )}
          >
            <span className="text-xs text-default-400 px-1">
              {formatTime(message.createdAt)}
            </span>
            {isUser && messageIndex > 0 && onForkChat && (
              <Popover
                isOpen={isForkPopoverOpen}
                onOpenChange={setIsForkPopoverOpen}
                placement="bottom-end"
              >
                <PopoverTrigger>
                  <button
                    className="md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 hover:bg-default-100 rounded-full text-default-400 hover:text-default-600"
                    aria-label={t("chat.editMessage")}
                  >
                    <Pencil size={12} />
                  </button>
                </PopoverTrigger>
                <PopoverContent>
                  <div className="px-1 py-2 w-60">
                    <div className="text-small font-bold mb-1">
                      {t("chat.editInNewChatTitle")}
                    </div>
                    <div className="text-tiny text-default-500 mb-2">
                      {t("chat.editInNewChatDescription")}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="light"
                        onPress={() => setIsForkPopoverOpen(false)}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        size="sm"
                        color="primary"
                        onPress={() => {
                          setIsForkPopoverOpen(false);
                          onForkChat(messageIndex);
                        }}
                      >
                        {t("chat.editAndFork")}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <Avatar
          name={
            user?.firstName?.charAt(0) ||
            user?.email?.charAt(0).toUpperCase() ||
            "U"
          }
          color="primary"
          size="sm"
          className="hidden md:flex shrink-0 mt-1"
        />
      )}
    </div>
  );
}
