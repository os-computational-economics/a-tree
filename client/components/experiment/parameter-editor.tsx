"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Chip } from "@heroui/chip";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Tabs, Tab } from "@heroui/tabs";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Textarea } from "@heroui/input";
import { Plus, Trash2, Copy } from "lucide-react";
import type {
  ExperimentConfig,
  ParamDefinition,
  RoundConfig,
} from "@/lib/experiment/types";

interface ParameterEditorProps {
  config: ExperimentConfig;
  onChange: (config: ExperimentConfig) => void;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const VALUE_TYPES = [
  { key: "constant", label: "Constant" },
  { key: "norm", label: "Normal Distribution" },
  { key: "unif", label: "Uniform Distribution" },
  { key: "equation", label: "Equation" },
  { key: "student_input", label: "Student Input" },
];

const DATA_TYPES = [
  { key: "number", label: "Number" },
  { key: "string", label: "String" },
  { key: "boolean", label: "Boolean" },
];

function makeDefaultParam(type: string = "constant"): ParamDefinition {
  switch (type) {
    case "norm":
      return { type: "norm", mean: 0, std: 1 };
    case "unif":
      return { type: "unif", min: 0, max: 1 };
    case "equation":
      return { type: "equation", expression: "" };
    case "student_input":
      return { type: "student_input", inputLabel: "", inputType: "number" };
    default:
      return { type: "constant", dataType: "number", value: 0 };
  }
}

function ParamValueEditor({
  definition,
  onChange,
  allParamIds,
}: {
  definition: ParamDefinition;
  onChange: (def: ParamDefinition) => void;
  allParamIds: string[];
}) {
  switch (definition.type) {
    case "constant":
      return (
        <div className="flex gap-2 flex-1">
          <Select
            label="Data Type"
            size="sm"
            className="w-32"
            selectedKeys={[definition.dataType]}
            onSelectionChange={(keys) => {
              const dt = Array.from(keys)[0] as "number" | "string" | "boolean";
              if (!dt) return;
              const defaultVal = dt === "number" ? 0 : dt === "boolean" ? false : "";
              onChange({ ...definition, dataType: dt, value: defaultVal });
            }}
          >
            {DATA_TYPES.map((t) => (
              <SelectItem key={t.key}>{t.label}</SelectItem>
            ))}
          </Select>
          {definition.dataType === "boolean" ? (
            <Select
              label="Value"
              size="sm"
              className="flex-1"
              selectedKeys={[String(definition.value)]}
              onSelectionChange={(keys) => {
                const v = Array.from(keys)[0] as string;
                onChange({ ...definition, value: v === "true" });
              }}
            >
              <SelectItem key="true">true</SelectItem>
              <SelectItem key="false">false</SelectItem>
            </Select>
          ) : (
            <Input
              label="Value"
              size="sm"
              className="flex-1"
              type={definition.dataType === "number" ? "number" : "text"}
              value={String(definition.value)}
              onValueChange={(v) =>
                onChange({
                  ...definition,
                  value: definition.dataType === "number" ? Number(v) || 0 : v,
                })
              }
            />
          )}
        </div>
      );

    case "norm":
      return (
        <div className="flex gap-2 flex-1">
          <Input
            label="Mean"
            size="sm"
            type="number"
            value={String(definition.mean)}
            onValueChange={(v) => onChange({ ...definition, mean: Number(v) || 0 })}
          />
          <Input
            label="Std Dev"
            size="sm"
            type="number"
            value={String(definition.std)}
            onValueChange={(v) => onChange({ ...definition, std: Number(v) || 0 })}
          />
        </div>
      );

    case "unif":
      return (
        <div className="flex gap-2 flex-1">
          <Input
            label="Min"
            size="sm"
            type="number"
            value={String(definition.min)}
            onValueChange={(v) => onChange({ ...definition, min: Number(v) || 0 })}
          />
          <Input
            label="Max"
            size="sm"
            type="number"
            value={String(definition.max)}
            onValueChange={(v) => onChange({ ...definition, max: Number(v) || 0 })}
          />
        </div>
      );

    case "equation":
      return (
        <div className="flex-1 space-y-2">
          <Textarea
            label="Expression"
            size="sm"
            placeholder="e.g. Math.max({{price}} - {{cost}}, 0)"
            value={definition.expression}
            onValueChange={(v) => onChange({ ...definition, expression: v })}
            minRows={1}
          />
          {allParamIds.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              <span className="text-tiny text-default-400 self-center">Insert:</span>
              {allParamIds.map((id) => (
                <Chip
                  key={id}
                  size="sm"
                  variant="flat"
                  className="cursor-pointer"
                  onClick={() =>
                    onChange({
                      ...definition,
                      expression: definition.expression + `{{${id}}}`,
                    })
                  }
                >
                  {`{{${id}}}`}
                </Chip>
              ))}
            </div>
          )}
        </div>
      );

    case "student_input":
      return (
        <div className="flex gap-2 flex-1">
          <Input
            label="Input Label"
            size="sm"
            className="flex-1"
            value={definition.inputLabel || ""}
            onValueChange={(v) => onChange({ ...definition, inputLabel: v })}
          />
          <Select
            label="Input Type"
            size="sm"
            className="w-32"
            selectedKeys={[definition.inputType || "text"]}
            onSelectionChange={(keys) => {
              const v = Array.from(keys)[0] as "number" | "text";
              if (v) onChange({ ...definition, inputType: v });
            }}
          >
            <SelectItem key="number">Number</SelectItem>
            <SelectItem key="text">Text</SelectItem>
          </Select>
        </div>
      );
  }
}

