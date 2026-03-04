"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { api } from "@/lib/api/client";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";
import { useTranslations } from "next-intl";

export default function SystemManagementPage() {
  const t = useTranslations("admin.system");
  const tAdmin = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { user, loading: authLoading } = useAuth();
  const [cleaningTokens, setCleaningTokens] = useState(false);

  const handleCleanupTokens = async () => {
    setCleaningTokens(true);
    try {
      await api.post("/api/admin/cleanup-tokens", {});
      addToast({
        title: tCommon("success"),
        description: t("deleteSuccess"),
        color: "success",
      });
    } catch (error) {
      addToast({
        title: tCommon("error"),
        description: t("deleteError"),
        color: "danger",
      });
      console.error(error);
    } finally {
      setCleaningTokens(false);
    }
  };

  if (authLoading) {
    return <Spinner size="lg" className="flex justify-center mt-10" />;
  }

  if (!user || !user.roles.includes("admin")) {
    return <div className="p-8 text-center">{tAdmin("unauthorized")}</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("managementTitle")}</h1>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t("refreshTokensTitle")}</h2>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-500">{t("refreshTokensDesc")}</p>
            <div className="flex items-center gap-4">
              <Button
                color="danger"
                variant="flat"
                onPress={handleCleanupTokens}
                isLoading={cleaningTokens}
              >
                {t("deleteExpiredTokens")}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
