"use client";

import { useMemo } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { useTranslations } from "next-intl";
import type {
  FlatRoundConfig,
  FlatStaticBlockConfig,
  FlatInformationBlockConfig,
  FlatAiChatBlockConfig,
  FlatSurveyBlockConfig,
  FlatStepConfig,
  HistoryRow,
  ResolvedParam,
  TemplateKind,
  ChatLogEntry,
  SurveyQuestion,
} from "@/lib/experiment/types";
import { TEMPLATE_KINDS, isFlatStaticStep, isFlatInformationStep, isFlatAiChatStep, isFlatSurveyStep } from "@/lib/experiment/types";
import { renderTemplate, interpolateHistoryVars } from "@/lib/experiment/template";
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
  onLocalChange?: (paramId: string, localValue: string) => void;
  historyTable: HistoryRow[];
  trialId?: string;
  chatMessages?: ChatLogEntry[];
  onChatMessagesChange?: (blockId: string, messages: ChatLogEntry[]) => void;
  surveyAnswers?: Record<string, string>;
  onSurveyAnswerChange?: (questionId: string, answer: string) => void;
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
  onLocalChange,
  historyTable,
  trialId,
  chatMessages,
  onChatMessagesChange,
  surveyAnswers,
  onSurveyAnswerChange,
}: StudentStepContentProps) {
  const t = useTranslations("experimentRunner");
  const isStaticStep = isFlatStaticStep(currentStep);
  const isInformationStep = isFlatInformationStep(currentStep);
  const isAiChatStep = isFlatAiChatStep(currentStep);
  const isSurveyStep = isFlatSurveyStep(currentStep);

  const segmentsByKind = useMemo((): Partial<Record<TemplateKind, ReturnType<typeof renderTemplate>>> => {
    if (!resolvedParams || !currentRound || isStaticStep || isInformationStep || isAiChatStep || isSurveyStep) return {};
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
  }, [resolvedParams, currentRound, isStaticStep, isInformationStep, isAiChatStep, isSurveyStep]);

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
              dangerouslySetInnerHTML={{ __html: interpolateHistoryVars((currentStep as FlatStaticBlockConfig).body, historyTable) }}
            />
          </CardBody>
        </Card>
      )}

      {/* Information Block Content */}
      {isInformationStep && (
        <Card>
          <CardHeader>
            <h4 className="text-lg font-semibold">
              {(currentStep as FlatInformationBlockConfig).title}
            </h4>
          </CardHeader>
          <CardBody>
            <div
              className="prose prose-sm dark:prose-invert max-w-none leading-relaxed"
              dangerouslySetInnerHTML={{ __html: interpolateHistoryVars((currentStep as FlatInformationBlockConfig).body, historyTable) }}
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
          responseMode={(currentStep as FlatAiChatBlockConfig).responseMode}
          initiator={(currentStep as FlatAiChatBlockConfig).initiator}
        />
      )}

      {/* Survey Block Content */}
      {isSurveyStep && (
        <Card>
          <CardHeader>
            <h4 className="text-lg font-semibold">
              {(currentStep as FlatSurveyBlockConfig).blockLabel || t("survey")}
            </h4>
          </CardHeader>
          <CardBody className="gap-4">
            {(currentStep as FlatSurveyBlockConfig).questions.map((q: SurveyQuestion) => (
              <div key={q.id} className="space-y-2">
                <p className="text-sm font-medium">{q.text}</p>
                {q.questionType === "text" ? (
                  <textarea
                    className="w-full min-h-[80px] p-3 rounded-lg border border-default-200 bg-default-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                    value={surveyAnswers?.[q.id] || ""}
                    onChange={(e) => onSurveyAnswerChange?.(q.id, e.target.value)}
                    placeholder={t("typeMessage")}
                  />
                ) : (
                  <div className="space-y-1">
                    {(q.options || []).map((opt: string, oi: number) => (
                      <label key={oi} className="flex items-center gap-2 p-2 rounded-lg hover:bg-default-100 cursor-pointer">
                        <input
                          type="radio"
                          name={`survey-${q.id}`}
                          value={opt}
                          checked={surveyAnswers?.[q.id] === opt}
                          onChange={() => onSurveyAnswerChange?.(q.id, opt)}
                          className="accent-primary"
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Template Cards (round steps only) */}
      {!isStaticStep && !isInformationStep && !isAiChatStep && !isSurveyStep && TEMPLATE_KINDS.map((kind, kindIdx) => {
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
        if (isFuture) cardClasses += " pointer-events-none select-none [&_*]:!blur-[6px]";
        else if (isPast) cardClasses += " opacity-60 pointer-events-none";

        return (
          <Card key={kind} className={cardClasses}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Chip size="sm" variant={isActive ? "solid" : "flat"} color={TEMPLATE_KIND_COLORS[kind]}>
                  {TEMPLATE_KIND_LABELS[kind]}
                </Chip>
                {isActive && <span className="text-medium font-semibold">{t("active")}</span>}
                {isPast && <span className="text-sm text-default-400">{t("completed")}</span>}
                {isFuture && <span className="text-sm text-default-400">{t("upcoming")}</span>}
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
                onLocalChange={onLocalChange}
                validationErrors={!isFuture ? validationErrors : undefined}
                disabled={!isActive}
              />
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
