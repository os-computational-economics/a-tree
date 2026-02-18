"use client";

import { useMemo, useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Tabs, Tab } from "@heroui/tabs";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Chip } from "@heroui/chip";
import { Textarea } from "@heroui/input";
import { Divider } from "@heroui/divider";
import type { ExperimentConfig } from "@/lib/experiment/types";
import { resolveParameters } from "@/lib/experiment/params";
import { renderTemplate } from "@/lib/experiment/template";

interface TemplateEditorProps {
  config: ExperimentConfig;
  onChange: (config: ExperimentConfig) => void;
}

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
}: {
  value: string;
  onChange: (v: string) => void;
  paramIds: string[];
  studentInputIds: string[];
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
        label="Template"
        value={localValue}
        onValueChange={setLocalValue}
        onBlur={() => {
          if (localValue !== value) onChange(localValue);
        }}
        placeholder="Enter display text with {{param_id}} placeholders..."
        minRows={4}
        maxRows={20}
      />
    </div>
  );
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

  const handleExpTemplateChange = (template: string) => {
    onChange({ ...config, template });
  };

  const handleBlockTemplateChange = (blockIdx: number, template: string) => {
    const blocks = [...config.blocks];
    blocks[blockIdx] = { ...blocks[blockIdx], template: template || undefined };
    onChange({ ...config, blocks });
  };

  const handleRoundTemplateChange = (
    blockIdx: number,
    roundIdx: number,
    template: string,
  ) => {
    const blocks = [...config.blocks];
    const rounds = [...blocks[blockIdx].rounds];
    rounds[roundIdx] = { ...rounds[roundIdx], template: template || undefined };
    blocks[blockIdx] = { ...blocks[blockIdx], rounds };
    onChange({ ...config, blocks });
  };

  return (
    <div className="space-y-6">
      <Tabs aria-label="Template scope" variant="underlined">
        <Tab key="experiment" title="Experiment Level">
          <Card>
            <CardHeader>
              <h4 className="text-medium font-semibold">
                Default Template (used unless overridden)
              </h4>
            </CardHeader>
            <CardBody className="space-y-4">
              <TemplateTextarea
                value={config.template}
                onChange={handleExpTemplateChange}
                paramIds={paramIds}
                studentInputIds={studentInputIds}
              />
              <Divider />
              <TemplatePreview
                config={config}
                blockIndex={0}
                roundIndex={0}
                templateContent={config.template}
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
                    {block.template ? (
                      <Chip size="sm" variant="flat" color="primary">Custom template</Chip>
                    ) : (
                      <Chip size="sm" variant="dot" color="warning">Using default</Chip>
                    )}
                  </div>
                }
              >
                <div className="space-y-4">
                  <TemplateTextarea
                    value={block.template || ""}
                    onChange={(v) => handleBlockTemplateChange(bi, v)}
                    paramIds={paramIds}
                    studentInputIds={studentInputIds}
                  />
                  {!block.template && (
                    <p className="text-tiny text-default-400">
                      Leave empty to use the experiment-level template.
                    </p>
                  )}
                  <Divider />
                  <TemplatePreview
                    config={config}
                    blockIndex={bi}
                    roundIndex={0}
                    templateContent={block.template || config.template}
                  />
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
                          {round.template ? (
                            <Chip size="sm" variant="flat" color="primary">Custom</Chip>
                          ) : (
                            <Chip size="sm" variant="dot" color="warning">Inherited</Chip>
                          )}
                        </div>
                      }
                    >
                      <div className="space-y-4">
                        <TemplateTextarea
                          value={round.template || ""}
                          onChange={(v) => handleRoundTemplateChange(bi, ri, v)}
                          paramIds={paramIds}
                          studentInputIds={studentInputIds}
                        />
                        {!round.template && (
                          <p className="text-tiny text-default-400">
                            Leave empty to inherit from block or experiment level.
                          </p>
                        )}
                        <Divider />
                        <TemplatePreview
                          config={config}
                          blockIndex={bi}
                          roundIndex={ri}
                          templateContent={
                            round.template || block.template || config.template
                          }
                        />
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
