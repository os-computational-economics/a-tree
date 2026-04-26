"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api/client";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Card, CardBody, CardFooter } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Divider } from "@heroui/divider";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { useDisclosure } from "@heroui/modal";
import { Textarea } from "@heroui/input";
import { addToast } from "@heroui/toast";
import { Plus, Search, Pencil, FlaskConical, Copy, Trash2, KeyRound } from "lucide-react";
import type { ExperimentConfig } from "@/lib/experiment/types";
import { useTranslations } from "next-intl";

interface ExperimentListItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  accessCode: string | null;
  blockCount: number;
  paramCount: number;
  createdAt: string;
  updatedAt: string;
}

const statusColorMap: Record<string, "default" | "primary" | "success" | "warning"> = {
  draft: "default",
  active: "primary",
  completed: "success",
  archived: "warning",
};

function makeDefaultConfig(): ExperimentConfig {
  return {
    params: {},
    introTemplate: "",
    decisionTemplate: "",
    resultTemplate: "",
    blocks: [
      {
        id: `b_${crypto.randomUUID().slice(0, 8)}`,
        rounds: [{ id: `r_${crypto.randomUUID().slice(0, 8)}` }],
      },
    ],
  };
}

export default function ExperimentsPage() {
  const t = useTranslations("admin.experiments");
  const tAdmin = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [experiments, setExperiments] = useState<ExperimentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const deleteModal = useDisclosure();
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExperimentListItem | null>(null);

  const fetchExperiments = async () => {
    try {
      const data = await api.get<{ experiments: ExperimentListItem[] }>("/api/admin/experiments");
      setExperiments(data.experiments);
    } catch {
      addToast({ title: t("failedToLoad"), color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.roles.includes("admin")) {
      fetchExperiments();
    }
  }, [user]);

  const filtered = useMemo(
    () =>
      experiments.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.description?.toLowerCase().includes(search.toLowerCase()),
      ),
    [experiments, search],
  );

  const handleCreate = async (onClose: () => void) => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const data = await api.post<{ experiment: { id: string } }>("/api/admin/experiments", {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        config: makeDefaultConfig(),
      });
      addToast({ title: t("experimentCreated"), color: "success" });
      onClose();
      setNewName("");
      setNewDescription("");
      router.push(`/admin/experiments/${data.experiment.id}`);
    } catch {
      addToast({ title: t("failedToCreate"), color: "danger" });
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (exp: ExperimentListItem) => {
    try {
      const data = await api.post<{ experiment: { id: string } }>(
        `/api/admin/experiments/${exp.id}/duplicate`,
      );
      addToast({ title: t("duplicatedToast"), color: "success" });
      router.push(`/admin/experiments/${data.experiment.id}`);
    } catch {
      addToast({ title: t("failedToDuplicate"), color: "danger" });
    }
  };

  const handleDelete = async (onClose: () => void) => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/admin/experiments/${deleteTarget.id}`);
      addToast({ title: t("deletedToast"), color: "success" });
      onClose();
      setDeleteTarget(null);
      fetchExperiments();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Button color="primary" startContent={<Plus className="w-4 h-4" />} onPress={onOpen}>
          {t("createExperiment")}
        </Button>
      </div>

      <Input
        placeholder={t("searchPlaceholder")}
        startContent={<Search className="w-4 h-4 text-default-400" />}
        value={search}
        onValueChange={setSearch}
        className="max-w-md"
      />

      {filtered.length === 0 && (
        <p className="text-default-400 text-sm py-4">{t("noExperiments")}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((exp) => (
          <Card key={exp.id} className="w-full">
            <CardBody className="gap-3 pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base truncate">{exp.name}</p>
                  {exp.description && (
                    <p className="text-xs text-default-400 mt-0.5 line-clamp-2">{exp.description}</p>
                  )}
                </div>
                <Chip size="sm" color={statusColorMap[exp.status] || "default"} variant="flat" className="shrink-0">
                  {exp.status}
                </Chip>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {exp.accessCode ? (
                  <Chip
                    size="sm"
                    variant="flat"
                    color="secondary"
                    startContent={<KeyRound className="w-3 h-3" />}
                    classNames={{ content: "font-mono tracking-wider" }}
                  >
                    {exp.accessCode}
                  </Chip>
                ) : (
                  <Chip size="sm" variant="flat" color="default">
                    {t("openAccess")}
                  </Chip>
                )}
                <span className="text-xs text-default-400 ml-auto">
                  {t("modifiedLabel")} {new Date(exp.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </CardBody>

            <Divider />

            <CardFooter className="gap-1 flex-wrap pt-2">
              <Button
                size="sm"
                variant="flat"
                startContent={<Pencil className="w-3.5 h-3.5" />}
                onPress={() => router.push(`/admin/experiments/${exp.id}`)}
              >
                {t("editButton")}
              </Button>
              <Button
                size="sm"
                variant="flat"
                color="primary"
                startContent={<FlaskConical className="w-3.5 h-3.5" />}
                onPress={() => router.push(`/admin/experiments/${exp.id}/trials`)}
              >
                {t("viewTrialsButton")}
              </Button>
              <Button
                size="sm"
                variant="flat"
                startContent={<Copy className="w-3.5 h-3.5" />}
                onPress={() => handleDuplicate(exp)}
              >
                {t("duplicateButton")}
              </Button>
              <Button
                size="sm"
                variant="flat"
                color="danger"
                startContent={<Trash2 className="w-3.5 h-3.5" />}
                onPress={() => {
                  setDeleteTarget(exp);
                  deleteModal.onOpen();
                }}
              >
                {tCommon("delete")}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{t("createExperiment")}</ModalHeader>
              <ModalBody>
                <Input
                  label={t("nameLabel")}
                  placeholder={t("namePlaceholder")}
                  value={newName}
                  onValueChange={setNewName}
                  isRequired
                />
                <Textarea
                  label={t("descriptionLabel")}
                  placeholder={t("descriptionPlaceholder")}
                  value={newDescription}
                  onValueChange={setNewDescription}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>{tCommon("cancel")}</Button>
                <Button
                  color="primary"
                  isLoading={creating}
                  isDisabled={!newName.trim()}
                  onPress={() => handleCreate(onClose)}
                >
                  {tCommon("create")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={deleteModal.isOpen} onOpenChange={deleteModal.onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{t("deleteModalTitle")}</ModalHeader>
              <ModalBody>
                <p>{t("deleteMessage", { name: deleteTarget?.name ?? "" })}</p>
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
