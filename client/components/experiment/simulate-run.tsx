"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
import { Dices, FunctionSquare, ChevronLeft, ChevronRight, PenLine, History, ChevronDown, BookOpen } from "lucide-react";
import type { ExperimentConfig, ParamDefinition, ParamSource, ResolvedParam, TemplateKind, HistoryRow, FlatRoundConfig, FlatStepConfig } from "@/lib/experiment/types";
import { TEMPLATE_KINDS, isFlatRoundStep, isFlatStaticStep, isFlatAiChatStep } from "@/lib/experiment/types";
import { renderTemplate } from "@/lib/experiment/template";
import { GameEngine } from "@/lib/experiment/engine";
import { flattenConfig } from "@/lib/experiment/flatten";

interface SimulateRunProps {
  config: ExperimentConfig;
}

const TEMPLATE_KIND_LABELS: Record<TemplateKind, string> = {
  intro: "Intro",
  decision: "Decision",
  result: "Result",
};

const TEMPLATE_KIND_COLORS: Record<TemplateKind, "primary" | "secondary" | "success"> = {
  intro: "primary",
  decision: "secondary",
  result: "success",
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
    case "history":
      return <History className="w-3 h-3 text-success" />;
    default:
      return null;
  }
}

function formatValue(val: number | string | boolean | null): string {
  if (val === null) return "\u2014";
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(4);
  return String(val);
}

/**
 * Run a validation expression for a student input.
 * {{this}} is replaced with the input value; {{param_id}} with resolved param values.
 * Returns true if valid, false if invalid, true if no validation defined.
 */
function runValidation(
  validationExpr: string | undefined,
  inputValue: string | number,
  resolvedParams: Record<string, ResolvedParam> | null,
  studentInputs: Record<string, string | number>,
): boolean {
  if (!validationExpr) return true;
  if (inputValue === "" || inputValue === undefined) return true;
  try {
    const scope: Record<string, number | string | boolean> = {};
    if (resolvedParams) {
      for (const [id, r] of Object.entries(resolvedParams)) {
        if (r.value !== null) scope[id] = r.value;
      }
    }
    for (const [id, v] of Object.entries(studentInputs)) {
      scope[id] = v;
    }
    const thisVal = typeof inputValue === "number" ? inputValue : inputValue;
    const expr = validationExpr
      .replace(/\{\{this\}\}/g, "__inputVal__")
      .replace(/\{\{(\w+)\}\}/g, (_, id) => id);
    const keys = ["Math", "__inputVal__", ...Object.keys(scope)];
    const values = [Math, thisVal, ...Object.keys(scope).map((k) => scope[k])];
    const fn = new Function(...keys, `"use strict"; return !!(${expr});`);
    return fn(...values);
  } catch {
    return true;
  }
}

function formatDefinition(def: ParamDefinition): string {
  switch (def.type) {
    case "constant":
      return String(def.value);
    case "norm":
      return `norm(\u03BC=${def.mean}, \u03C3=${def.std})`;
    case "unif":
      return `unif(${def.min}, ${def.max})`;
    case "equation":
      return def.expression || "(empty)";
    case "student_input":
      return `input(${def.inputType || "text"})`;
    case "history":
      return def.expression || "(empty)";
    default:
      return "?";
  }
}

/* ---------- Table View (flattened config inspector) ---------- */

