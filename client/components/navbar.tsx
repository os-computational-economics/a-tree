"use client";

import { useState } from "react";
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

import { ThemeSwitch } from "@/components/theme-switch";
import { LanguageSwitch } from "@/components/language-switch";
import {
  Shield,
  LogOut,
  MoreHorizontal,
  User as UserIcon,
  FlaskConical,
  TreePalm,
} from "lucide-react";
import { Avatar } from "@heroui/avatar";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { Button } from "@heroui/button";
import { useAuth } from "@/hooks/use-auth";

export const Navbar = () => {
  const { user, logout } = useAuth();
  const t = useTranslations();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
            <TreePalm className="md:w-6 md:h-6 w-5 h-5" />
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
          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 flex flex-col gap-2 min-h-0">
            <NextLink
              href="/experiments"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors text-default-500 hover:bg-default-100"
            >
              <FlaskConical size={20} />
              <span>{t("nav.experiments")}</span>
            </NextLink>
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
