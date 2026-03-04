"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api/client";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Tabs, Tab } from "@heroui/tabs";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Select, SelectItem } from "@heroui/select";
import { addToast } from "@heroui/toast";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { useDisclosure } from "@heroui/modal";
import { ArrowLeft, Save, Trash2, Circle, FlaskConical } from "lucide-react";
import type { ExperimentConfig } from "@/lib/experiment/types";
import type { Experiment } from "@/lib/db/schema";
import { ParameterEditor } from "../../../../../components/experiment/parameter-editor";
import { TemplateEditor } from "../../../../../components/experiment/template-editor";
import { SimulateRun } from "../../../../../components/experiment/simulate-run";
import { useTranslations } from "next-intl";

export default function ExperimentDetailPage({
  params: routeParams,
}: {
  params: Promise<{ experimentId: string }>;
}) {
  const t = useTranslations("admin.experiments");
  const tAdmin = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [config, setConfig] = useState<ExperimentConfig | null>(null);
  const deleteModal = useDisclosure();
  const [experimentId, setExperimentId] = useState<string>("");
  const [savedSnapshot, setSavedSnapshot] = useState("");

  const currentSnapshot = useMemo(
    () => JSON.stringify({ name, description, status, config }),
    [name, description, status, config],
  );

  const isDirty = savedSnapshot !== "" && currentSnapshot !== savedSnapshot;

  useEffect(() => {
    routeParams.then(({ experimentId: id }) => setExperimentId(id));
  }, [routeParams]);

  const fetchExperiment = useCallback(async () => {
    if (!experimentId) return;
    try {
      const data = await api.get<{ experiment: Experiment }>(
        `/api/admin/experiments/${experimentId}`,
      );
      setExperiment(data.experiment);
      setName(data.experiment.name);
      setDescription(data.experiment.description || "");
      setStatus(data.experiment.status);
      setConfig(data.experiment.config);
      setSavedSnapshot(
        JSON.stringify({
          name: data.experiment.name,
          description: data.experiment.description || "",
          status: data.experiment.status,
          config: data.experiment.config,
        }),
      );
    } catch {
      addToast({ title: t("failedToLoadOne"), color: "danger" });
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    if (user?.roles.includes("admin") && experimentId) {
      fetchExperiment();
    }
  }, [user, experimentId, fetchExperiment]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const data = await api.patch<{ experiment: Experiment }>(
        `/api/admin/experiments/${experimentId}`,
        { name, description: description || null, status, config },
      );
      setExperiment(data.experiment);
      setSavedSnapshot(currentSnapshot);
      addToast({ title: t("savedToast"), color: "success" });
    } catch {
      addToast({ title: t("failedToSave"), color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (onClose: () => void) => {
    try {
      await api.delete(`/api/admin/experiments/${experimentId}`);
      addToast({ title: t("deletedToast"), color: "success" });
      onClose();
      router.push("/admin/experiments");
    } catch {
      addToast({ title: t("failedToDelete"), color: "danger" });
    }
  };

  if (authLoading || loading) {
    return <Spinner size="lg" className="flex justify-center mt-10" />;
  }

  if (!user || !user.roles.includes("admin")) {
    return <div className="p-8 text-center">{tAdmin("unauthorized")}</div>;
  }

  if (!experiment || !config) {
    return <div className="p-8 text-center">{t("experimentNotFound")}</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="sticky top-0 z-40 -mx-6 px-6 py-3 bg-background/80 backdrop-blur-lg border-b border-divider">
        <div className="flex items-center gap-4">
          <Button variant="light" isIconOnly onPress={() => router.push("/admin/experiments")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold truncate">{name}</h1>
              {isDirty && (
                <Chip
                  size="sm"
                  variant="flat"
                  color="warning"
                  startContent={<Circle className="w-2 h-2 fill-current" />}
                >
                  {t("unsaved")}
                </Chip>
              )}
            </div>
          </div>
          <Button
            variant="flat"
            startContent={<FlaskConical className="w-4 h-4" />}
            onPress={() => router.push(`/admin/experiments/${experimentId}/trials`)}
          >
            {t("viewTrialsButton")}
          </Button>
          <Button
            color="danger"
            variant="flat"
            startContent={<Trash2 className="w-4 h-4" />}
            onPress={deleteModal.onOpen}
          >
            {tCommon("delete")}
          </Button>
          <Button
            color={isDirty ? "warning" : "primary"}
            startContent={<Save className="w-4 h-4" />}
            isLoading={saving}
            onPress={handleSave}
          >
            {isDirty ? t("saveChangesButton") : t("savedButton")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">{t("generalSettings")}</h3>
        </CardHeader>
        <CardBody className="gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t("nameLabel")} value={name} onValueChange={setName} isRequired />
            <Select
              label={t("statusLabel")}
              selectedKeys={[status]}
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string;
                if (val) setStatus(val);
              }}
            >
              <SelectItem key="draft">{t("draft")}</SelectItem>
              <SelectItem key="active">{t("active")}</SelectItem>
              <SelectItem key="completed">{t("completed")}</SelectItem>
              <SelectItem key="archived">{t("archived")}</SelectItem>
            </Select>
          </div>
          <Textarea
            label={t("descriptionLabel")}
            value={description}
            onValueChange={setDescription}
            placeholder={t("descriptionPlaceholder")}
          />
        </CardBody>
      </Card>

      <Tabs aria-label="Experiment configuration" size="lg" color="primary">
        <Tab key="parameters" title={t("structureParams")}>
          <ParameterEditor config={config} onChange={setConfig} />
        </Tab>
        <Tab key="templates" title={t("templates")}>
          <TemplateEditor config={config} onChange={setConfig} />
        </Tab>
        <Tab key="guide" title={t("gameGuide")}>
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">{t("gameGuide")}</h3>
            </CardHeader>
            <CardBody className="gap-4">
              <p className="text-sm text-default-500">{t("gameGuideDesc")}</p>
              <Textarea
                label={t("gameGuideLabel")}
                value={config.gameGuide || ""}
                onValueChange={(v) => setConfig({ ...config, gameGuide: v || undefined })}
                placeholder={t("gameGuidePlaceholder")}
                minRows={8}
                maxRows={30}
              />
              {config.gameGuide && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-default-500">{t("previewLabel")}</p>
                  <div
                    className="p-4 rounded-lg bg-content2/50 border border-divider prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: config.gameGuide }}
                  />
                </div>
              )}
            </CardBody>
          </Card>
        </Tab>
        <Tab key="simulate" title={t("simulate")}>
          <SimulateRun config={config} />
        </Tab>
      </Tabs>

      <Modal isOpen={deleteModal.isOpen} onOpenChange={deleteModal.onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{t("deleteModalTitle")}</ModalHeader>
              <ModalBody>
                <p>{t("deleteMessage", { name })}</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>{tCommon("cancel")}</Button>
                <Button color="danger" onPress={() => handleDelete(onClose)}>{tCommon("delete")}</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
