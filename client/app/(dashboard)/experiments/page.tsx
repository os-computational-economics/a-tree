"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api/client";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Chip } from "@heroui/chip";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { useDisclosure } from "@heroui/modal";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { addToast } from "@heroui/toast";
import { FlaskConical, Play, RotateCcw, Eye, ChevronDown } from "lucide-react";
import type { HistoryRow } from "@/lib/experiment/types";

interface ExperimentListItem {
  id: string;
  name: string;
  description: string | null;
  blockCount: number;
  paramCount: number;
  createdAt: string;
}

interface TrialItem {
  id: string;
  trialCode: string;
  experimentId: string;
  status: string;
  historyTable: HistoryRow[];
  createdAt: string;
  updatedAt: string;
}

function formatValue(val: number | string | boolean | null): string {
  if (val === null) return "\u2014";
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(4);
  return String(val);
}

function CompletedTrialHistory({ trial }: { trial: TrialItem }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!trial.historyTable || trial.historyTable.length === 0) return null;

  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of trial.historyTable) {
      for (const k of Object.keys(row.values)) keys.add(k);
    }
    return Array.from(keys);
  }, [trial.historyTable]);

  const columns = [
    { key: "round", label: "ROUND" },
    ...allKeys.map((k) => ({ key: k, label: k })),
  ];

  return (
    <div className="mt-2">
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-default-500 hover:text-default-700 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Eye className="w-3 h-3" />
        <span>History</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="mt-2 overflow-x-auto">
          <Table aria-label="Trial history" isStriped>
            <TableHeader columns={columns}>
              {(col) => <TableColumn key={col.key}>{col.label}</TableColumn>}
            </TableHeader>
            <TableBody>
              {trial.historyTable.map((row, idx) => (
                <TableRow key={idx}>
                  {columns.map((col) => {
                    if (col.key === "round") {
                      return <TableCell key="round"><span className="text-xs">Round {idx + 1}</span></TableCell>;
                    }
                    return (
                      <TableCell key={col.key}>
                        <span className="text-xs">{formatValue(row.values[col.key] ?? null)}</span>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function StudentExperimentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [experiments, setExperiments] = useState<ExperimentListItem[]>([]);
  const [trials, setTrials] = useState<TrialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [expData, trialData] = await Promise.all([
        api.get<{ experiments: ExperimentListItem[] }>("/api/experiments"),
        api.get<{ trials: TrialItem[] }>("/api/experiments/my-trials"),
      ]);
      setExperiments(expData.experiments);
      setTrials(trialData.trials);
    } catch {
      addToast({ title: "Failed to load experiments", color: "danger" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const trialsByExperiment = useMemo(() => {
    const map: Record<string, TrialItem[]> = {};
    for (const t of trials) {
      if (!map[t.experimentId]) map[t.experimentId] = [];
      map[t.experimentId].push(t);
    }
    return map;
  }, [trials]);

  const handleJoinClick = (experimentId: string) => {
    setSelectedExperimentId(experimentId);
    onOpen();
  };

  const handleJoinConfirm = async (onClose: () => void) => {
    if (!selectedExperimentId) return;
    setJoining(selectedExperimentId);
    try {
      const data = await api.post<{ trialId: string; trialCode: string }>(
        "/api/experiments/join",
        { experimentId: selectedExperimentId },
      );
      onClose();
      router.push(`/experiments/${selectedExperimentId}/run/${data.trialId}`);
    } catch {
      addToast({ title: "Failed to join experiment", color: "danger" });
    } finally {
      setJoining(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <FlaskConical className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Experiments</h1>
      </div>

      {experiments.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <p className="text-default-500">No experiments available right now.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4">
          {experiments.map((exp) => {
            const expTrials = trialsByExperiment[exp.id] || [];
            const inProgress = expTrials.filter((t) => t.status === "in_progress");
            const completed = expTrials.filter((t) => t.status === "completed");

            return (
              <Card key={exp.id} className="w-full">
                <CardHeader className="flex flex-col items-start gap-1">
                  <div className="flex items-center justify-between w-full">
                    <h2 className="text-xl font-semibold">{exp.name}</h2>
                    <Chip size="sm" variant="flat" color="primary">
                      {exp.blockCount} block{exp.blockCount !== 1 ? "s" : ""}
                    </Chip>
                  </div>
                  {exp.description && (
                    <p className="text-sm text-default-500">{exp.description}</p>
                  )}
                </CardHeader>

                <CardBody className="pt-0">
                  {expTrials.length > 0 && (
                    <div className="space-y-3">
                      {inProgress.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-default-400 uppercase mb-2">In Progress</p>
                          <div className="space-y-2">
                            {inProgress.map((t) => (
                              <div key={t.id} className="flex items-center justify-between bg-content2 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <Chip size="sm" variant="flat" color="warning">In Progress</Chip>
                                  <span className="text-sm font-mono">{t.trialCode}</span>
                                </div>
                                <Button
                                  size="sm"
                                  color="primary"
                                  variant="flat"
                                  startContent={<RotateCcw className="w-3 h-3" />}
                                  onPress={() => router.push(`/experiments/${exp.id}/run/${t.id}`)}
                                >
                                  Resume
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {completed.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-default-400 uppercase mb-2">Completed</p>
                          <div className="space-y-2">
                            {completed.map((t) => (
                              <div key={t.id} className="bg-content2 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <Chip size="sm" variant="flat" color="success">Completed</Chip>
                                  <span className="text-sm font-mono">{t.trialCode}</span>
                                  <span className="text-xs text-default-400">
                                    {new Date(t.updatedAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <CompletedTrialHistory trial={t} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardBody>

                <CardFooter>
                  <Button
                    color="primary"
                    startContent={<Play className="w-4 h-4" />}
                    onPress={() => handleJoinClick(exp.id)}
                  >
                    Start New Trial
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Join Experiment</ModalHeader>
              <ModalBody>
                <p>Are you sure you want to start a new trial for this experiment?</p>
                <p className="text-sm text-default-500">
                  A unique 6-digit experiment ID will be generated for you.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  isLoading={!!joining}
                  onPress={() => handleJoinConfirm(onClose)}
                >
                  Yes, Start
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
