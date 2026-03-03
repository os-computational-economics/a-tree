"use client";

import { useMemo } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import type {
  FlatRoundConfig,
  FlatStaticBlockConfig,
  FlatAiChatBlockConfig,
  FlatStepConfig,
  ResolvedParam,
  TemplateKind,
  ChatLogEntry,
} from "@/lib/experiment/types";
import { TEMPLATE_KINDS, isFlatStaticStep, isFlatAiChatStep } from "@/lib/experiment/types";
import { renderTemplate } from "@/lib/experiment/template";
import {
  TEMPLATE_KIND_LABELS,
  TEMPLATE_KIND_COLORS,
  TemplateSegmentsRenderer,
} from "./shared";
import { ExperimentChatPanel } from "./experiment-chat-panel";

interface StudentStepContentProps {
  currentStep: FlatStepConfig;
  currentRound: FlatRoundConfig | undefined;
  resolvedParams: Record<string, ResolvedParam> | null;
  currentTemplateIndex: number;
  studentInputs: Record<string, string | number>;
  editingInputs: ReadonlySet<string>;
  confirmedInputs: ReadonlySet<string>;
  validationErrors: Set<string>;
  onStudentInput: (id: string, v: string | number) => void;
  onResetInput: (id: string) => void;
  trialId?: string;
  chatMessages?: ChatLogEntry[];
  onChatMessagesChange?: (blockId: string, messages: ChatLogEntry[]) => void;
}

export function StudentStepContent({
  currentStep,
  currentRound,
  resolvedParams,
  currentTemplateIndex,
  studentInputs,
  editingInputs,
  confirmedInputs,
  validationErrors,
  onStudentInput,
  onResetInput,
  trialId,
  chatMessages,
  onChatMessagesChange,
}: StudentStepContentProps) {
  const isStaticStep = isFlatStaticStep(currentStep);
  const isAiChatStep = isFlatAiChatStep(currentStep);

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

  return (
    <div className={isAiChatStep ? "h-full flex flex-col" : "space-y-4"}>
      {/* Static Block Content */}
      {isStaticStep && (
        <Card>
          <CardHeader>
            <h4 className="text-lg font-semibold">
              {(currentStep as FlatStaticBlockConfig).title}
            </h4>
          </CardHeader>
          <CardBody>
            <div
              className="prose prose-sm dark:prose-invert max-w-none leading-relaxed"
              dangerouslySetInnerHTML={{ __html: (currentStep as FlatStaticBlockConfig).body }}
            />
          </CardBody>
        </Card>
      )}

      {/* AI Chat Block Content */}
      {isAiChatStep && trialId && onChatMessagesChange && (
        <ExperimentChatPanel
          trialId={trialId}
          blockId={(currentStep as FlatAiChatBlockConfig).blockId}
          blockLabel={(currentStep as FlatAiChatBlockConfig).blockLabel}
          initialMessages={chatMessages || []}
          onMessagesChange={onChatMessagesChange}
        />
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
                {isActive && <span className="text-medium font-semibold">Active</span>}
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
                onStudentInput={onStudentInput}
                onResetInput={onResetInput}
                validationErrors={!isFuture ? validationErrors : undefined}
              />
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
