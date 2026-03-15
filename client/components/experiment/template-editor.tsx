"use client";

import { useMemo, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Tabs, Tab } from "@heroui/tabs";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Chip } from "@heroui/chip";
import { Textarea } from "@heroui/input";
import { Divider } from "@heroui/divider";
import type { ExperimentConfig, TemplateKind, AiChatBlockConfig } from "@/lib/experiment/types";
import { TEMPLATE_KINDS, isStaticBlock, isInformationBlock, isAiChatBlock } from "@/lib/experiment/types";
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
  const t = useTranslations("admin.experiments");
  if (paramIds.length === 0 && studentInputIds.length === 0) {
    return (
      <p className="text-tiny text-default-400">
        {t("noParamsDefined")}
      </p>
    );
  }

  return (
    <div className="flex gap-1 flex-wrap items-center">
      <span className="text-tiny text-default-400">{t("insert")}</span>
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
  const t = useTranslations("admin.experiments");
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
      <p className="text-tiny text-default-400 mb-2">{t("previewBlockRound", { block: blockIndex + 1, round: roundIndex + 1 })}</p>
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
  const t = useTranslations("admin.experiments");
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
        placeholder={t("templateTextPlaceholder")}
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
  const t = useTranslations("admin.experiments");
  return (
    <div className="space-y-6">
      {([
        { kind: "intro" as TemplateKind, label: t("introTemplate"), value: introValue, onChange: onIntroChange },
        { kind: "decision" as TemplateKind, label: t("decisionTemplate"), value: decisionValue, onChange: onDecisionChange },
        { kind: "result" as TemplateKind, label: t("resultTemplate"), value: resultValue, onChange: onResultChange },
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
  const block = config.blocks[blockIndex];
  if (!block || isStaticBlock(block) || isInformationBlock(block) || isAiChatBlock(block)) return config[field];
  return block[field] || config[field];
}

function resolveRoundTemplate(config: ExperimentConfig, blockIndex: number, roundIndex: number, kind: TemplateKind): string {
  const field = TEMPLATE_FIELD_MAP[kind];
  const block = config.blocks[blockIndex];
  if (!block || isStaticBlock(block) || isInformationBlock(block) || isAiChatBlock(block)) return config[field];
  const round = block.rounds?.[roundIndex];
  return round?.[field] || block[field] || config[field];
}

export function TemplateEditor({ config, onChange }: TemplateEditorProps) {
  const t = useTranslations("admin.experiments");
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
    const block = blocks[blockIdx];
    if (isStaticBlock(block) || isInformationBlock(block) || isAiChatBlock(block)) return;
    blocks[blockIdx] = { ...block, [field]: value || undefined };
    onChange({ ...config, blocks });
  };

  const handleAiChatPromptChange = (blockIdx: number, value: string) => {
    const blocks = [...config.blocks];
    const block = blocks[blockIdx];
    if (!isAiChatBlock(block)) return;
    blocks[blockIdx] = { ...block, systemPromptTemplate: value };
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
    const block = blocks[blockIdx];
    if (isStaticBlock(block) || isInformationBlock(block) || isAiChatBlock(block)) return;
    const rounds = [...block.rounds];
    rounds[roundIdx] = { ...rounds[roundIdx], [field]: value || undefined };
    blocks[blockIdx] = { ...block, rounds };
    onChange({ ...config, blocks });
  };

  const hasBlockOverride = (block: ExperimentConfig["blocks"][number]) =>
    !isStaticBlock(block) && !isInformationBlock(block) && !isAiChatBlock(block) && TEMPLATE_KINDS.some((k) => block[TEMPLATE_FIELD_MAP[k]]);

  const hasRoundOverride = (round: { introTemplate?: string; decisionTemplate?: string; resultTemplate?: string }) =>
    TEMPLATE_KINDS.some((k) => round[TEMPLATE_FIELD_MAP[k]]);

  return (
    <div className="space-y-6">
      <Tabs aria-label="Template scope" variant="underlined">
        <Tab key="experiment" title={t("experimentLevel")}>
          <Card>
            <CardHeader>
              <h4 className="text-medium font-semibold">
                {t("defaultTemplates")}
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

        <Tab key="blocks" title={t("blockOverrides")}>
          <Accordion variant="bordered">
            {config.blocks.map((block, bi) => {
              if (isStaticBlock(block)) {
                return (
                  <AccordionItem
                    key={block.id}
                    title={
                      <div className="flex items-center gap-2">
                        <span>{t("blockN", { n: bi + 1 })}</span>
                        {block.label && (
                          <Chip size="sm" variant="flat">{block.label}</Chip>
                        )}
                        <Chip size="sm" variant="flat" color="secondary">{t("staticLabel")}</Chip>
                      </div>
                    }
                  >
                    <p className="text-sm text-default-400">
                      {t("staticUsesFixed")}
                    </p>
                  </AccordionItem>
                );
              }
              if (isInformationBlock(block)) {
                return (
                  <AccordionItem
                    key={block.id}
                    title={
                      <div className="flex items-center gap-2">
                        <span>{t("blockN", { n: bi + 1 })}</span>
                        {block.label && (
                          <Chip size="sm" variant="flat">{block.label}</Chip>
                        )}
                        <Chip size="sm" variant="flat" color="warning">{t("informationLabel")}</Chip>
                      </div>
                    }
                  >
                    <p className="text-sm text-default-400">
                      {t("informationUsesFixed")}
                    </p>
                  </AccordionItem>
                );
              }
              if (isAiChatBlock(block)) {
                return (
                  <AccordionItem
                    key={block.id}
                    title={
                      <div className="flex items-center gap-2">
                        <span>{t("blockN", { n: bi + 1 })}</span>
                        {block.label && (
                          <Chip size="sm" variant="flat">{block.label}</Chip>
                        )}
                        <Chip size="sm" variant="flat" color="primary">{t("aiChatLabel")}</Chip>
                      </div>
                    }
                  >
                    <div className="space-y-4">
                      <h5 className="text-sm font-semibold text-default-700">{t("systemPromptTemplate")}</h5>
                      <TemplateTextarea
                        value={block.systemPromptTemplate}
                        onChange={(v) => handleAiChatPromptChange(bi, v)}
                        paramIds={paramIds}
                        studentInputIds={studentInputIds}
                        label={t("systemPromptTemplate")}
                      />
                    </div>
                  </AccordionItem>
                );
              }
              return (
                <AccordionItem
                  key={block.id}
                  title={
                    <div className="flex items-center gap-2">
                      <span>Block {bi + 1}</span>
                      {block.label && (
                        <Chip size="sm" variant="flat">{block.label}</Chip>
                      )}
                      {hasBlockOverride(block) ? (
                        <Chip size="sm" variant="flat" color="primary">{t("customTemplates")}</Chip>
                      ) : (
                        <Chip size="sm" variant="dot" color="warning">{t("usingDefaults")}</Chip>
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
                        {t("leaveEmptyToUseExp")}
                      </p>
                    )}
                  </div>
                </AccordionItem>
              );
            })}
          </Accordion>
        </Tab>

        <Tab key="rounds" title={t("roundOverrides")}>
          <Accordion variant="bordered">
            {config.blocks.map((block, bi) => {
              if (isStaticBlock(block)) {
                return (
                  <AccordionItem
                    key={block.id}
                    title={
                      <div className="flex items-center gap-2">
                        <span>Block {bi + 1} {block.label ? `(${block.label})` : ""}</span>
                        <Chip size="sm" variant="flat" color="secondary">{t("staticLabel")}</Chip>
                      </div>
                    }
                  >
                    <p className="text-sm text-default-400">
                      {t("staticNoRounds")}
                    </p>
                  </AccordionItem>
                );
              }
              if (isInformationBlock(block)) {
                return (
                  <AccordionItem
                    key={block.id}
                    title={
                      <div className="flex items-center gap-2">
                        <span>Block {bi + 1} {block.label ? `(${block.label})` : ""}</span>
                        <Chip size="sm" variant="flat" color="warning">{t("informationLabel")}</Chip>
                      </div>
                    }
                  >
                    <p className="text-sm text-default-400">
                      {t("informationNoRounds")}
                    </p>
                  </AccordionItem>
                );
              }
              if (isAiChatBlock(block)) {
                return (
                  <AccordionItem
                    key={block.id}
                    title={
                      <div className="flex items-center gap-2">
                        <span>Block {bi + 1} {block.label ? `(${block.label})` : ""}</span>
                        <Chip size="sm" variant="flat" color="primary">{t("aiChatLabel")}</Chip>
                      </div>
                    }
                  >
                    <p className="text-sm text-default-400">
                      {t("aiChatNoRounds")}
                    </p>
                  </AccordionItem>
                );
              }
              return (
                <AccordionItem
                  key={block.id}
                  title={`${t("blockN", { n: bi + 1 })} ${block.label ? `(${block.label})` : ""}`}
                >
                  <Accordion variant="splitted">
                    {block.rounds.map((round, ri) => (
                      <AccordionItem
                        key={round.id}
                        title={
                          <div className="flex items-center gap-2">
                            <span>{t("roundN", { n: ri + 1 })}</span>
                            {hasRoundOverride(round) ? (
                              <Chip size="sm" variant="flat" color="primary">{t("customOverride")}</Chip>
                            ) : (
                              <Chip size="sm" variant="dot" color="warning">{t("inheritedOverride")}</Chip>
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
                              {t("leaveEmptyToInherit")}
                            </p>
                          )}
                        </div>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </AccordionItem>
              );
            })}
          </Accordion>
        </Tab>
      </Tabs>
    </div>
  );
}
