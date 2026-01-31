"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
} from "@heroui/navbar";
import NextLink from "next/link";
import clsx from "clsx";

import { ThemeSwitch } from "@/components/theme-switch";
import { LanguageSwitch } from "@/components/language-switch";
import {
  BotMessageSquare,
  Shield,
  SquarePen,
  LogOut,
  MoreHorizontal,
  Pencil,
  Check,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { Avatar } from "@heroui/avatar";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { Button } from "@heroui/button";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
import { Chat } from "@/components/chat-provider";
import { Spinner } from "@heroui/spinner";
import { Input } from "@heroui/input";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";

interface ChatItemProps {
  chat: Chat;
  isActive: boolean;
}

// Re-implementation of ChatItem for Mobile Navbar to handle interactions properly in mobile context
const MobileChatItem = ({ chat, isActive }: ChatItemProps) => {
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

  return (
    <div className="relative group">
      {/* Rename Popover */}
      <Popover
        isOpen={isRenameOpen}
        onOpenChange={(open) => {
          setIsRenameOpen(open);
          if (!open) setNewName(chat.name || "");
        }}
        placement="bottom"
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
        placement="bottom"
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

      <NextLink
        href={`/chat/${chat.id}`}
        className={clsx(
          "transition-colors relative group/item w-full",
          "flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap text-sm",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-default-500 hover:bg-default-100 hover:text-default-900"
        )}
      >
        {/* List View: Spinner */}
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

        <span className="overflow-hidden truncate text-sm flex-1">
          {chatName}
        </span>

        <div
          className={clsx(
            "absolute opacity-100 transition-opacity rounded-lg z-20",
            "right-2 top-1/2 -translate-y-1/2"
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
      </NextLink>
    </div>
  );
};

export const Navbar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { chats, refreshChats } = useChat();
  const t = useTranslations();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // Listen for custom event to refresh chats
    const handleRefreshChats = () => {
      refreshChats();
    };

    window.addEventListener("refresh-chats", handleRefreshChats);
    return () => {
      window.removeEventListener("refresh-chats", handleRefreshChats);
    };
  }, [refreshChats]);

  const handleNewChat = () => {
    router.push("/chat");
    setIsMenuOpen(false);
  };

  return (
    <HeroUINavbar
      maxWidth="xl"
      position="sticky"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      classNames={{
        base: "md:h-auto h-12",
        wrapper: "md:px-6 px-3 md:h-auto h-12",
      }}
    >
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-2 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1" href="/">
            <BotMessageSquare className="md:w-6 md:h-6 w-5 h-5" />
            <p className="font-bold text-inherit md:text-base text-sm">
              {t("common.appName")}
            </p>
          </NextLink>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="hidden" justify="end">
        <NavbarItem className="hidden gap-2">
          <ThemeSwitch />
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className="basis-1 md:pl-4 pl-2" justify="end">
        <NavbarMenuToggle className="md:w-auto md:h-auto w-8 h-8" />
      </NavbarContent>

      <NavbarMenu className="pt-0 mt-0 top-12 bottom-0 pb-0 h-[calc(100dvh-3rem)] overflow-hidden flex flex-col">
        <div className="flex flex-col h-full pt-2 pb-4">
          {/* Chat Content Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 flex flex-col gap-2 min-h-0">
            <div className="flex flex-col gap-0 pb-2 shrink-0 sticky top-0 z-30 bg-background/60 backdrop-blur-xl -mx-4 px-4 pt-2 rounded-2xl mt-1">
              <button
                onClick={handleNewChat}
                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors text-default-500 hover:bg-default-100/80 hover:text-default-900 w-full justify-center bg-default-100/50 mb-2"
              >
                <SquarePen size={20} />
                <span className="text-sm">{t("chat.newChat")}</span>
              </button>
            </div>

            <div className="flex flex-col gap-1 pb-4">
              {chats.length > 0 ? (
                chats.map((chat) => (
                  <div key={chat.id} onClick={() => setIsMenuOpen(false)}>
                    <MobileChatItem
                      chat={chat}
                      isActive={pathname === `/chat/${chat.id}`}
                    />
                  </div>
                ))
              ) : (
                <p className="text-center text-default-400 py-4 text-sm">
                  {t("chat.noChatsYet")}
                </p>
              )}
            </div>
          </div>

          {/* User & Admin Section at Bottom */}
          <div className="mt-auto pt-2 px-4 pb-16 shrink-0 border-t border-divider/50">
            {user && (
              <div className="flex flex-col gap-2">
                {user.roles.includes("admin") && (
                  <NextLink
                    href="/admin"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors text-default-500 hover:bg-default-100"
                  >
                    <Shield size={20} />
                    <span>{t("nav.adminDashboard")}</span>
                  </NextLink>
                )}

                <div className="flex items-center justify-between gap-2 bg-default-100/50 p-2 rounded-xl">
                  <div className="flex items-center gap-2 overflow-hidden min-w-0">
                    <div className="shrink-0">
                      <Avatar
                        src={undefined}
                        name={
                          user.firstName?.charAt(0) ||
                          user.email.charAt(0).toUpperCase()
                        }
                        size="sm"
                        color="primary"
                      />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium truncate">
                        {user.firstName
                          ? `${user.firstName} ${user.lastName || ""}`
                          : user.email}
                      </span>
                      <span className="text-xs text-default-400 truncate">
                        {user.email}
                      </span>
                    </div>
                  </div>
                  <Popover placement="top">
                    <PopoverTrigger>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        className="text-default-500"
                      >
                        <MoreHorizontal size={18} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent>
                      <div className="flex flex-col gap-2 p-2 min-w-48">
                        {/* Profile */}
                        <NextLink
                          href="/profile"
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-default-100"
                        >
                          <UserIcon size={16} />
                          <span>{t("nav.profile")}</span>
                        </NextLink>
                        <div className="h-px bg-divider my-1" />
                        <div className="flex items-center justify-between gap-4 px-2">
                          <LanguageSwitch />
                          <ThemeSwitch />
                        </div>
                        <div className="h-px bg-divider my-1" />
                        <Button
                          size="sm"
                          variant="flat"
                          color="danger"
                          startContent={<LogOut size={16} />}
                          className="w-full"
                          onPress={() => {
                            logout();
                            setIsMenuOpen(false);
                          }}
                        >
                          {t("nav.logout")}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
