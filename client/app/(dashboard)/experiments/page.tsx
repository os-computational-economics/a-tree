"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api/client";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
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
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { addToast } from "@heroui/toast";
import { FlaskConical, Play, RotateCcw, Eye, ChevronDown, KeyRound } from "lucide-react";
import type { HistoryRow } from "@/lib/experiment/types";
import { useTranslations } from "next-intl";

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
  displayableParamIds: string[];
  createdAt: string;
  updatedAt: string;
}

function formatValue(val: number | string | boolean | null): string {
  if (val === null) return "\u2014";
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(4);
  return String(val);
}

function CompletedTrialHistory({
  trial,
  roundLabel,
  viewLabel,
  hideLabel,
}: {
  trial: TrialItem;
  roundLabel: (n: number) => string;
  viewLabel: string;
  hideLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const displayable = useMemo(() => new Set(trial.displayableParamIds), [trial.displayableParamIds]);

  const filteredKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of trial.historyTable) {
      for (const k of Object.keys(row.values)) {
        if (displayable.has(k)) keys.add(k);
      }
    }
    return Array.from(keys);
  }, [trial.historyTable, displayable]);

  if (!trial.historyTable || trial.historyTable.length === 0 || filteredKeys.length === 0) return null;

  const columns = [
    { key: "round", label: "ROUND" },
    ...filteredKeys.map((k) => ({ key: k, label: k })),
  ];

  return (
    <div className="mt-2">
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-default-500 hover:text-default-700 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Eye className="w-3 h-3" />
        <span>{isOpen ? hideLabel : viewLabel}</span>
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
                      return <TableCell key="round"><span className="text-xs">{roundLabel(idx + 1)}</span></TableCell>;
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

// View states for the student experiments page
type PageView = "lobby" | "experiments";

export default function StudentExperimentsPage() {
  const t = useTranslations("studentExperiments");
  const tCommon = useTranslations("common");
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [view, setView] = useState<PageView>("lobby");
  const [experiments, setExperiments] = useState<ExperimentListItem[]>([]);
  const [trials, setTrials] = useState<TrialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);

  // Lobby state
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [submittingCode, setSubmittingCode] = useState(false);

  const fetchTrials = useCallback(async () => {
    try {
      const data = await api.get<{ trials: TrialItem[] }>("/api/experiments/my-trials");
      setTrials(data.trials);
    } catch {
      // non-fatal
    }
  }, []);

  const fetchExperiments = useCallback(async () => {
    try {
      const data = await api.get<{ experiments: ExperimentListItem[] }>("/api/experiments");
      setExperiments(data.experiments);
    } catch {
      addToast({ title: t("failedToLoad"), color: "danger" });
    }
  }, [t]);

  useEffect(() => {
    if (!user) return;
    Promise.all([fetchExperiments(), fetchTrials()]).finally(() => setLoading(false));
  }, [user, fetchExperiments, fetchTrials]);

  // Admins skip the lobby and go straight to the experiment list
  useEffect(() => {
    if (user?.roles.includes("admin")) {
      setView("experiments");
    }
  }, [user]);

  const trialsByExperiment = useMemo(() => {
    const map: Record<string, TrialItem[]> = {};
    for (const trial of trials) {
      if (!map[trial.experimentId]) map[trial.experimentId] = [];
      map[trial.experimentId].push(trial);
    }
    return map;
  }, [trials]);

  const handleCodeSubmit = async () => {
    if (!codeInput.trim()) return;
    setCodeError("");
    setSubmittingCode(true);
    try {
      await api.post("/api/experiments/access", { code: codeInput.trim() });
      await fetchExperiments();
      setCodeInput("");
      setView("experiments");
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 404) {
        setCodeError(t("lobbyInvalidCode"));
      } else {
        setCodeError(t("lobbyError"));
      }
    } finally {
      setSubmittingCode(false);
    }
  };

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
      addToast({ title: t("failedToJoin"), color: "danger" });
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

  // LOBBY — always shown first for non-admin students
  if (view === "lobby") {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Card className="w-full max-w-md shadow-lg">
          <CardBody className="gap-6 py-10 px-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <KeyRound className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">{t("lobbyTitle")}</h1>
              <p className="text-sm text-default-500">{t("lobbySubtitle")}</p>
            </div>
            <div className="flex flex-col gap-3">
              <Input
                placeholder={t("lobbyInputPlaceholder")}
                value={codeInput}
                onValueChange={(v) => {
                  setCodeInput(v.toUpperCase());
                  setCodeError("");
                }}
                isInvalid={!!codeError}
                errorMessage={codeError}
                size="lg"
                classNames={{ input: "text-center tracking-widest font-mono text-lg" }}
                onKeyDown={(e) => { if (e.key === "Enter") handleCodeSubmit(); }}
              />
              <Button
                color="primary"
                size="lg"
                isLoading={submittingCode}
                isDisabled={!codeInput.trim()}
                onPress={handleCodeSubmit}
              >
                {t("lobbySubmit")}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // EXPERIMENT LIST — shown after entering a valid code (or always for admins)
  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <FlaskConical className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      {experiments.length === 0 && (
        <p className="text-default-500">{t("noExperimentsAvailable")}</p>
      )}

      <div className="grid gap-4">
        {experiments.map((exp) => {
          const expTrials = trialsByExperiment[exp.id] || [];
          const inProgress = expTrials.filter((trial) => trial.status === "in_progress");
          const completed = expTrials.filter((trial) => trial.status === "completed");

          return (
            <Card key={exp.id} className="w-full">
              <CardHeader className="flex flex-col items-start gap-1">
                <div className="flex items-center justify-between w-full">
                  <h2 className="text-xl font-semibold">{exp.name}</h2>
                  <Chip size="sm" variant="flat" color="primary">
                    {exp.blockCount} {exp.blockCount !== 1 ? t("blocks") : t("block")}
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
                        <p className="text-xs font-semibold text-default-400 uppercase mb-2">{t("inProgress")}</p>
                        <div className="space-y-2">
                          {inProgress.map((trial) => (
                            <div key={trial.id} className="flex items-center justify-between bg-content2 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Chip size="sm" variant="flat" color="warning">{t("inProgress")}</Chip>
                                <span className="text-sm font-mono">{trial.trialCode}</span>
                              </div>
                              <Button
                                size="sm"
                                color="primary"
                                variant="flat"
                                startContent={<RotateCcw className="w-3 h-3" />}
                                onPress={() => router.push(`/experiments/${exp.id}/run/${trial.id}`)}
                              >
                                {t("resume")}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {completed.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-default-400 uppercase mb-2">{t("completed")}</p>
                        <div className="space-y-2">
                          {completed.map((trial) => (
                            <div key={trial.id} className="bg-content2 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Chip size="sm" variant="flat" color="success">{t("completed")}</Chip>
                                <span className="text-sm font-mono">{trial.trialCode}</span>
                                <span className="text-xs text-default-400">
                                  {new Date(trial.updatedAt).toLocaleDateString()}
                                </span>
                              </div>
                              <CompletedTrialHistory
                                trial={trial}
                                roundLabel={(n) => t("round", { number: n })}
                                viewLabel={t("viewHistory")}
                                hideLabel={t("hideHistory")}
                              />
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
                  {t("startNewTrial")}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{t("joinTitle")}</ModalHeader>
              <ModalBody>
                <p>{t("joinConfirm")}</p>
                <p className="text-sm text-default-500">{t("joinDescription")}</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>{tCommon("cancel")}</Button>
                <Button
                  color="primary"
                  isLoading={!!joining}
                  onPress={() => handleJoinConfirm(onClose)}
                >
                  {t("yesStart")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
