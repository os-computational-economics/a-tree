"use client";

import { useMemo } from "react";
import { Button } from "@heroui/button";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { LogOut } from "lucide-react";
import type { HistoryRow, ExperimentConfig } from "@/lib/experiment/types";
import { formatValue } from "./shared";

interface StudentCompletionProps {
  trialCode: string;
  historyTable: HistoryRow[];
  config: ExperimentConfig;
  onExit: () => void;
}

function getDisplayableParamIds(config: ExperimentConfig): Set<string> {
  const ids = new Set<string>();
  for (const [id, def] of Object.entries(config.params)) {
    if (def.displayOnStudentSide) ids.add(id);
  }
  for (const block of config.blocks) {
    if (block.type === "static" || !block.params) continue;
    for (const [id, def] of Object.entries(block.params)) {
      if (def.displayOnStudentSide) ids.add(id);
    }
    for (const round of block.rounds) {
      if (!round.params) continue;
      for (const [id, def] of Object.entries(round.params)) {
        if (def.displayOnStudentSide) ids.add(id);
      }
    }
  }
  return ids;
}

export function StudentCompletion({ trialCode, historyTable, config, onExit }: StudentCompletionProps) {
  const displayableIds = useMemo(() => getDisplayableParamIds(config), [config]);

  const filteredKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of historyTable) {
      for (const k of Object.keys(row.values)) {
        if (displayableIds.has(k)) keys.add(k);
      }
    }
    return Array.from(keys);
  }, [historyTable, displayableIds]);

  const columns = [
    { key: "round", label: "ROUND" },
    ...filteredKeys.map((k) => ({ key: k, label: k })),
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8">
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-default-600">Experiment Complete</h1>
          <div className="space-y-2">
            <p className="text-lg text-default-500">Your Experiment ID is</p>
            <p className="text-5xl font-mono font-bold text-primary tracking-widest">{trialCode}</p>
          </div>
        </div>

        {historyTable.length > 0 && filteredKeys.length > 0 && (
          <div className="overflow-x-auto">
            <Table aria-label="Experiment results" isStriped>
              <TableHeader columns={columns}>
                {(col) => <TableColumn key={col.key}>{col.label}</TableColumn>}
              </TableHeader>
              <TableBody>
                {historyTable.map((row, idx) => (
                  <TableRow key={idx}>
                    {columns.map((col) => {
                      if (col.key === "round") {
                        return <TableCell key="round">Round {idx + 1}</TableCell>;
                      }
                      return (
                        <TableCell key={col.key}>
                          {formatValue(row.values[col.key] ?? null)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex justify-center">
          <Button
            color="primary"
            variant="flat"
            startContent={<LogOut className="w-4 h-4" />}
            onPress={onExit}
          >
            Exit
          </Button>
        </div>
      </div>
    </div>
  );
}
