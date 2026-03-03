"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
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
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Search, ChevronDown, Eye, MessageCircle, ExternalLink } from "lucide-react";
import { addToast } from "@heroui/toast";
import { api } from "@/lib/api/client";
import type { HistoryRow, ChatLogEntry } from "@/lib/experiment/types";

interface TrialListItem {
  id: string;
  trialCode: string;
  status: string;
  historyTable: HistoryRow[];
  chatLogs?: Record<string, ChatLogEntry[]>;
  createdAt: string;
  updatedAt: string;
}

function formatValue(val: number | string | boolean | null): string {
  if (val === null) return "\u2014";
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(4);
  return String(val);
}

function ChatLogsExpander({ chatLogs }: { chatLogs: Record<string, ChatLogEntry[]> }) {
  const [isOpen, setIsOpen] = useState(false);
  const blockIds = Object.keys(chatLogs).filter((k) => chatLogs[k].length > 0);

  if (blockIds.length === 0) return null;

  const totalMessages = blockIds.reduce((sum, k) => sum + chatLogs[k].length, 0);

  return (
    <div className="mt-2">
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-primary hover:underline"
        onClick={() => setIsOpen(!isOpen)}
      >
        <MessageCircle className="w-3 h-3" />
        <span>{isOpen ? "Hide" : "View"} Chat Logs ({totalMessages} messages)</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="mt-2 space-y-4">
          {blockIds.map((blockId) => (
            <div key={blockId} className="border border-divider rounded-lg p-3">
              <p className="text-xs font-semibold text-default-500 mb-2">Block: {blockId}</p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {chatLogs[blockId].map((entry, i) => (
                  <div
                    key={i}
                    className={`text-sm p-2 rounded-lg ${
                      entry.role === "user"
                        ? "bg-primary/10 text-primary ml-8"
                        : "bg-default-100 mr-8"
                    }`}
                  >
                    <span className="text-xs font-semibold block mb-1">
                      {entry.role === "user" ? "Student" : "AI"}
                      {" · "}
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <p className="whitespace-pre-wrap">{entry.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
      {trial.chatLogs && <ChatLogsExpander chatLogs={trial.chatLogs} />}
    </div>
  );
}

function TrialDetailModal({
  trial,
  isOpen,
  onOpenChange,
  statusColorMap,
}: {
  trial: TrialListItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  statusColorMap: Record<string, "warning" | "success" | "default">;
}) {
  if (!trial) return null;

  const allKeys = Array.from(
    trial.historyTable.reduce((keys, row) => {
      for (const k of Object.keys(row.values)) keys.add(k);
      return keys;
    }, new Set<string>()),
  );

  const historyColumns = [
    { key: "round", label: "ROUND" },
    ...allKeys.map((k) => ({ key: k, label: k })),
  ];

  const chatBlockIds = trial.chatLogs
    ? Object.keys(trial.chatLogs).filter((k) => trial.chatLogs![k].length > 0)
    : [];
  const totalMessages = chatBlockIds.reduce(
    (sum, k) => sum + trial.chatLogs![k].length,
    0,
  );

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="5xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="font-mono text-lg">{trial.trialCode}</span>
                <Chip
                  size="sm"
                  variant="flat"
                  color={statusColorMap[trial.status] || "default"}
                >
                  {trial.status}
                </Chip>
              </div>
            </ModalHeader>
            <ModalBody className="gap-6">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-default-100 p-3">
                  <p className="text-xs text-default-500 mb-1">Started</p>
                  <p className="text-sm font-medium">{new Date(trial.createdAt).toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-default-100 p-3">
                  <p className="text-xs text-default-500 mb-1">Last Updated</p>
                  <p className="text-sm font-medium">{new Date(trial.updatedAt).toLocaleString()}</p>
                </div>
              </div>

              {/* History Table */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  History ({trial.historyTable.length} rounds)
                </h4>
                {trial.historyTable.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table aria-label="Trial history detail" isStriped>
                      <TableHeader columns={historyColumns}>
                        {(col) => <TableColumn key={col.key}>{col.label}</TableColumn>}
                      </TableHeader>
                      <TableBody>
                        {trial.historyTable.map((row, idx) => (
                          <TableRow key={idx}>
                            {historyColumns.map((col) => {
                              if (col.key === "round") {
                                return <TableCell key="round">Round {idx + 1}</TableCell>;
                              }
                              return (
                                <TableCell key={col.key}>
                                  <span className="text-sm font-mono">
                                    {formatValue(row.values[col.key] ?? null)}
                                  </span>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-default-400">No history recorded.</p>
                )}
              </div>

              {/* Chat Logs */}
              {chatBlockIds.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Chat Logs ({totalMessages} messages)
                  </h4>
                  <div className="space-y-4">
                    {chatBlockIds.map((blockId) => (
                      <div key={blockId} className="border border-divider rounded-lg p-3">
                        <p className="text-xs font-semibold text-default-500 mb-2">
                          Block: {blockId}
                        </p>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {trial.chatLogs![blockId].map((entry, i) => (
                            <div
                              key={i}
                              className={`text-sm p-2 rounded-lg ${
                                entry.role === "user"
                                  ? "bg-primary/10 text-primary ml-8"
                                  : "bg-default-100 mr-8"
                              }`}
                            >
                              <span className="text-xs font-semibold block mb-1">
                                {entry.role === "user" ? "Student" : "AI"}
                                {" · "}
                                {new Date(entry.timestamp).toLocaleTimeString()}
                              </span>
                              <p className="whitespace-pre-wrap">{entry.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

const statusRowBg: Record<string, string> = {
  completed: "bg-success-50/50 dark:bg-success-100/10",
  in_progress: "bg-warning-50/50 dark:bg-warning-100/10",
};

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
  const [selectedTrial, setSelectedTrial] = useState<TrialListItem | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

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

  const handleViewDetail = (trial: TrialListItem) => {
    setSelectedTrial(trial);
    onOpen();
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

        <Table
          aria-label="Trials table"
          classNames={{
            tr: "border-b border-divider last:border-b-0",
          }}
        >
          <TableHeader>
            <TableColumn>TRIAL CODE</TableColumn>
            <TableColumn>STATUS</TableColumn>
            <TableColumn>STARTED</TableColumn>
            <TableColumn>LAST UPDATED</TableColumn>
            <TableColumn>ACTIONS</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No trials yet.">
            {filtered.map((trial, idx) => (
              <TableRow
                key={trial.id}
                className={`${
                  statusRowBg[trial.status] || (idx % 2 === 0 ? "bg-default-50" : "")
                } transition-colors hover:bg-default-100`}
              >
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
                  <Button
                    size="sm"
                    variant="light"
                    color="primary"
                    startContent={<ExternalLink className="w-3.5 h-3.5" />}
                    onPress={() => handleViewDetail(trial)}
                  >
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TrialDetailModal
        trial={selectedTrial}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        statusColorMap={statusColorMap}
      />
    </div>
  );
}
