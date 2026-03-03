"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api/client";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { addToast } from "@heroui/toast";
import { ArrowLeft } from "lucide-react";
import { TrialsTab } from "../../../../../../components/experiment/trials-tab";

interface ExperimentSummary {
  id: string;
  name: string;
}

export default function TrialsPage({
  params: routeParams,
}: {
  params: Promise<{ experimentId: string }>;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [experimentId, setExperimentId] = useState("");
  const [experiment, setExperiment] = useState<ExperimentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    routeParams.then(({ experimentId: id }) => setExperimentId(id));
  }, [routeParams]);

  const fetchExperiment = useCallback(async () => {
    if (!experimentId) return;
    try {
      const data = await api.get<{ experiment: ExperimentSummary }>(
        `/api/admin/experiments/${experimentId}`,
      );
      setExperiment(data.experiment);
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

  if (authLoading || loading) {
    return <Spinner size="lg" className="flex justify-center mt-10" />;
  }

  if (!user || !user.roles.includes("admin")) {
    return <div className="p-8 text-center">Unauthorized</div>;
  }

  if (!experiment) {
    return <div className="p-8 text-center">Experiment not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="light"
          isIconOnly
          onPress={() => router.push("/admin/experiments")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-default-500">Trials for</p>
          <h1 className="text-2xl font-bold truncate">{experiment.name}</h1>
        </div>
        <Button
          variant="flat"
          onPress={() => router.push(`/admin/experiments/${experimentId}`)}
        >
          Edit Experiment
        </Button>
      </div>

      <TrialsTab experimentId={experimentId} />
    </div>
  );
}