function ParamRow({
  paramId,
  definition,
  onChangeId,
  onChangeDef,
  onRemove,
  allParamIds,
  inheritedFrom,
}: {
  paramId: string;
  definition: ParamDefinition;
  onChangeId: (oldId: string, newId: string, newName: string) => void;
  onChangeDef: (id: string, def: ParamDefinition) => void;
  onRemove: (id: string) => void;
  allParamIds: string[];
  inheritedFrom?: string;
}) {
  const [nameInput, setNameInput] = useState(
    paramId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  );

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-content2/50">
      <div className="flex flex-col gap-1 min-w-[180px]">
        <Input
          label="Name"
          size="sm"
          value={nameInput}
          onValueChange={setNameInput}
          onBlur={() => {
            const newSlug = slugify(nameInput);
            if (newSlug && newSlug !== paramId) {
              onChangeId(paramId, newSlug, nameInput);
            }
          }}
        />
        <Chip size="sm" variant="flat" color="secondary">
          {paramId}
        </Chip>
        {inheritedFrom && (
          <Chip size="sm" variant="dot" color="warning">
            Inherited: {inheritedFrom}
          </Chip>
        )}
      </div>

      <Select
        label="Type"
        size="sm"
        className="w-40"
        selectedKeys={[definition.type]}
        onSelectionChange={(keys) => {
          const newType = Array.from(keys)[0] as string;
          if (newType && newType !== definition.type) {
            onChangeDef(paramId, makeDefaultParam(newType));
          }
        }}
      >
        {VALUE_TYPES.map((t) => (
          <SelectItem key={t.key}>{t.label}</SelectItem>
        ))}
      </Select>

      <ParamValueEditor
        definition={definition}
        onChange={(def) => onChangeDef(paramId, def)}
        allParamIds={allParamIds.filter((id) => id !== paramId)}
      />

      <Button
        isIconOnly
        variant="light"
        color="danger"
        size="sm"
        className="mt-2"
        onPress={() => onRemove(paramId)}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

function ParamList({
  params,
  onChange,
  allParamIds,
  inheritedParams,
}: {
  params: Record<string, ParamDefinition>;
  onChange: (params: Record<string, ParamDefinition>) => void;
  allParamIds: string[];
  inheritedParams?: Record<string, { def: ParamDefinition; source: string }>;
}) {
  const handleAdd = () => {
    let id = "new_param";
    let i = 1;
    while (params[id] || allParamIds.includes(id)) {
      id = `new_param_${i++}`;
    }
    onChange({ ...params, [id]: makeDefaultParam() });
  };

  const handleChangeId = (oldId: string, newId: string) => {
    if (newId === oldId) return;
    const entries = Object.entries(params);
    const newParams: Record<string, ParamDefinition> = {};
    for (const [k, v] of entries) {
      newParams[k === oldId ? newId : k] = v;
    }
    onChange(newParams);
  };

  const handleChangeDef = (id: string, def: ParamDefinition) => {
    onChange({ ...params, [id]: def });
  };

  const handleRemove = (id: string) => {
    const { [id]: _, ...rest } = params;
    onChange(rest);
  };

  return (
    <div className="space-y-3">
      {Object.entries(params).map(([id, def]) => (
        <ParamRow
          key={id}
          paramId={id}
          definition={def}
          onChangeId={handleChangeId}
          onChangeDef={handleChangeDef}
          onRemove={handleRemove}
          allParamIds={allParamIds}
        />
      ))}

      {inheritedParams &&
        Object.entries(inheritedParams)
          .filter(([id]) => !params[id])
          .map(([id, { def, source }]) => (
            <div
              key={`inh-${id}`}
              className="flex items-center gap-2 p-3 rounded-lg bg-content2/20 opacity-60"
            >
              <Chip size="sm" variant="flat" color="secondary">
                {id}
              </Chip>
              <Chip size="sm" variant="dot" color="warning">
                Inherited from {source}
              </Chip>
              <span className="text-sm text-default-400">{def.type}</span>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="flat"
                startContent={<Copy className="w-3 h-3" />}
                onPress={() => onChange({ ...params, [id]: { ...def } })}
              >
                Override
              </Button>
            </div>
          ))}

      <Button
        size="sm"
        variant="flat"
        color="primary"
        startContent={<Plus className="w-4 h-4" />}
        onPress={handleAdd}
      >
        Add Parameter
      </Button>
    </div>
  );
}

export function ParameterEditor({ config, onChange }: ParameterEditorProps) {
  const allParamIds = Object.keys(config.params);

  const handleExpParamsChange = (params: Record<string, ParamDefinition>) => {
    onChange({ ...config, params });
  };

  const handleRoundParamsChange = (
    roundIdx: number,
    params: Record<string, ParamDefinition>,
  ) => {
    const rounds = [...config.rounds];
    rounds[roundIdx] = { ...rounds[roundIdx], params };
    onChange({ ...config, rounds });
  };

  const handleRepParamsChange = (
    roundIdx: number,
    repIdx: number,
    params: Record<string, ParamDefinition>,
  ) => {
    const rounds = [...config.rounds];
    const reps = [...rounds[roundIdx].repetitions];
    reps[repIdx] = { ...reps[repIdx], params };
    rounds[roundIdx] = { ...rounds[roundIdx], repetitions: reps };
    onChange({ ...config, rounds });
  };

  const addRound = () => {
    const newRound: RoundConfig = {
      id: `r_${crypto.randomUUID().slice(0, 8)}`,
      repetitions: [{ id: `rep_${crypto.randomUUID().slice(0, 8)}` }],
    };
    onChange({ ...config, rounds: [...config.rounds, newRound] });
  };

  const removeRound = (idx: number) => {
    const rounds = config.rounds.filter((_, i) => i !== idx);
    onChange({ ...config, rounds });
  };

  const addRepetition = (roundIdx: number) => {
    const rounds = [...config.rounds];
    rounds[roundIdx] = {
      ...rounds[roundIdx],
      repetitions: [
        ...rounds[roundIdx].repetitions,
        { id: `rep_${crypto.randomUUID().slice(0, 8)}` },
      ],
    };
    onChange({ ...config, rounds });
  };

  const removeRepetition = (roundIdx: number, repIdx: number) => {
    const rounds = [...config.rounds];
    rounds[roundIdx] = {
      ...rounds[roundIdx],
      repetitions: rounds[roundIdx].repetitions.filter((_, i) => i !== repIdx),
    };
    onChange({ ...config, rounds });
  };

  return (
    <div className="space-y-6">
      <Tabs aria-label="Parameter scope" variant="underlined">
        <Tab key="experiment" title="Experiment Level">
          <Card>
            <CardHeader>
              <h4 className="text-medium font-semibold">
                Experiment-Level Parameters (defaults for all rounds)
              </h4>
            </CardHeader>
            <CardBody>
              <ParamList
                params={config.params}
                onChange={handleExpParamsChange}
                allParamIds={allParamIds}
              />
            </CardBody>
          </Card>
        </Tab>

        <Tab key="rounds" title="Round Overrides">
          <div className="space-y-4">
            <Accordion variant="bordered">
              {config.rounds.map((round, ri) => (
                <AccordionItem
                  key={round.id}
                  title={
                    <div className="flex items-center gap-2">
                      <span>Round {ri + 1}</span>
                      {round.label && (
                        <Chip size="sm" variant="flat">
                          {round.label}
                        </Chip>
                      )}
                      <Chip size="sm" variant="flat" color="secondary">
                        {round.id}
                      </Chip>
                    </div>
                  }
                >
                  <div className="space-y-3">
                    <Input
                      label="Round Label"
                      size="sm"
                      value={round.label || ""}
                      onValueChange={(v) => {
                        const rounds = [...config.rounds];
                        rounds[ri] = { ...rounds[ri], label: v || undefined };
                        onChange({ ...config, rounds });
                      }}
                      placeholder="e.g. Practice Round"
                    />
                    <ParamList
                      params={round.params || {}}
                      onChange={(p) => handleRoundParamsChange(ri, p)}
                      allParamIds={allParamIds}
                      inheritedParams={Object.fromEntries(
                        Object.entries(config.params).map(([k, v]) => [
                          k,
                          { def: v, source: "experiment" },
                        ]),
                      )}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        onPress={() => removeRound(ri)}
                        isDisabled={config.rounds.length <= 1}
                      >
                        Remove Round
                      </Button>
                    </div>
                  </div>
                </AccordionItem>
              ))}
            </Accordion>
            <Button
              size="sm"
              variant="flat"
              color="primary"
              startContent={<Plus className="w-4 h-4" />}
              onPress={addRound}
            >
              Add Round
            </Button>
          </div>
        </Tab>

        <Tab key="repetitions" title="Repetition Overrides">
          <div className="space-y-4">
            <Accordion variant="bordered">
              {config.rounds.map((round, ri) => (
                <AccordionItem
                  key={round.id}
                  title={
                    <span>
                      Round {ri + 1} {round.label ? `(${round.label})` : ""}
                    </span>
                  }
                >
                  <Accordion variant="splitted">
                    {round.repetitions.map((rep, pi) => (
                      <AccordionItem
                        key={rep.id}
                        title={
                          <div className="flex items-center gap-2">
                            <span>Repetition {pi + 1}</span>
                            <Chip size="sm" variant="flat" color="secondary">
                              {rep.id}
                            </Chip>
                          </div>
                        }
                      >
                        <div className="space-y-3">
                          <ParamList
                            params={rep.params || {}}
                            onChange={(p) => handleRepParamsChange(ri, pi, p)}
                            allParamIds={allParamIds}
                            inheritedParams={{
                              ...Object.fromEntries(
                                Object.entries(config.params).map(([k, v]) => [
                                  k,
                                  { def: v, source: "experiment" },
                                ]),
                              ),
                              ...Object.fromEntries(
                                Object.entries(round.params || {}).map(([k, v]) => [
                                  k,
                                  { def: v, source: `round ${ri + 1}` },
                                ]),
                              ),
                            }}
                          />
                          <Button
                            size="sm"
                            variant="flat"
                            color="danger"
                            onPress={() => removeRepetition(ri, pi)}
                            isDisabled={round.repetitions.length <= 1}
                          >
                            Remove Repetition
                          </Button>
                        </div>
                      </AccordionItem>
                    ))}
                  </Accordion>
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    className="mt-3"
                    startContent={<Plus className="w-4 h-4" />}
                    onPress={() => addRepetition(ri)}
                  >
                    Add Repetition
                  </Button>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}
