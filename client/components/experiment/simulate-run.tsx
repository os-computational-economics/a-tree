"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Tabs, Tab } from "@heroui/tabs";
import { Progress } from "@heroui/progress";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Dices, FunctionSquare, RefreshCw, ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import type { ExperimentConfig, ResolvedParam } from "@/lib/experiment/types";
import { resolveFullRun, resolveParameters } from "@/lib/experiment/params";
import { resolveTemplate, renderTemplate } from "@/lib/experiment/template";

interface SimulateRunProps {
  config: ExperimentConfig;
}

type RunEntry = {
  roundIndex: number;
  repIndex: number;
  roundId: string;
  repId: string;
  params: Record<string, ResolvedParam>;
};

function ParamTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "norm":
    case "unif":
      return <Dices className="w-3 h-3 text-warning" />;
    case "equation":
      return <FunctionSquare className="w-3 h-3 text-secondary" />;
    case "student_input":
      return <PenLine className="w-3 h-3 text-primary" />;
    default:
      return null;
  }
}

function formatValue(val: number | string | boolean | null): string {
  if (val === null) return "—";
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(4);
  return String(val);
}

function TableView({
  runData,
  config,
  onResample,
}: {
  runData: RunEntry[];
  config: ExperimentConfig;
  onResample: () => void;
}) {
  const allParamIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of runData) {
      for (const key of Object.keys(entry.params)) {
        ids.add(key);
      }
    }
    return Array.from(ids);
  }, [runData]);

  const columns = useMemo(() => {
    return [
      { key: "location", label: "ROUND / REP" },
      ...allParamIds.map((id) => ({ key: id, label: id })),
    ];
  }, [allParamIds]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="flat"
          startContent={<RefreshCw className="w-4 h-4" />}
          onPress={onResample}
        >
          Re-sample
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table aria-label="Simulation results" isStriped>
          <TableHeader columns={columns}>
            {(col) => (
              <TableColumn key={col.key} className={col.key === "location" ? "min-w-[120px]" : ""}>
                {col.key === "location" ? (
                  col.label
                ) : (
                  <div className="flex items-center gap-1">
                    {col.label}
                    {runData[0]?.params[col.key] && (
                      <ParamTypeIcon type={runData[0].params[col.key].definition.type} />
                    )}
                  </div>
                )}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody>
            {runData.map((entry) => {
              const roundLabel =
                config.rounds[entry.roundIndex]?.label || `Round ${entry.roundIndex + 1}`;
              return (
                <TableRow key={`${entry.roundId}-${entry.repId}`}>
                  {columns.map((col) => {
                    if (col.key === "location") {
                      return (
                        <TableCell key="location">
                          <div>
                            <span className="font-medium">{roundLabel}</span>
                            <span className="text-default-400">, Rep {entry.repIndex + 1}</span>
                          </div>
                        </TableCell>
                      );
                    }
                    const resolved = entry.params[col.key];
                    if (!resolved) {
                      return <TableCell key={col.key}>—</TableCell>;
                    }
                    return (
                      <TableCell key={col.key}>
                        <div className="flex items-center gap-1">
                          <ParamTypeIcon type={resolved.definition.type} />
                          <span>{formatValue(resolved.value)}</span>
                          {resolved.source !== "experiment" && (
                            <Chip size="sm" variant="dot" color="warning" className="ml-1">
                              {resolved.source}
                            </Chip>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StudentInputField({
  paramId,
  placeholder,
  inputType,
  value,
  onCommit,
}: {
  paramId: string;
  placeholder: string;
  inputType: string;
  value: string | number;
  onCommit: (paramId: string, value: string | number) => void;
}) {
  const [localValue, setLocalValue] = useState(String(value ?? ""));

  useEffect(() => {
    setLocalValue(String(value ?? ""));
  }, [value]);

  return (
    <Input
      size="sm"
      className="w-40 inline-flex"
      placeholder={placeholder}
      type={inputType === "number" ? "number" : "text"}
      value={localValue}
      onValueChange={setLocalValue}
      onBlur={() => {
        const committed = inputType === "number" ? Number(localValue) || 0 : localValue;
        onCommit(paramId, committed);
      }}
    />
  );
}

function StepThrough({ config }: { config: ExperimentConfig }) {
  const [currentRound, setCurrentRound] = useState(0);
  const [currentRep, setCurrentRep] = useState(0);
  const [studentInputs, setStudentInputs] = useState<Record<string, string | number>>({});
  const [resolvedParams, setResolvedParams] = useState<Record<string, ResolvedParam> | null>(
    null,
  );

  const totalSteps = useMemo(() => {
    return config.rounds.reduce((acc, r) => acc + r.repetitions.length, 0);
  }, [config]);

  const currentStep = useMemo(() => {
    let step = 0;
    for (let ri = 0; ri < currentRound; ri++) {
      step += config.rounds[ri].repetitions.length;
    }
    return step + currentRep + 1;
  }, [config, currentRound, currentRep]);

  const resolve = useCallback(() => {
    const params = resolveParameters(config, currentRound, currentRep, studentInputs);
    setResolvedParams(params);
  }, [config, currentRound, currentRep, studentInputs]);

  useMemo(() => {
    setStudentInputs({});
    const params = resolveParameters(config, currentRound, currentRep);
    setResolvedParams(params);
  }, [config, currentRound, currentRep]);

  const template = useMemo(() => {
    return resolveTemplate(config, currentRound, currentRep);
  }, [config, currentRound, currentRep]);

  const segments = useMemo(() => {
    if (!resolvedParams) return [];
    const merged = { ...resolvedParams };
    for (const [k, v] of Object.entries(studentInputs)) {
      if (merged[k]) {
        merged[k] = { ...merged[k], value: v };
      }
    }
    return renderTemplate(template, merged);
  }, [resolvedParams, template, studentInputs]);

  const allStudentInputsFilled = useMemo(() => {
    if (!resolvedParams) return true;
    const inputParams = Object.entries(resolvedParams).filter(
      ([, r]) => r.definition.type === "student_input",
    );
    if (inputParams.length === 0) return true;
    return inputParams.every(([id]) => {
      const v = studentInputs[id];
      return v !== undefined && v !== "";
    });
  }, [resolvedParams, studentInputs]);

  const goNext = () => {
    setStudentInputs({});
    const round = config.rounds[currentRound];
    if (currentRep < round.repetitions.length - 1) {
      setCurrentRep(currentRep + 1);
    } else if (currentRound < config.rounds.length - 1) {
      setCurrentRound(currentRound + 1);
      setCurrentRep(0);
    }
  };

  const goPrev = () => {
    setStudentInputs({});
    if (currentRep > 0) {
      setCurrentRep(currentRep - 1);
    } else if (currentRound > 0) {
      const prevRound = config.rounds[currentRound - 1];
      setCurrentRound(currentRound - 1);
      setCurrentRep(prevRound.repetitions.length - 1);
    }
  };

  const isFirst = currentRound === 0 && currentRep === 0;
  const isLast =
    currentRound === config.rounds.length - 1 &&
    currentRep === config.rounds[currentRound].repetitions.length - 1;

  const roundLabel =
    config.rounds[currentRound]?.label || `Round ${currentRound + 1}`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Chip variant="flat" color="primary">{roundLabel}</Chip>
            <Chip variant="flat">Repetition {currentRep + 1}</Chip>
          </div>
          <span className="text-sm text-default-400">
            Step {currentStep} of {totalSteps}
          </span>
        </div>
        <Progress value={(currentStep / totalSteps) * 100} size="sm" color="primary" />
      </div>

      <Card>
        <CardHeader>
          <h4 className="text-medium font-semibold">Student View</h4>
        </CardHeader>
        <CardBody>
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
            {segments.map((seg, i) => {
              if (seg.type === "text") {
                return <span key={i}>{seg.content}</span>;
              }
              if (seg.type === "value") {
                return (
                  <span key={i} className="inline-flex items-center gap-1 mx-0.5">
                    <Chip size="sm" variant="flat" color="primary">
                      <span className="flex items-center gap-1">
                        <ParamTypeIcon type={resolvedParams?.[seg.paramId]?.definition.type || "constant"} />
                        {formatValue(seg.value)}
                      </span>
                    </Chip>
                  </span>
                );
              }
              if (seg.type === "input") {
                const resolved = resolvedParams?.[seg.paramId];
                const inputType = resolved?.definition.type === "student_input"
                  ? (resolved.definition as { inputType?: string }).inputType || "text"
                  : "text";
                return (
                  <span key={i} className="inline-flex items-center mx-0.5">
                    <StudentInputField
                      paramId={seg.paramId}
                      placeholder={seg.inputLabel || seg.paramId}
                      inputType={inputType}
                      value={studentInputs[seg.paramId] ?? ""}
                      onCommit={(id, v) => {
                        setStudentInputs((prev) => ({ ...prev, [id]: v }));
                      }}
                    />
                  </span>
                );
              }
              return null;
            })}
          </div>
        </CardBody>
      </Card>

      {resolvedParams && (
        <Card>
          <CardHeader>
            <h4 className="text-medium font-semibold text-default-500">Resolved Parameters (Debug)</h4>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {Object.entries(resolvedParams).map(([id, r]) => (
                <Chip key={id} size="sm" variant="flat" color={r.source === "experiment" ? "default" : "warning"}>
                  <span className="flex items-center gap-1">
                    <ParamTypeIcon type={r.definition.type} />
                    {id} = {formatValue(studentInputs[id] !== undefined ? studentInputs[id] : r.value)}
                    <span className="text-tiny opacity-60">({r.source})</span>
                  </span>
                </Chip>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="flat"
          startContent={<ChevronLeft className="w-4 h-4" />}
          isDisabled={isFirst}
          onPress={goPrev}
        >
          Previous
        </Button>
        <Button
          color="primary"
          endContent={<ChevronRight className="w-4 h-4" />}
          isDisabled={isLast || !allStudentInputsFilled}
          onPress={goNext}
        >
          {isLast ? "Done" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

export function SimulateRun({ config }: SimulateRunProps) {
  const [runData, setRunData] = useState<RunEntry[]>(() => resolveFullRun(config));

  const handleResample = () => {
    setRunData(resolveFullRun(config));
  };

  return (
    <div className="space-y-6">
      <Tabs aria-label="Simulation views" variant="underlined">
        <Tab key="table" title="Table View">
          <TableView runData={runData} config={config} onResample={handleResample} />
        </Tab>
        <Tab key="step" title="Step-Through">
          <StepThrough config={config} />
        </Tab>
      </Tabs>
    </div>
  );
}
