"use client";

import { useMemo, useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Tabs, Tab } from "@heroui/tabs";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Chip } from "@heroui/chip";
import { Textarea } from "@heroui/input";
import { Divider } from "@heroui/divider";
import type { ExperimentConfig, TemplateKind } from "@/lib/experiment/types";
import { TEMPLATE_KINDS } from "@/lib/experiment/types";
import { resolveParameters } from "@/lib/experiment/params";
import { renderTemplate } from "@/lib/experiment/template";

interface TemplateEditorProps {
  config: ExperimentConfig;
  onChange: (config: ExperimentConfig) => void;
}

const TEMPLATE_FIELD_MAP: Record<TemplateKind, "introTemplate" | "decisionTemplate" | "resultTemplate"> = {
  intro: "introTemplate",
  decision: "decisionTemplate",
  result: "resultTemplate",
};

const TEMPLATE_LABELS: Record<TemplateKind, string> = {
  intro: "Intro Template",
  decision: "Decision Template",
  result: "Result Template",
};

function ParamInsertToolbar({
  paramIds,
  studentInputIds,
  onInsert,
}: {
  paramIds: string[];
  studentInputIds: string[];
  onInsert: (tag: string) => void;
}) {
  if (paramIds.length === 0 && studentInputIds.length === 0) {
    return (
      <p className="text-tiny text-default-400">
        No parameters defined. Add parameters in the Parameters tab first.
      </p>
    );
  }

  return (
    <div className="flex gap-1 flex-wrap items-center">
      <span className="text-tiny text-default-400">Insert:</span>
      {paramIds.map((id) => (
        <Chip
          key={id}
          size="sm"
          variant="flat"
          color="primary"
          className="cursor-pointer"
          onClick={() => onInsert(`{{${id}}}`)}
        >
          {`{{${id}}}`}
        </Chip>
      ))}
      {studentInputIds.map((id) => (
        <Chip
          key={id}
          size="sm"
          variant="flat"
          color="warning"
          className="cursor-pointer"
          onClick={() => onInsert(`{{${id}}}`)}
        >
          {`{{${id}}}`}
        </Chip>
      ))}
    </div>
  );
}

