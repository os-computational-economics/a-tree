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
import { Plus, Search } from "lucide-react";
import type { ExperimentConfig } from "@/lib/experiment/types";

interface ExperimentListItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  roundCount: number;
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
    template: "",
    rounds: [
      {
        id: `r_${crypto.randomUUID().slice(0, 8)}`,
        repetitions: [{ id: `rep_${crypto.randomUUID().slice(0, 8)}` }],
      },
    ],
  };
}

export default function ExperimentsPage() {
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
      const data = await api.get<{ experiments: ExperimentListItem[] }>(
        "/api/admin/experiments",
      );
      setExperiments(data.experiments);
    } catch {
      addToast({ title: "Failed to load experiments", color: "danger" });
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
      addToast({ title: "Experiment created", color: "success" });
      onClose();
      setNewName("");
      setNewDescription("");
      router.push(`/admin/experiments/${data.experiment.id}`);
    } catch {
      addToast({ title: "Failed to create experiment", color: "danger" });
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || loading) {
    return <Spinner size="lg" className="flex justify-center mt-10" />;
  }

  if (!user || !user.roles.includes("admin")) {
    return <div className="p-8 text-center">Unauthorized</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Experiments</h1>
        <Button color="primary" startContent={<Plus className="w-4 h-4" />} onPress={onOpen}>
          Create Experiment
        </Button>
      </div>

      <Input
        placeholder="Search experiments..."
        startContent={<Search className="w-4 h-4 text-default-400" />}
        value={search}
        onValueChange={setSearch}
        className="max-w-md"
      />

      <Table
        aria-label="Experiments table"
        selectionMode="single"
        onRowAction={(key) => router.push(`/admin/experiments/${key}`)}
      >
        <TableHeader>
          <TableColumn>NAME</TableColumn>
          <TableColumn>STATUS</TableColumn>
          <TableColumn>ROUNDS</TableColumn>
          <TableColumn>PARAMS</TableColumn>
          <TableColumn>CREATED</TableColumn>
        </TableHeader>
        <TableBody emptyContent="No experiments yet. Create your first one!">
          {filtered.map((exp) => (
            <TableRow key={exp.id} className="cursor-pointer">
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
              <TableCell>{exp.roundCount}</TableCell>
              <TableCell>{exp.paramCount}</TableCell>
              <TableCell>{new Date(exp.createdAt).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Create Experiment</ModalHeader>
              <ModalBody>
                <Input
                  label="Name"
                  placeholder="e.g. Public Goods Game"
                  value={newName}
                  onValueChange={setNewName}
                  isRequired
                />
                <Textarea
                  label="Description"
                  placeholder="Optional description..."
                  value={newDescription}
                  onValueChange={setNewDescription}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  isLoading={creating}
                  isDisabled={!newName.trim()}
                  onPress={() => handleCreate(onClose)}
                >
                  Create
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
