"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api/client";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
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
import { Plus, Search, Pencil, FlaskConical } from "lucide-react";
import type { ExperimentConfig } from "@/lib/experiment/types";
import { useTranslations } from "next-intl";

interface ExperimentListItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  blockCount: number;
  paramCount: number;
  createdAt: string;
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
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

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

      <Table aria-label="Experiments table">
        <TableHeader>
          <TableColumn>{t("nameColumn")}</TableColumn>
          <TableColumn>{t("statusColumn")}</TableColumn>
          <TableColumn>{t("blocksColumn")}</TableColumn>
          <TableColumn>{t("paramsColumn")}</TableColumn>
          <TableColumn>{t("createdColumn")}</TableColumn>
          <TableColumn align="end">{t("actionsColumn")}</TableColumn>
        </TableHeader>
        <TableBody emptyContent={t("noExperiments")}>
          {filtered.map((exp) => (
            <TableRow key={exp.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{exp.name}</p>
                  {exp.description && (
                    <p className="text-tiny text-default-400">{exp.description}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Chip size="sm" color={statusColorMap[exp.status] || "default"} variant="flat">
                  {exp.status}
                </Chip>
              </TableCell>
              <TableCell>{exp.blockCount}</TableCell>
              <TableCell>{exp.paramCount}</TableCell>
              <TableCell>{new Date(exp.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-2">
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
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
    </div>
  );
}
