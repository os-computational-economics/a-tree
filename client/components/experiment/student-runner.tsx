"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { useDisclosure } from "@heroui/modal";
import { ChevronRight, LogOut, BookOpen } from "lucide-react";
import type { ExperimentConfig, HistoryRow, ResolvedParam, TemplateKind } from "@/lib/experiment/types";
import { TEMPLATE_KINDS, isFlatStaticStep } from "@/lib/experiment/types";
import { GameEngine } from "@/lib/experiment/engine";
import { runValidation } from "./shared";
import { StudentStepContent } from "./student-step-content";
import { StudentRightPanel } from "./student-right-panel";
import { StudentCompletion } from "./student-completion";
import { api } from "@/lib/api/client";

interface StudentRunnerProps {
  config: ExperimentConfig;
  trialId: string;
  trialCode: string;
  initialHistoryTable: HistoryRow[];
  initialStepIndex: number;
  initialTemplateIndex: number;
  initialStatus: string;
}

export function StudentRunner({
  config,
  trialId,
  trialCode,
  initialHistoryTable,
  initialStepIndex,
  initialTemplateIndex,
  initialStatus,
}: StudentRunnerProps) {
  const router = useRouter();
  const engineRef = useRef<GameEngine | null>(null);
  const [, forceUpdate] = useState(0);
  const rerender = useCallback(() => forceUpdate((n) => n + 1), []);
  const { isOpen: exitOpen, onOpen: onExitOpen, onOpenChange: onExitOpenChange } = useDisclosure();
  const { isOpen: guideOpen, onOpen: onGuideOpen, onOpenChange: onGuideOpenChange } = useDisclosure();

  const [studentInputs, setStudentInputs] = useState<Record<string, string | number>>({});
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [editingInputs, setEditingInputs] = useState<Set<string>>(new Set());
  const [confirmedInputs, setConfirmedInputs] = useState<Set<string>>(new Set());
  const [isCompleted, setIsCompleted] = useState(initialStatus === "completed");
  const [saving, setSaving] = useState(false);
  const [leftPanelPct, setLeftPanelPct] = useState(60);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPanelPct(Math.min(80, Math.max(20, pct)));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  // Initialize engine, restore saved state if resuming
  useEffect(() => {
    const engine = new GameEngine(config);

    if (initialHistoryTable.length > 0 || initialStepIndex > 0) {
      engine.restore(initialHistoryTable, initialStepIndex, initialTemplateIndex);
    }

    engineRef.current = engine;
    rerender();
  }, [config, initialHistoryTable, initialStepIndex, initialTemplateIndex, rerender]);

  const engine = engineRef.current;
  if (!engine) return null;

  const currentStep = engine.getCurrentStep();
  const currentRound = engine.getCurrentRound();
  const isStaticStep = currentStep && isFlatStaticStep(currentStep);
  const resolvedParams = engine.getResolvedParams();
  const currentTemplateIndex = engine.getCurrentTemplateIndex();
  const currentTemplateKind = engine.getCurrentTemplateKind();
  const historyTable = engine.getHistoryTable();
  const totalSteps = engine.getTotalSteps();
  const currentStepNumber = engine.getCurrentStepNumber();

  const blockLabel = isStaticStep
    ? (currentStep.blockLabel || currentStep.title || `Block ${currentStep.blockIndex + 1}`)
    : (currentRound?.blockLabel || `Block ${(currentRound?.blockIndex ?? 0) + 1}`);

  // If already completed on load, show completion screen
  if (isCompleted) {
    return (
      <StudentCompletion
        trialCode={trialCode}
        historyTable={initialHistoryTable.length > 0 ? initialHistoryTable : historyTable}
        config={config}
        onExit={() => router.push("/experiments")}
      />
    );
  }

  const studentInputParamIds = (() => {
    if (!resolvedParams || !currentRound || isStaticStep) return [];
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
  })();

  const allInputsValid = (() => {
    if (isStaticStep) return true;
    if (studentInputParamIds.length === 0) return true;
    if (validationErrors.size > 0) return false;
    return studentInputParamIds.every((id) => confirmedInputs.has(id));
  })();

  const handleStudentInput = (id: string, v: string | number) => {
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
  };

  const handleResetInput = (id: string) => {
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
  };

  const saveProgress = async (finished: boolean) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        historyTable: engine.getHistoryTable(),
        currentStepIndex: engine.getCurrentStepIndex(),
        currentTemplateIndex: engine.getCurrentTemplateIndex(),
      };
      if (finished) body.status = "completed";
      await api.patch(`/api/experiments/trials/${trialId}`, body);
    } catch (e) {
      console.error("Failed to save progress:", e);
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    engine.advance(studentInputs);
    setStudentInputs(engine.getStudentInputs());
    setValidationErrors(new Set());
    setEditingInputs(new Set());
    setConfirmedInputs(new Set());
    rerender();

    const finished = engine.isFinished();
    await saveProgress(finished);

    if (finished) {
      setIsCompleted(true);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-divider bg-background/80 backdrop-blur-sm shrink-0">
        <Button
          variant="light"
          size="sm"
          startContent={<LogOut className="w-4 h-4" />}
          onPress={onExitOpen}
        >
          Exit
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-default-400">Trial</span>
          <Chip variant="flat" color="primary" size="sm">
            <span className="font-mono font-bold">{trialCode}</span>
          </Chip>
          {saving && <span className="text-xs text-default-400">Saving...</span>}
        </div>
      </div>

      {/* Split Screen */}
      <div ref={splitContainerRef} className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="flex flex-col min-w-0" style={{ width: `${leftPanelPct}%` }}>
          <div className="flex-1 overflow-y-auto p-6">
            <StudentStepContent
              currentStep={currentStep}
              currentRound={currentRound}
              resolvedParams={resolvedParams}
              currentTemplateIndex={currentTemplateIndex}
              studentInputs={studentInputs}
              editingInputs={editingInputs}
              confirmedInputs={confirmedInputs}
              validationErrors={validationErrors}
              onStudentInput={handleStudentInput}
              onResetInput={handleResetInput}
            />
          </div>
          {/* Continue Button - pinned to bottom-right */}
          <div className="flex justify-end px-6 py-4 border-t border-divider shrink-0">
            <Button
              color="primary"
              size="lg"
              endContent={<ChevronRight className="w-4 h-4" />}
              isDisabled={engine.isFinished() || !allInputsValid}
              onPress={goNext}
            >
              Continue
            </Button>
          </div>
        </div>

        {/* Resize Handle */}
        <div
          className="w-1.5 shrink-0 cursor-col-resize bg-divider hover:bg-primary/40 active:bg-primary/60 transition-colors relative group"
          onMouseDown={handleResizeStart}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-default-400 group-hover:bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Right Panel */}
        <div className="min-w-0 bg-content1 overflow-hidden" style={{ width: `${100 - leftPanelPct}%` }}>
          <StudentRightPanel
            config={config}
            historyTable={historyTable}
            flatConfig={engine.getFlatConfig()}
            resolvedParams={resolvedParams}
            studentInputs={studentInputs}
            currentStepNumber={currentStepNumber}
            totalSteps={totalSteps}
            blockLabel={blockLabel}
            isStaticStep={!!isStaticStep}
            roundIndex={currentRound?.roundIndex}
            currentTemplateKind={currentTemplateKind}
          />
        </div>
      </div>

      {/* Floating Game Guide Button */}
      {config.gameGuide && (
        <>
          <button
            type="button"
            className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
            onClick={onGuideOpen}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-sm font-medium">Game Guide</span>
          </button>

          <Modal
            isOpen={guideOpen}
            onOpenChange={onGuideOpenChange}
            size="3xl"
            scrollBehavior="inside"
          >
            <ModalContent>
              {(onClose) => (
                <>
                  <ModalHeader className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Game Guide
                  </ModalHeader>
                  <ModalBody>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: config.gameGuide! }}
                    />
                  </ModalBody>
                  <ModalFooter>
                    <Button variant="flat" onPress={onClose}>
                      Close
                    </Button>
                  </ModalFooter>
                </>
              )}
            </ModalContent>
          </Modal>
        </>
      )}

      {/* Exit Confirmation Modal */}
      <Modal isOpen={exitOpen} onOpenChange={onExitOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Exit Experiment?</ModalHeader>
              <ModalBody>
                <p>Your progress has been saved. You can resume this experiment later from your experiments page.</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="danger"
                  onPress={() => {
                    onClose();
                    router.push("/experiments");
                  }}
                >
                  Exit
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
