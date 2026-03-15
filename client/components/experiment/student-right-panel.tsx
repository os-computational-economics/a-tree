"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Chip } from "@heroui/chip";
import { Progress } from "@heroui/progress";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { History } from "lucide-react";
import type { ExperimentConfig, HistoryRow, ResolvedParam, TemplateKind, FlatStepConfig } from "@/lib/experiment/types";
import { isFlatRoundStep } from "@/lib/experiment/types";
import { formatValue, ParamVisualization, TEMPLATE_KIND_LABELS, TEMPLATE_KIND_COLORS } from "./shared";

interface StudentRightPanelProps {
  config: ExperimentConfig;
  historyTable: HistoryRow[];
  flatConfig: FlatStepConfig[];
  resolvedParams: Record<string, ResolvedParam> | null;
  lastRoundResolvedParams: Record<string, ResolvedParam>;
  studentInputs: Record<string, string | number>;
  lastRoundStudentInputs: Record<string, string | number>;
  currentStepNumber: number;
  totalSteps: number;
  blockLabel: string;
  isStaticStep: boolean;
  roundIndex?: number;
  currentTemplateKind: TemplateKind;
}

function getDisplayableParamIds(config: ExperimentConfig): Set<string> {
  const ids = new Set<string>();
  for (const [id, def] of Object.entries(config.params)) {
    if (def.displayOnStudentSide) ids.add(id);
  }
  for (const block of config.blocks) {
    if (block.type === "static" || block.type === "information" || block.type === "ai_chat" || !block.params) continue;
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

function FilteredHistoryTable({
  historyTable,
  flatConfig,
  displayableIds,
}: {
  historyTable: HistoryRow[];
  flatConfig: FlatStepConfig[];
  displayableIds: Set<string>;
}) {
  const t = useTranslations("experimentRunner");
  const filteredKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of historyTable) {
      for (const k of Object.keys(row.values)) {
        if (displayableIds.has(k)) keys.add(k);
      }
    }
    return Array.from(keys);
  }, [historyTable, displayableIds]);

  if (historyTable.length === 0 || filteredKeys.length === 0) {
    return (
      <div className="flex items-center gap-2 text-default-400 text-sm py-4 justify-center">
        <History className="w-4 h-4" />
        <span>{t("noHistoryYet")}</span>
      </div>
    );
  }

  const columns = [
    { key: "round", label: t("roundColumn") },
    ...filteredKeys.map((k) => ({ key: k, label: k })),
  ];

  return (
    <div className="overflow-x-auto">
      <Table aria-label="History table" isStriped>
        <TableHeader columns={columns}>
          {(col) => <TableColumn key={col.key}>{col.label}</TableColumn>}
        </TableHeader>
        <TableBody>
          {historyTable.map((row, idx) => {
            const cfg = flatConfig[row.roundIndex];
            const label = cfg
              ? isFlatRoundStep(cfg)
                ? `${cfg.blockLabel || t("historyTable")}, R${cfg.roundIndex + 1}`
                : (cfg.blockLabel || t("static"))
              : t("round", { number: idx + 1 });
            return (
              <TableRow key={idx}>
                {columns.map((col) => {
                  if (col.key === "round") {
                    return <TableCell key="round"><span className="text-sm">{label}</span></TableCell>;
                  }
                  return (
                    <TableCell key={col.key}>
                      <span className="text-sm">{formatValue(row.values[col.key] ?? null)}</span>
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function StudentRightPanel({
  config,
  historyTable,
  flatConfig,
  resolvedParams,
  lastRoundResolvedParams,
  studentInputs,
  lastRoundStudentInputs,
  currentStepNumber,
  totalSteps,
  blockLabel,
  isStaticStep,
  roundIndex,
  currentTemplateKind,
}: StudentRightPanelProps) {
  const t = useTranslations("experimentRunner");
  const displayableIds = useMemo(() => getDisplayableParamIds(config), [config]);

  const hasCurrentParams = resolvedParams && Object.keys(resolvedParams).length > 0;
  const displayParams = hasCurrentParams ? resolvedParams : lastRoundResolvedParams;
  const displayStudentInputs = hasCurrentParams ? studentInputs : lastRoundStudentInputs;

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto p-4">
      {/* History Table */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <History className="w-4 h-4 text-success" />
          <h3 className="text-sm font-semibold text-default-500">{t("historyTable")}</h3>
          {historyTable.length > 0 && (
            <Chip size="sm" variant="flat">{historyTable.length}</Chip>
          )}
        </div>
        <FilteredHistoryTable
          historyTable={historyTable}
          flatConfig={flatConfig}
          displayableIds={displayableIds}
        />
      </div>

      {/* Game Progress / Round Indicator */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Chip variant="flat" color="primary" size="sm">{blockLabel}</Chip>
            {isStaticStep ? (
              <Chip variant="flat" color="secondary" size="sm">{t("static")}</Chip>
            ) : (
              <>
                {roundIndex !== undefined && (
                  <Chip variant="flat" size="sm">{t("round", { number: roundIndex + 1 })}</Chip>
                )}
                <Chip variant="flat" color={TEMPLATE_KIND_COLORS[currentTemplateKind]} size="sm">
                  {TEMPLATE_KIND_LABELS[currentTemplateKind]}
                </Chip>
              </>
            )}
          </div>
          <span className="text-sm font-medium text-default-500">
            {currentStepNumber} / {totalSteps}
          </span>
        </div>
        <Progress value={(currentStepNumber / totalSteps) * 100} size="lg" color="primary" />
      </div>

      {/* Parameter Visualization */}
      {displayParams && (
        <div>
          <h3 className="text-sm font-semibold text-default-500 mb-2">{t("parameters")}</h3>
          <ParamVisualization
            resolvedParams={displayParams}
            studentInputs={displayStudentInputs}
          />
        </div>
      )}
    </div>
  );
}
