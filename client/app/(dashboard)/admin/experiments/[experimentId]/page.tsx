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
import { ArrowLeft, Save, Trash2, Circle } from "lucide-react";
import type { ExperimentConfig } from "@/lib/experiment/types";
import type { Experiment } from "@/lib/db/schema";
import { ParameterEditor } from "../../../../../components/experiment/parameter-editor";
import { TemplateEditor } from "../../../../../components/experiment/template-editor";
import { SimulateRun } from "../../../../../components/experiment/simulate-run";

export default function ExperimentDetailPage({
  params: routeParams,
}: {
  params: Promise<{ experimentId: string }>;
}) {
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
      addToast({ title: "Failed to load experiment", color: "danger" });
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
      addToast({ title: "Experiment saved", color: "success" });
    } catch {
      addToast({ title: "Failed to save experiment", color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (onClose: () => void) => {
    try {
      await api.delete(`/api/admin/experiments/${experimentId}`);
      addToast({ title: "Experiment deleted", color: "success" });
      onClose();
      router.push("/admin/experiments");
    } catch {
      addToast({ title: "Failed to delete experiment", color: "danger" });
    }
  };

  if (authLoading || loading) {
    return <Spinner size="lg" className="flex justify-center mt-10" />;
  }

  if (!user || !user.roles.includes("admin")) {
    return <div className="p-8 text-center">Unauthorized</div>;
  }

  if (!experiment || !config) {
    return <div className="p-8 text-center">Experiment not found</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="sticky top-0 z-40 -mx-6 px-6 py-3 bg-background/80 backdrop-blur-lg border-b border-divider">
        <div className="flex items-center gap-4">
          <Button
            variant="light"
            isIconOnly
            onPress={() => router.push("/admin/experiments")}
          >
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
                  Unsaved
                </Chip>
              )}
            </div>
          </div>
          <Button
            color="danger"
            variant="flat"
            startContent={<Trash2 className="w-4 h-4" />}
            onPress={deleteModal.onOpen}
          >
            Delete
          </Button>
          <Button
            color={isDirty ? "warning" : "primary"}
            startContent={<Save className="w-4 h-4" />}
            isLoading={saving}
            onPress={handleSave}
          >
            {isDirty ? "Save Changes" : "Saved"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">General Settings</h3>
        </CardHeader>
        <CardBody className="gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Name" value={name} onValueChange={setName} isRequired />
            <Select
              label="Status"
              selectedKeys={[status]}
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string;
                if (val) setStatus(val);
              }}
            >
              <SelectItem key="draft">Draft</SelectItem>
              <SelectItem key="active">Active</SelectItem>
              <SelectItem key="completed">Completed</SelectItem>
              <SelectItem key="archived">Archived</SelectItem>
            </Select>
          </div>
          <Textarea
            label="Description"
            value={description}
            onValueChange={setDescription}
            placeholder="Optional description..."
          />
        </CardBody>
      </Card>

      <Tabs aria-label="Experiment configuration" size="lg" color="primary">
        <Tab key="parameters" title="Parameters">
          <ParameterEditor config={config} onChange={setConfig} />
        </Tab>
        <Tab key="templates" title="Templates">
          <TemplateEditor config={config} onChange={setConfig} />
        </Tab>
        <Tab key="simulate" title="Simulate">
          <SimulateRun config={config} />
        </Tab>
      </Tabs>

      <Modal isOpen={deleteModal.isOpen} onOpenChange={deleteModal.onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Delete Experiment</ModalHeader>
              <ModalBody>
                <p>Are you sure you want to delete &ldquo;{name}&rdquo;? This action cannot be undone.</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>Cancel</Button>
                <Button color="danger" onPress={() => handleDelete(onClose)}>Delete</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
