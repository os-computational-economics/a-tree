"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import NextLink from "next/link";
import clsx from "clsx";
import {
  PanelRightClose,
  PanelRightOpen,
  SquarePen,
  MessageSquare,
  Pencil,
  Check,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Spinner } from "@heroui/spinner";
import { useChat } from "@/hooks/use-chat";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Divider } from "@heroui/divider";
import { Chat } from "@/components/chat-provider";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";

interface ChatItemProps {
  chat: Chat;
  isActive: boolean;
  isCollapsed: boolean;
}

const ChatItem = ({ chat, isActive, isCollapsed }: ChatItemProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  const { renameChat, deleteChat, isChatMonitored } = useChat();
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [newName, setNewName] = useState(chat.name || "");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRename = async () => {
    if (!newName.trim()) return;
    setIsRenaming(true);
    try {
      await renameChat(chat.id, newName);
      setIsRenameOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteChat(chat.id);
      setIsDeleteOpen(false);
      // If we're on the deleted chat's page, redirect to /chat
      if (pathname === `/chat/${chat.id}`) {
        router.push("/chat");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const chatName = chat.name || t("newChat");
  const isMonitored = isChatMonitored(chat.id);

  const LinkComponent = (
    <NextLink
      href={`/chat/${chat.id}`}
      className={clsx(
        "transition-colors relative group/item",
        "flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap text-sm",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-default-500 hover:bg-default-100 hover:text-default-900",
        isCollapsed && "justify-center pr-3"
      )}
    >
      {/* List View: Spinner only (no icon) */}
      {isMonitored && (
        <span className="shrink-0 flex items-center justify-center w-4 h-4">
          <Spinner
            size="sm"
            color="current"
            classNames={{
              wrapper: "w-4 h-4",
              circle1: "border-b-current",
              circle2: "border-b-current",
            }}
          />
        </span>
      )}

      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overflow-hidden truncate text-sm flex-1"
          >
            {chatName}
          </motion.span>
        )}
      </AnimatePresence>

      {!isCollapsed && (
        <div
          className={clsx(
            "absolute opacity-0 group-hover/item:opacity-100 transition-opacity rounded-lg z-20",
            "right-2 top-1/2 -translate-y-1/2",
            isActive
              ? "bg-primary/20 backdrop-blur-md"
              : "bg-default-100/80 backdrop-blur-md"
          )}
        >
          <Dropdown>
            <DropdownTrigger>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="min-w-6 w-6 h-6 p-0 text-default-500"
                onPress={(e) => {
                  // Prevent navigation
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <MoreHorizontal size={16} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Chat Actions">
              <DropdownItem
                key="rename"
                startContent={<Pencil size={16} />}
                onPress={() => setIsRenameOpen(true)}
              >
                {tCommon("rename")}
              </DropdownItem>
              <DropdownItem
                key="delete"
                startContent={<Trash2 size={16} />}
                className="text-danger"
                color="danger"
                onPress={() => setIsDeleteOpen(true)}
              >
                {tCommon("delete")}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      )}
    </NextLink>
  );

  return (
    <motion.div layout className="relative group">
      {/* Rename Popover */}
      <Popover
        isOpen={isRenameOpen}
        onOpenChange={(open) => {
          setIsRenameOpen(open);
          if (!open) setNewName(chat.name || "");
        }}
        placement="right"
      >
        <PopoverTrigger>
          <div className="absolute right-2 top-1/2 w-1 h-1 opacity-0 pointer-events-none" />
        </PopoverTrigger>
        <PopoverContent>
          <div className="px-1 py-2 w-64">
            <p className="text-small font-bold text-foreground mb-2">
              {t("renameChat")}
            </p>
            <div className="flex gap-2">
              <Input
                size="sm"
                value={newName}
                onValueChange={setNewName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                }}
                autoFocus
              />
              <Button
                size="sm"
                color="primary"
                isIconOnly
                isLoading={isRenaming}
                onPress={handleRename}
              >
                <Check size={16} />
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Delete Confirmation Popover */}
      <Popover
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        placement="right"
      >
        <PopoverTrigger>
          <div className="absolute right-2 top-1/2 w-1 h-1 opacity-0 pointer-events-none" />
        </PopoverTrigger>
        <PopoverContent>
          <div className="px-1 py-2 w-64">
            <p className="text-small font-bold text-foreground mb-1">
              {t("deleteChat")}
            </p>
            <p className="text-tiny text-default-500 mb-3">
              {t("deleteConfirm")}
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="flat"
                onPress={() => setIsDeleteOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                size="sm"
                color="danger"
                isLoading={isDeleting}
                onPress={handleDelete}
              >
                {tCommon("delete")}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {LinkComponent}
    </motion.div>
  );
};

export const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  const { chats, refreshChats } = useChat();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const handleRefreshChats = () => {
      refreshChats();
    };

    window.addEventListener("refresh-chats", handleRefreshChats);
    return () => {
      window.removeEventListener("refresh-chats", handleRefreshChats);
    };
  }, [refreshChats]);

  const handleNewChat = () => {
    window.dispatchEvent(new Event("reset-chat"));
    router.push("/chat");
  };

  return (
    <motion.aside
      initial={{ width: 256 }}
      animate={{ width: isCollapsed ? 80 : 256 }}
      transition={{
        duration: 0.3,
        type: "spring",
        stiffness: 200,
        damping: 25,
      }}
      className="hidden md:flex flex-col h-full border-r border-divider bg-background z-40 overflow-hidden"
    >
      <div className="shrink-0">
        <div
          className={clsx(
            "p-4 flex items-center",
            isCollapsed ? "justify-center" : "justify-between"
          )}
        >
          <AnimatePresence>
            {!isCollapsed && (
              <motion.p
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="font-bold text-lg whitespace-nowrap overflow-hidden"
              >
                {t("nav.agent")}
              </motion.p>
            )}
          </AnimatePresence>

          <Button
            isIconOnly
            variant="light"
            size="sm"
            onPress={() => setIsCollapsed(!isCollapsed)}
            className="text-default-500 shrink-0"
          >
            {isCollapsed ? (
              <PanelRightClose size={20} />
            ) : (
              <PanelRightOpen size={20} />
            )}
          </Button>
        </div>

        <div
          className={clsx(
            "flex flex-col gap-0 pb-0",
            isCollapsed ? "px-2" : "pl-3 pr-2"
          )}
        >
          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded-xl transition-colors whitespace-nowrap text-default-500 hover:bg-default-100 hover:text-default-900",
              isCollapsed && "justify-center"
            )}
          >
            <span className="shrink-0">
              <SquarePen size={20} />
            </span>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden text-sm"
                >
                  {t("chat.newChat")}
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Divider */}
          {!isCollapsed && (
            <div className="relative py-2 flex items-center justify-center my-0">
              <Divider />
            </div>
          )}
        </div>
      </div>

      <div
        className={clsx(
          "flex flex-col gap-1 py-2 grow overflow-y-auto overflow-x-hidden sidebar-scrollbar",
          isCollapsed ? "px-2" : "pl-3 pr-2"
        )}
      >
        {/* Recent Chats */}
        {!isCollapsed && (
          <motion.div layout className="space-y-1">
            <AnimatePresence mode="popLayout">
              {chats.map((chat) => {
                const isActive = pathname === `/chat/${chat.id}`;
                return (
                  <ChatItem
                    key={chat.id}
                    chat={chat}
                    isActive={isActive}
                    isCollapsed={isCollapsed}
                  />
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </motion.aside>
  );
};
