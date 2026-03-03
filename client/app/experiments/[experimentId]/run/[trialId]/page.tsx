"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/spinner";
import { api } from "@/lib/api/client";
import { StudentRunner } from "@/components/experiment/student-runner";
import type { ExperimentConfig, HistoryRow } from "@/lib/experiment/types";

interface TrialData {
  id: string;
  trialCode: string;
  experimentId: string;
  status: string;
  historyTable: HistoryRow[];
  currentStepIndex: number;
  currentTemplateIndex: number;
}

interface ExperimentData {
  id: string;
  name: string;
  description: string | null;
  config: ExperimentConfig;
}

export default function ExperimentRunPage({
  params,
}: {
  params: Promise<{ experimentId: string; trialId: string }>;
}) {
  const { trialId } = use(params);
  const router = useRouter();
  const [trial, setTrial] = useState<TrialData | null>(null);
  const [experiment, setExperiment] = useState<ExperimentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTrial() {
      try {
        const data = await api.get<{ trial: TrialData; experiment: ExperimentData }>(
          `/api/experiments/trials/${trialId}`,
        );
        setTrial(data.trial);
        setExperiment(data.experiment);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load experiment");
      }
    }
    loadTrial();
  }, [trialId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-danger">{error}</p>
        <button
          className="text-primary underline"
          onClick={() => router.push("/experiments")}
        >
          Back to experiments
        </button>
      </div>
    );
  }

  if (!trial || !experiment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <StudentRunner
      config={experiment.config}
      trialId={trial.id}
      trialCode={trial.trialCode}
      initialHistoryTable={trial.historyTable}
      initialStepIndex={trial.currentStepIndex}
      initialTemplateIndex={trial.currentTemplateIndex}
      initialStatus={trial.status}
    />
  );
}