function TableView({ config }: { config: ExperimentConfig }) {
  const flatSteps = useMemo(() => flattenConfig(config), [config]);

  const allParamIds = useMemo(() => {
    const ids = new Set<string>();
    for (const step of flatSteps) {
      if (isFlatRoundStep(step)) {
        for (const key of Object.keys(step.params)) {
          ids.add(key);
        }
      }
    }
    return Array.from(ids);
  }, [flatSteps]);

  const columns = useMemo(() => {
    return [
      { key: "location", label: "BLOCK / ROUND" },
      ...allParamIds.map((id) => ({ key: id, label: id })),
    ];
  }, [allParamIds]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-default-500">
        Flattened parameter definitions for each round after merging experiment, block, and round overrides.
      </p>
      <div className="overflow-x-auto">
        <Table aria-label="Flattened config" isStriped>
          <TableHeader columns={columns}>
            {(col) => (
              <TableColumn key={col.key} className={col.key === "location" ? "min-w-[120px]" : ""}>
                {col.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody>
            {flatSteps.map((step) => {
              if (isFlatStaticStep(step)) {
                return (
                  <TableRow key={step.blockId}>
                    {[
                      <TableCell key="location">
                        <div>
                          <Chip size="sm" variant="flat" color="secondary">Static</Chip>
                          <span className="font-medium ml-2">{step.title || step.blockLabel || `Block ${step.blockIndex + 1}`}</span>
                        </div>
                      </TableCell>,
                      ...allParamIds.map((id) => (
                        <TableCell key={id}>{"\u2014"}</TableCell>
                      )),
                    ]}
                  </TableRow>
                );
              }
              if (isFlatAiChatStep(step)) {
                return (
                  <TableRow key={step.blockId}>
                    {[
                      <TableCell key="location">
                        <div>
                          <Chip size="sm" variant="flat" color="primary">AI Chat</Chip>
                          <span className="font-medium ml-2">{step.blockLabel || `Block ${step.blockIndex + 1}`}</span>
                        </div>
                      </TableCell>,
                      ...allParamIds.map((id) => (
                        <TableCell key={id}>{"\u2014"}</TableCell>
                      )),
                    ]}
                  </TableRow>
                );
              }
              const blockLabel = step.blockLabel || `Block ${step.blockIndex + 1}`;
              return (
                <TableRow key={`${step.blockId}-${step.roundId}`}>
                  {columns.map((col) => {
                    if (col.key === "location") {
                      return (
                        <TableCell key="location">
                          <div>
                            <span className="font-medium">{blockLabel}</span>
                            <span className="text-default-400">, Round {step.roundIndex + 1}</span>
                          </div>
                        </TableCell>
                      );
                    }
                    const entry = step.params[col.key];
                    if (!entry) {
                      return <TableCell key={col.key}>{"\u2014"}</TableCell>;
                    }
                    return (
                      <TableCell key={col.key}>
                        <div className="flex items-center gap-1">
                          <ParamTypeIcon type={entry.def.type} />
                          <span className="text-sm font-mono">{formatDefinition(entry.def)}</span>
                          {entry.source !== "experiment" && (
                            <Chip size="sm" variant="dot" color="warning" className="ml-1">
                              {entry.source}
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

/* ---------- Student Input Field ---------- */

function StudentInputField({
  paramId,
  placeholder,
  inputType,
  value,
  onCommit,
  onReset,
  isLocked,
  isConfirmed,
  isInvalid,
  validationHint,
}: {
  paramId: string;
  placeholder: string;
  inputType: string;
  value: string | number;
  onCommit: (paramId: string, value: string | number) => void;
  onReset: (paramId: string) => void;
  isLocked: boolean;
  isConfirmed: boolean;
  isInvalid?: boolean;
  validationHint?: string;
}) {
  const [localValue, setLocalValue] = useState(String(value ?? ""));

  useEffect(() => {
    setLocalValue(String(value ?? ""));
  }, [value]);

  if (isLocked) {
    const hasValue = value !== "" && value !== undefined && value !== null;
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-content2 px-2 py-1">
        <span className={`text-sm font-mono ${hasValue ? "" : "text-default-400"}`}>
          {hasValue ? formatValue(value) : placeholder}
        </span>
        {isConfirmed ? (
          <Chip size="sm" variant="flat" color="success" className="ml-0.5">Confirmed</Chip>
        ) : (
          <button
            type="button"
            className="p-0.5 rounded hover:bg-content3 text-default-400 hover:text-primary transition-colors"
            onClick={() => onReset(paramId)}
            aria-label={`Edit ${paramId}`}
          >
            <PenLine className="w-3.5 h-3.5" />
          </button>
        )}
      </span>
    );
  }

  const hasInput = localValue !== "";

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        size="sm"
        className="w-40 inline-flex"
        placeholder={placeholder}
        type={inputType === "number" ? "number" : "text"}
        value={localValue}
        onValueChange={setLocalValue}
        isInvalid={isInvalid}
        errorMessage={isInvalid ? (validationHint || "Invalid value") : undefined}
        autoFocus
      />
      <Button
        size="sm"
        color="success"
        variant="flat"
        isDisabled={!hasInput}
        onPress={() => {
          const committed = inputType === "number" ? Number(localValue) || 0 : localValue;
          onCommit(paramId, committed);
        }}
      >
        Confirm
      </Button>
    </span>
  );
}

/* ---------- Template Segments Renderer ---------- */

function TemplateSegmentsRenderer({
  segments,
  resolvedParams,
  studentInputs,
  editingInputs,
  confirmedInputs,
  onStudentInput,
  onResetInput,
  validationErrors,
}: {
  segments: ReturnType<typeof renderTemplate>;
  resolvedParams: Record<string, ResolvedParam> | null;
  studentInputs: Record<string, string | number>;
  editingInputs: ReadonlySet<string>;
  confirmedInputs: ReadonlySet<string>;
  onStudentInput: (id: string, v: string | number) => void;
  onResetInput: (id: string) => void;
  validationErrors?: Set<string>;
}) {
  return (
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
          const validation = seg.validation;
          return (
            <span key={i} className="inline-flex items-center mx-0.5">
              <StudentInputField
                paramId={seg.paramId}
                placeholder={seg.inputLabel || seg.paramId}
                inputType={inputType}
                value={studentInputs[seg.paramId] ?? ""}
                onCommit={onStudentInput}
                onReset={onResetInput}
                isLocked={!editingInputs.has(seg.paramId)}
                isConfirmed={confirmedInputs.has(seg.paramId)}
                isInvalid={validationErrors?.has(seg.paramId)}
                validationHint={validation ? `Required: ${validation}` : undefined}
              />
            </span>
          );
        }
        return null;
      })}
    </div>
  );
}

/* ---------- History Table Debug View ---------- */

function HistoryTableView({
  historyTable,
  flatConfig,
}: {
  historyTable: HistoryRow[];
  flatConfig: { type?: string; blockLabel?: string; roundIndex?: number }[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of historyTable) {
      for (const k of Object.keys(row.values)) keys.add(k);
    }
    return Array.from(keys);
  }, [historyTable]);

  if (historyTable.length === 0) return null;

  const columns = [
    { key: "round", label: "ROUND" },
    ...allKeys.map((k) => ({ key: k, label: k })),
  ];

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 w-full">
          <History className="w-4 h-4 text-success" />
          <h4 className="text-medium font-semibold text-default-500">History Table</h4>
          <Chip size="sm" variant="flat">{historyTable.length} row{historyTable.length !== 1 ? "s" : ""}</Chip>
          <div className="flex-1" />
          <ChevronDown className={`w-4 h-4 text-default-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </CardHeader>
      {isOpen && (
        <CardBody>
          <div className="overflow-x-auto">
            <Table aria-label="History table" isStriped>
              <TableHeader columns={columns}>
                {(col) => <TableColumn key={col.key}>{col.label}</TableColumn>}
              </TableHeader>
              <TableBody>
                {historyTable.map((row, idx) => {
                  const cfg = flatConfig[row.roundIndex];
                  const label = cfg
                    ? cfg.type === "static"
                      ? `${cfg.blockLabel || "Static"}`
                      : `${cfg.blockLabel || "Block"}, R${(cfg.roundIndex ?? 0) + 1}`
                    : `Round ${idx + 1}`;
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
        </CardBody>
      )}
    </Card>
  );
}

/* ---------- Param Visualization Bars ---------- */

/**
 * Interpolate bar color from red (0%) → yellow (50%) → green (100%)
 * using HSL hue rotation: 0° = red, 60° = yellow, 120° = green.
 */
function barHsl(fraction: number): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  const hue = clamped * 120; // 0 = red, 120 = green
  return `hsl(${hue}, 75%, 45%)`;
}

function ParamVisualization({
  resolvedParams,
  studentInputs,
}: {
  resolvedParams: Record<string, ResolvedParam>;
  studentInputs: Record<string, string | number>;
}) {
  const visualizedEntries = useMemo(() => {
    return Object.entries(resolvedParams).filter(
      ([, r]) => r.definition.visualize && typeof r.value === "number",
    );
  }, [resolvedParams]);

  if (visualizedEntries.length === 0) return null;

  const autoMax = Math.max(
    ...visualizedEntries
      .filter(([, r]) => r.definition.visualizeMax == null)
      .map(([id, r]) => {
        const v = studentInputs[id] !== undefined ? Number(studentInputs[id]) : (r.value as number);
        return Math.abs(v);
      }),
    1,
  );

  return (
    <Card>
      <CardBody className="gap-3">
        {visualizedEntries.map(([id, r]) => {
          const raw = studentInputs[id] !== undefined ? Number(studentInputs[id]) : (r.value as number);
          const isNegative = raw < 0;
          const scaleMax = r.definition.visualizeMax != null ? r.definition.visualizeMax : autoMax;
          const pct = scaleMax > 0 ? Math.min((Math.abs(raw) / scaleMax) * 100, 100) : 0;
          const fraction = pct / 100;
          const color = isNegative ? "hsl(0, 75%, 45%)" : barHsl(fraction);
          const label = id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

          return (
            <div key={id} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{label}</span>
                <span className={`text-sm font-mono font-semibold ${isNegative ? "text-red-500" : ""}`}>
                  {Number.isInteger(raw) ? String(raw) : raw.toFixed(2)}
                </span>
              </div>
              <div className="h-4 w-full rounded-full bg-content2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

/* ---------- Game Guide Panel ---------- */

function GameGuidePanel({ html }: { html: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 w-full">
          <BookOpen className="w-4 h-4 text-primary" />
          <h4 className="text-medium font-semibold">Game Guide</h4>
          <div className="flex-1" />
          <ChevronDown className={`w-4 h-4 text-default-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </CardHeader>
      {isOpen && (
        <CardBody>
          <div
            className="prose prose-sm dark:prose-invert max-w-none leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </CardBody>
      )}
    </Card>
  );
}

/* ---------- Step-Through (refactored with GameEngine) ---------- */

function StepThrough({ config }: { config: ExperimentConfig }) {
  const engineRef = useRef<GameEngine>(new GameEngine(config));
  const [, forceUpdate] = useState(0);
  const rerender = useCallback(() => forceUpdate((n) => n + 1), []);

  const [studentInputs, setStudentInputs] = useState<Record<string, string | number>>({});
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [editingInputs, setEditingInputs] = useState<Set<string>>(new Set());
  const [confirmedInputs, setConfirmedInputs] = useState<Set<string>>(new Set());

  // Reset engine when config changes
  useEffect(() => {
    engineRef.current = new GameEngine(config);
    setStudentInputs({});
    setValidationErrors(new Set());
    setEditingInputs(new Set());
    setConfirmedInputs(new Set());
    rerender();
  }, [config, rerender]);

  const engine = engineRef.current;
  const currentStep = engine.getCurrentStep();
  const currentRound = engine.getCurrentRound();
  const isStaticStep = currentStep && isFlatStaticStep(currentStep);
  const isAiChatStep = currentStep && isFlatAiChatStep(currentStep);
  const resolvedParams = engine.getResolvedParams();
  const currentTemplateIndex = engine.getCurrentTemplateIndex();
  const currentTemplateKind = engine.getCurrentTemplateKind();
  const historyTable = engine.getHistoryTable();
  const totalSteps = engine.getTotalSteps();
  const currentStepNumber = engine.getCurrentStepNumber();

  const blockLabel = isStaticStep
    ? (currentStep.blockLabel || currentStep.title || `Block ${currentStep.blockIndex + 1}`)
    : isAiChatStep
      ? (currentStep.blockLabel || `AI Chat Block ${currentStep.blockIndex + 1}`)
      : (currentRound?.blockLabel || `Block ${(currentRound?.blockIndex ?? 0) + 1}`);

  const segmentsByKind = useMemo((): Partial<Record<TemplateKind, ReturnType<typeof renderTemplate>>> => {
    if (!resolvedParams || !currentRound || isStaticStep || isAiChatStep) return {};
    const forRendering = { ...resolvedParams };
    for (const [k, r] of Object.entries(forRendering)) {
      if (r.definition.type === "student_input") {
        forRendering[k] = { ...r, value: null };
      }
    }
    const result: Partial<Record<TemplateKind, ReturnType<typeof renderTemplate>>> = {};
    const templateFields: Record<TemplateKind, string> = {
      intro: currentRound.introTemplate,
      decision: currentRound.decisionTemplate,
      result: currentRound.resultTemplate,
    };
    for (const kind of TEMPLATE_KINDS) {
      result[kind] = renderTemplate(templateFields[kind], forRendering);
    }
    return result;
  }, [resolvedParams, currentRound, isStaticStep, isAiChatStep]);

  const studentInputParamIds = useMemo(() => {
    if (!resolvedParams || !currentRound || isStaticStep || isAiChatStep) return [];
    const activeKind = TEMPLATE_KINDS[currentTemplateIndex];
    const templateFields: Record<TemplateKind, string> = {
      intro: currentRound.introTemplate,
      decision: currentRound.decisionTemplate,
      result: currentRound.resultTemplate,
    };
    const template = templateFields[activeKind];
    const ids: string[] = [];
    const re = /\{\{(\w+)\}\}/g;
    let m;
    while ((m = re.exec(template)) !== null) {
      const id = m[1];
      if (resolvedParams[id]?.definition.type === "student_input") {
        ids.push(id);
      }
    }
    return ids;
  }, [resolvedParams, currentRound, currentTemplateIndex, isStaticStep, isAiChatStep]);

  const allInputsValid = useMemo(() => {
    if (isStaticStep || isAiChatStep) return true;
    if (studentInputParamIds.length === 0) return true;
    if (validationErrors.size > 0) return false;
    return studentInputParamIds.every(
      (id) => confirmedInputs.has(id),
    );
  }, [studentInputParamIds, confirmedInputs, validationErrors, isStaticStep, isAiChatStep]);

  const handleStudentInput = useCallback((id: string, v: string | number) => {
    if (v === "" || v === undefined) {
      setValidationErrors((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    const def = resolvedParams?.[id]?.definition;
    if (def?.type === "student_input" && def.validation) {
      const valid = runValidation(def.validation, v, resolvedParams, studentInputs);
      if (!valid) {
        setValidationErrors((prev) => new Set(prev).add(id));
        return;
      }
    }

    setValidationErrors((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setEditingInputs((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setConfirmedInputs((prev) => new Set(prev).add(id));
    setStudentInputs((prev) => {
      const next = { ...prev, [id]: v };
      engine.recalculate(next);
      rerender();
      return next;
    });
  }, [engine, rerender, resolvedParams, studentInputs]);

  const handleResetInput = useCallback((id: string) => {
    setEditingInputs((prev) => new Set(prev).add(id));
    setValidationErrors((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setStudentInputs((prev) => {
      const { [id]: _, ...rest } = prev;
      engine.recalculate(rest);
      rerender();
      return rest;
    });
  }, [engine, rerender]);

  const goNext = useCallback(() => {
    engine.advance(studentInputs);
    setStudentInputs(engine.getStudentInputs());
    setValidationErrors(new Set());
    setEditingInputs(new Set());
    setConfirmedInputs(new Set());
    rerender();
  }, [engine, studentInputs, rerender]);

  const goPrev = useCallback(() => {
    engine.goBack();
    setStudentInputs(engine.getStudentInputs());
    setValidationErrors(new Set());
    setEditingInputs(new Set());
    setConfirmedInputs(new Set());
    rerender();
  }, [engine, rerender]);

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Chip variant="flat" color="primary">{blockLabel}</Chip>
            {isStaticStep ? (
              <Chip variant="flat" color="secondary">Static</Chip>
            ) : isAiChatStep ? (
              <Chip variant="flat" color="primary">AI Chat</Chip>
            ) : (
              <>
                <Chip variant="flat">Round {(currentRound?.roundIndex ?? 0) + 1}</Chip>
                <Chip variant="flat" color={TEMPLATE_KIND_COLORS[currentTemplateKind]}>
                  {TEMPLATE_KIND_LABELS[currentTemplateKind]}
                </Chip>
              </>
            )}
          </div>
          <span className="text-sm text-default-400">
            Step {currentStepNumber} of {totalSteps}
          </span>
        </div>
        <Progress value={(currentStepNumber / totalSteps) * 100} size="sm" color="primary" />
      </div>

      {/* Game Guide (collapsible, always accessible) */}
      {config.gameGuide && (
        <GameGuidePanel html={config.gameGuide} />
      )}

      {/* Static Block Content */}
      {isStaticStep && (
        <Card>
          <CardHeader>
            <h4 className="text-lg font-semibold">{currentStep.title}</h4>
          </CardHeader>
          <CardBody>
            <div
              className="prose prose-sm dark:prose-invert max-w-none leading-relaxed"
              dangerouslySetInnerHTML={{ __html: currentStep.body }}
            />
          </CardBody>
        </Card>
      )}

      {/* AI Chat Block Placeholder */}
      {isAiChatStep && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Chip size="sm" variant="flat" color="primary">AI Chat</Chip>
              <h4 className="text-lg font-semibold">{currentStep.blockLabel || "AI Chat"}</h4>
            </div>
          </CardHeader>
          <CardBody>
            <div className="text-center text-default-400 py-8">
              <p className="text-sm">AI Chat interaction is not available during simulation.</p>
              <p className="text-xs mt-1">Students will see an interactive AI chat here.</p>
              {currentStep.systemPromptTemplate && (
                <div className="mt-4 text-left">
                  <p className="text-xs font-semibold text-default-500 mb-1">System Prompt Template:</p>
                  <pre className="text-xs bg-content2 p-3 rounded-lg whitespace-pre-wrap overflow-x-auto">
                    {currentStep.systemPromptTemplate}
                  </pre>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Template Cards (round steps only) */}
      {!isStaticStep && !isAiChatStep && TEMPLATE_KINDS.map((kind, kindIdx) => {
        const kindSegments = segmentsByKind[kind];
        if (!kindSegments || kindSegments.length === 0) return null;
        const hasContent = kindSegments.some(
          (s) => s.type !== "text" || s.content.trim().length > 0,
        );
        if (!hasContent) return null;

        const isActive = kindIdx === currentTemplateIndex;
        const isPast = kindIdx < currentTemplateIndex;
        const isFuture = kindIdx > currentTemplateIndex;

        let cardClasses = "transition-all duration-200";
        if (isFuture) cardClasses += " opacity-30 pointer-events-none";
        else if (isPast) cardClasses += " opacity-60";

        return (
          <Card key={kind} className={cardClasses}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Chip size="sm" variant={isActive ? "solid" : "flat"} color={TEMPLATE_KIND_COLORS[kind]}>
                  {TEMPLATE_KIND_LABELS[kind]}
                </Chip>
                {isActive && <h4 className="text-medium font-semibold">Active</h4>}
                {isPast && <span className="text-sm text-default-400">Completed</span>}
                {isFuture && <span className="text-sm text-default-400">Upcoming</span>}
              </div>
            </CardHeader>
            <CardBody>
              <TemplateSegmentsRenderer
                segments={kindSegments}
                resolvedParams={resolvedParams}
                studentInputs={studentInputs}
                editingInputs={editingInputs}
                confirmedInputs={confirmedInputs}
                onStudentInput={handleStudentInput}
                onResetInput={handleResetInput}
                validationErrors={!isFuture ? validationErrors : undefined}
              />
            </CardBody>
          </Card>
        );
      })}

      {/* Parameter Visualization Bars (round steps only) */}
      {!isStaticStep && !isAiChatStep && resolvedParams && (
        <ParamVisualization
          resolvedParams={resolvedParams}
          studentInputs={studentInputs}
        />
      )}

      {/* Resolved Parameters Debug (round steps only) */}
      {!isStaticStep && !isAiChatStep && resolvedParams && (
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

      {/* History Table */}
      <HistoryTableView
        historyTable={historyTable}
        flatConfig={engine.getFlatConfig().map((r) => ({
          type: r.type,
          blockLabel: r.blockLabel,
          roundIndex: isFlatRoundStep(r) ? r.roundIndex : undefined,
        }))}
      />

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="flat"
          startContent={<ChevronLeft className="w-4 h-4" />}
          isDisabled={engine.isFirst()}
          onPress={goPrev}
        >
          Previous
        </Button>
        <Button
          color="primary"
          endContent={<ChevronRight className="w-4 h-4" />}
          isDisabled={engine.isFinished() || !allInputsValid}
          onPress={goNext}
        >
          {engine.isFinished() ? "Done" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

/* ---------- Main Export ---------- */

export function SimulateRun({ config }: SimulateRunProps) {
  return (
    <div className="space-y-6">
      <Tabs aria-label="Simulation views" variant="underlined">
        <Tab key="table" title="Table View">
          <TableView config={config} />
        </Tab>
        <Tab key="step" title="Step-Through">
          <StepThrough config={config} />
        </Tab>
      </Tabs>
    </div>
  );
}
