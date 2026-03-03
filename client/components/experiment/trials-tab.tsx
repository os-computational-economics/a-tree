"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Search, ChevronDown, Eye } from "lucide-react";
import { addToast } from "@heroui/toast";
import { api } from "@/lib/api/client";
import type { HistoryRow } from "@/lib/experiment/types";

interface TrialListItem {
  id: string;
  trialCode: string;
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

function TrialHistoryExpander({ trial }: { trial: TrialListItem }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!trial.historyTable || trial.historyTable.length === 0) {
    return <span className="text-xs text-default-400">No history</span>;
  }

  const allKeys = Array.from(
    trial.historyTable.reduce((keys, row) => {
      for (const k of Object.keys(row.values)) keys.add(k);
      return keys;
    }, new Set<string>()),
  );

  const columns = [
    { key: "round", label: "ROUND" },
    ...allKeys.map((k) => ({ key: k, label: k })),
  ];

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-primary hover:underline"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Eye className="w-3 h-3" />
        <span>{isOpen ? "Hide" : "View"} History ({trial.historyTable.length} rows)</span>
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
                      return <TableCell key="round">Round {idx + 1}</TableCell>;
                    }
                    return (
                      <TableCell key={col.key}>
                        <span className="text-sm font-mono">{formatValue(row.values[col.key] ?? null)}</span>
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

interface TrialsTabProps {
  experimentId: string;
}

export function TrialsTab({ experimentId }: TrialsTabProps) {
  const [trials, setTrials] = useState<TrialListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lookupCode, setLookupCode] = useState("");
  const [lookupResult, setLookupResult] = useState<{ trial: TrialListItem; experiment: { name: string } } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const fetchTrials = useCallback(async () => {
    try {
      const data = await api.get<{ trials: TrialListItem[] }>(
        `/api/admin/experiments/${experimentId}/trials`,
      );
      setTrials(data.trials);
    } catch {
      addToast({ title: "Failed to load trials", color: "danger" });
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    fetchTrials();
  }, [fetchTrials]);

  const filtered = useMemo(
    () => trials.filter((t) => t.trialCode.includes(search)),
    [trials, search],
  );

  const handleLookup = async () => {
    if (lookupCode.length !== 6) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const data = await api.get<{ trial: TrialListItem; experiment: { name: string } }>(
        `/api/admin/experiments/trials/lookup?code=${lookupCode}`,
      );
      setLookupResult(data);
    } catch {
      addToast({ title: "Trial not found", color: "danger" });
    } finally {
      setLookupLoading(false);
    }
  };

  const statusColorMap: Record<string, "warning" | "success" | "default"> = {
    in_progress: "warning",
    completed: "success",
  };

  if (loading) {
    return <Spinner size="lg" className="flex justify-center mt-10" />;
  }

  return (
    <div className="space-y-6">
      {/* Lookup by Code */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Lookup Trial by Code</h3>
        </CardHeader>
        <CardBody className="gap-4">
          <div className="flex items-end gap-2">
            <Input
              label="6-Digit Trial Code"
              placeholder="e.g. 042817"
              value={lookupCode}
              onValueChange={setLookupCode}
              maxLength={6}
              className="max-w-xs"
            />
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              disabled={lookupCode.length !== 6 || lookupLoading}
              onClick={handleLookup}
            >
              {lookupLoading ? "Searching..." : "Lookup"}
            </button>
          </div>
          {lookupResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Chip size="sm" variant="flat" color={statusColorMap[lookupResult.trial.status] || "default"}>
                  {lookupResult.trial.status}
                </Chip>
                <span className="text-sm font-mono font-bold">{lookupResult.trial.trialCode}</span>
                <span className="text-sm text-default-400">
                  {new Date(lookupResult.trial.createdAt).toLocaleString()}
                </span>
              </div>
              <TrialHistoryExpander trial={lookupResult.trial} />
            </div>
          )}
        </CardBody>
      </Card>

      {/* Trials List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            All Trials <Chip size="sm" variant="flat">{trials.length}</Chip>
          </h3>
          <Input
            placeholder="Filter by code..."
            startContent={<Search className="w-4 h-4 text-default-400" />}
            value={search}
            onValueChange={setSearch}
            className="max-w-xs"
          />
        </div>

        <Table aria-label="Trials table">
          <TableHeader>
            <TableColumn>TRIAL CODE</TableColumn>
            <TableColumn>STATUS</TableColumn>
            <TableColumn>STARTED</TableColumn>
            <TableColumn>LAST UPDATED</TableColumn>
            <TableColumn>HISTORY</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No trials yet.">
            {filtered.map((trial) => (
              <TableRow key={trial.id}>
                <TableCell>
                  <span className="font-mono font-bold">{trial.trialCode}</span>
                </TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={statusColorMap[trial.status] || "default"}
                  >
                    {trial.status}
                  </Chip>
                </TableCell>
                <TableCell>
                  {new Date(trial.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  {new Date(trial.updatedAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <TrialHistoryExpander trial={trial} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
