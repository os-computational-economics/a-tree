"use client";

import { useState, useEffect } from "react";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Dices, FunctionSquare, PenLine, History, ChevronDown, BookOpen } from "lucide-react";
import type { ParamDefinition, ResolvedParam, TemplateKind } from "@/lib/experiment/types";
import { renderTemplate } from "@/lib/experiment/template";

export const TEMPLATE_KIND_LABELS: Record<TemplateKind, string> = {
  intro: "Intro",
  decision: "Decision",
  result: "Result",
};

export const TEMPLATE_KIND_COLORS: Record<TemplateKind, "primary" | "secondary" | "success"> = {
  intro: "primary",
  decision: "secondary",
  result: "success",
};

export function ParamTypeIcon({ type }: { type: string }) {
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

export function formatValue(val: number | string | boolean | null): string {
  if (val === null) return "\u2014";
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(4);
  return String(val);
}

export function runValidation(
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

export function StudentInputField({
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

export function TemplateSegmentsRenderer({
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

export function GameGuidePanel({ html }: { html: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-divider rounded-lg overflow-hidden">
      <button
        type="button"
        className="flex items-center gap-2 w-full px-4 py-3 hover:bg-content2 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <BookOpen className="w-4 h-4 text-primary" />
        <span className="text-medium font-semibold">Game Guide</span>
        <div className="flex-1" />
        <ChevronDown className={`w-4 h-4 text-default-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          <div
            className="prose prose-sm dark:prose-invert max-w-none leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  );
}

export function ParamVisualization({
  resolvedParams,
  studentInputs,
  filterDisplayOnStudentSide,
}: {
  resolvedParams: Record<string, ResolvedParam>;
  studentInputs: Record<string, string | number>;
  filterDisplayOnStudentSide?: boolean;
}) {
  const visualizedEntries = Object.entries(resolvedParams).filter(
    ([, r]) => {
      if (!r.definition.visualize || typeof r.value !== "number") return false;
      if (filterDisplayOnStudentSide) return true;
      return true;
    },
  );

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
    <div className="space-y-3">
      {visualizedEntries.map(([id, r]) => {
        const raw = studentInputs[id] !== undefined ? Number(studentInputs[id]) : (r.value as number);
        const isNegative = raw < 0;
        const scaleMax = r.definition.visualizeMax != null ? r.definition.visualizeMax : autoMax;
        const pct = scaleMax > 0 ? Math.min((Math.abs(raw) / scaleMax) * 100, 100) : 0;
        const fraction = pct / 100;
        const clamped = Math.max(0, Math.min(1, fraction));
        const hue = clamped * 120;
        const color = isNegative ? "hsl(0, 75%, 45%)" : `hsl(${hue}, 75%, 45%)`;
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
    </div>
  );
}