function TemplatePreview({
  config,
  blockIndex,
  roundIndex,
  templateContent,
}: {
  config: ExperimentConfig;
  blockIndex: number;
  roundIndex: number;
  templateContent: string;
}) {
  const segments = useMemo(() => {
    try {
      const resolved = resolveParameters(config, blockIndex, roundIndex);
      return renderTemplate(templateContent, resolved);
    } catch {
      return [{ type: "text" as const, content: "[Error resolving parameters]" }];
    }
  }, [config, blockIndex, roundIndex, templateContent]);

  return (
    <div className="p-4 rounded-lg bg-content2/50 border border-divider">
      <p className="text-tiny text-default-400 mb-2">Preview (Block {blockIndex + 1}, Round {roundIndex + 1}):</p>
      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
        {segments.map((seg, i) => {
          if (seg.type === "text") {
            return <span key={i}>{seg.content}</span>;
          }
          if (seg.type === "value") {
            return (
              <Chip key={i} size="sm" variant="flat" color="primary" className="mx-0.5">
                {String(seg.value)}
              </Chip>
            );
          }
          if (seg.type === "input") {
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded border-2 border-dashed border-warning-300 bg-warning-50 dark:bg-warning-900/20 text-warning-600 text-sm"
              >
                {seg.inputLabel || seg.paramId} [input]
              </span>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

function TemplateTextarea({
  value,
  onChange,
  paramIds,
  studentInputIds,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  paramIds: string[];
  studentInputIds: string[];
  label: string;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleInsert = (tag: string) => {
    const next = localValue + tag;
    setLocalValue(next);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <ParamInsertToolbar
        paramIds={paramIds}
        studentInputIds={studentInputIds}
        onInsert={handleInsert}
      />
      <Textarea
        label={label}
        value={localValue}
        onValueChange={setLocalValue}
        onBlur={() => {
          if (localValue !== value) onChange(localValue);
        }}
        placeholder="Enter display text with {{param_id}} placeholders..."
        minRows={3}
        maxRows={20}
      />
    </div>
  );
}

function TripleTemplateEditor({
  introValue,
  decisionValue,
  resultValue,
  onIntroChange,
  onDecisionChange,
  onResultChange,
  paramIds,
  studentInputIds,
  config,
  blockIndex,
  roundIndex,
}: {
  introValue: string;
  decisionValue: string;
  resultValue: string;
  onIntroChange: (v: string) => void;
  onDecisionChange: (v: string) => void;
  onResultChange: (v: string) => void;
  paramIds: string[];
  studentInputIds: string[];
  config: ExperimentConfig;
  blockIndex: number;
  roundIndex: number;
}) {
  return (
    <div className="space-y-6">
      {([
        { kind: "intro" as TemplateKind, label: TEMPLATE_LABELS.intro, value: introValue, onChange: onIntroChange },
        { kind: "decision" as TemplateKind, label: TEMPLATE_LABELS.decision, value: decisionValue, onChange: onDecisionChange },
        { kind: "result" as TemplateKind, label: TEMPLATE_LABELS.result, value: resultValue, onChange: onResultChange },
      ]).map(({ kind, label, value, onChange }) => (
        <div key={kind} className="space-y-3">
          <h5 className="text-sm font-semibold text-default-700">{label}</h5>
          <TemplateTextarea
            value={value}
            onChange={onChange}
            paramIds={paramIds}
            studentInputIds={studentInputIds}
            label={label}
          />
          <TemplatePreview
            config={config}
            blockIndex={blockIndex}
            roundIndex={roundIndex}
            templateContent={value}
          />
          <Divider />
        </div>
      ))}
    </div>
  );
}

function resolveBlockTemplate(config: ExperimentConfig, blockIndex: number, kind: TemplateKind): string {
  const field = TEMPLATE_FIELD_MAP[kind];
  return config.blocks[blockIndex]?.[field] || config[field];
}

function resolveRoundTemplate(config: ExperimentConfig, blockIndex: number, roundIndex: number, kind: TemplateKind): string {
  const field = TEMPLATE_FIELD_MAP[kind];
  const block = config.blocks[blockIndex];
  const round = block?.rounds?.[roundIndex];
  return round?.[field] || block?.[field] || config[field];
}

export function TemplateEditor({ config, onChange }: TemplateEditorProps) {
  const paramIds = useMemo(() => {
    return Object.entries(config.params)
      .filter(([, def]) => def.type !== "student_input")
      .map(([id]) => id);
  }, [config.params]);

  const studentInputIds = useMemo(() => {
    return Object.entries(config.params)
      .filter(([, def]) => def.type === "student_input")
      .map(([id]) => id);
  }, [config.params]);

  const handleExpTemplateChange = (kind: TemplateKind, value: string) => {
    const field = TEMPLATE_FIELD_MAP[kind];
    onChange({ ...config, [field]: value });
  };

  const handleBlockTemplateChange = (blockIdx: number, kind: TemplateKind, value: string) => {
    const field = TEMPLATE_FIELD_MAP[kind];
    const blocks = [...config.blocks];
    blocks[blockIdx] = { ...blocks[blockIdx], [field]: value || undefined };
    onChange({ ...config, blocks });
  };

  const handleRoundTemplateChange = (
    blockIdx: number,
    roundIdx: number,
    kind: TemplateKind,
    value: string,
  ) => {
    const field = TEMPLATE_FIELD_MAP[kind];
    const blocks = [...config.blocks];
    const rounds = [...blocks[blockIdx].rounds];
    rounds[roundIdx] = { ...rounds[roundIdx], [field]: value || undefined };
    blocks[blockIdx] = { ...blocks[blockIdx], rounds };
    onChange({ ...config, blocks });
  };

  const hasBlockOverride = (block: ExperimentConfig["blocks"][number]) =>
    TEMPLATE_KINDS.some((k) => block[TEMPLATE_FIELD_MAP[k]]);

  const hasRoundOverride = (round: ExperimentConfig["blocks"][number]["rounds"][number]) =>
    TEMPLATE_KINDS.some((k) => round[TEMPLATE_FIELD_MAP[k]]);

  return (
    <div className="space-y-6">
      <Tabs aria-label="Template scope" variant="underlined">
        <Tab key="experiment" title="Experiment Level">
          <Card>
            <CardHeader>
              <h4 className="text-medium font-semibold">
                Default Templates (used unless overridden)
              </h4>
            </CardHeader>
            <CardBody className="space-y-4">
              <TripleTemplateEditor
                introValue={config.introTemplate}
                decisionValue={config.decisionTemplate}
                resultValue={config.resultTemplate}
                onIntroChange={(v) => handleExpTemplateChange("intro", v)}
                onDecisionChange={(v) => handleExpTemplateChange("decision", v)}
                onResultChange={(v) => handleExpTemplateChange("result", v)}
                paramIds={paramIds}
                studentInputIds={studentInputIds}
                config={config}
                blockIndex={0}
                roundIndex={0}
              />
            </CardBody>
          </Card>
        </Tab>

        <Tab key="blocks" title="Block Overrides">
          <Accordion variant="bordered">
            {config.blocks.map((block, bi) => (
              <AccordionItem
                key={block.id}
                title={
                  <div className="flex items-center gap-2">
                    <span>Block {bi + 1}</span>
                    {block.label && (
                      <Chip size="sm" variant="flat">{block.label}</Chip>
                    )}
                    {hasBlockOverride(block) ? (
                      <Chip size="sm" variant="flat" color="primary">Custom templates</Chip>
                    ) : (
                      <Chip size="sm" variant="dot" color="warning">Using defaults</Chip>
                    )}
                  </div>
                }
              >
                <div className="space-y-4">
                  <TripleTemplateEditor
                    introValue={block.introTemplate || ""}
                    decisionValue={block.decisionTemplate || ""}
                    resultValue={block.resultTemplate || ""}
                    onIntroChange={(v) => handleBlockTemplateChange(bi, "intro", v)}
                    onDecisionChange={(v) => handleBlockTemplateChange(bi, "decision", v)}
                    onResultChange={(v) => handleBlockTemplateChange(bi, "result", v)}
                    paramIds={paramIds}
                    studentInputIds={studentInputIds}
                    config={config}
                    blockIndex={bi}
                    roundIndex={0}
                  />
                  {!hasBlockOverride(block) && (
                    <p className="text-tiny text-default-400">
                      Leave empty to use the experiment-level templates.
                    </p>
                  )}
                </div>
              </AccordionItem>
            ))}
          </Accordion>
        </Tab>

        <Tab key="rounds" title="Round Overrides">
          <Accordion variant="bordered">
            {config.blocks.map((block, bi) => (
              <AccordionItem
                key={block.id}
                title={`Block ${bi + 1} ${block.label ? `(${block.label})` : ""}`}
              >
                <Accordion variant="splitted">
                  {block.rounds.map((round, ri) => (
                    <AccordionItem
                      key={round.id}
                      title={
                        <div className="flex items-center gap-2">
                          <span>Round {ri + 1}</span>
                          {hasRoundOverride(round) ? (
                            <Chip size="sm" variant="flat" color="primary">Custom</Chip>
                          ) : (
                            <Chip size="sm" variant="dot" color="warning">Inherited</Chip>
                          )}
                        </div>
                      }
                    >
                      <div className="space-y-4">
                        <TripleTemplateEditor
                          introValue={round.introTemplate || ""}
                          decisionValue={round.decisionTemplate || ""}
                          resultValue={round.resultTemplate || ""}
                          onIntroChange={(v) => handleRoundTemplateChange(bi, ri, "intro", v)}
                          onDecisionChange={(v) => handleRoundTemplateChange(bi, ri, "decision", v)}
                          onResultChange={(v) => handleRoundTemplateChange(bi, ri, "result", v)}
                          paramIds={paramIds}
                          studentInputIds={studentInputIds}
                          config={config}
                          blockIndex={bi}
                          roundIndex={ri}
                        />
                        {!hasRoundOverride(round) && (
                          <p className="text-tiny text-default-400">
                            Leave empty to inherit from block or experiment level.
                          </p>
                        )}
                      </div>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionItem>
            ))}
          </Accordion>
        </Tab>
      </Tabs>
    </div>
  );
}
