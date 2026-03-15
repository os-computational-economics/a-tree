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
import { Checkbox } from "@heroui/checkbox";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Plus, Trash2, Copy, BookOpen, ArrowUp, ArrowDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  ExperimentConfig,
  ParamDefinition,
  BlockConfig,
  RoundBlockConfig,
  StaticBlockConfig,
  InformationBlockConfig,
  AiChatBlockConfig,
} from "@/lib/experiment/types";
import { isStaticBlock, isInformationBlock, isAiChatBlock, isNumericParam } from "@/lib/experiment/types";

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
  { key: "history", label: "History" },
];

const DATA_TYPES = [
  { key: "number", label: "Number" },
  { key: "string", label: "String" },
  { key: "boolean", label: "Boolean" },
];

const HISTORY_AGGREGATIONS = [
  { key: "min", label: "min" },
  { key: "max", label: "max" },
  { key: "mean", label: "mean" },
  { key: "mode", label: "mode" },
  { key: "sum", label: "sum" },
  { key: "latest", label: "latest (prev row)" },
];

const RESERVED_NAMES: ReadonlySet<string> = new Set([
  ...HISTORY_AGGREGATIONS.map((a) => a.key),
  "this",
]);

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
    case "history":
      return { type: "history", expression: "" };
    default:
      return { type: "constant", dataType: "number", value: 0 };
  }
}

function ParamValueEditor({
  definition,
  onChange,
  allParamIds,
  allParams,
}: {
  definition: ParamDefinition;
  onChange: (def: ParamDefinition) => void;
  allParamIds: string[];
  allParams?: Record<string, ParamDefinition>;
}) {
  const t = useTranslations("admin.experiments");

  switch (definition.type) {
    case "constant":
      return (
        <div className="flex gap-2 flex-1">
          <Select
            label={t("dataType")}
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
            {DATA_TYPES.map((dt) => (
              <SelectItem key={dt.key}>{t(dt.key === "number" ? "inputNumber" : dt.key === "string" ? "dataString" : "dataBoolean")}</SelectItem>
            ))}
          </Select>
          {definition.dataType === "boolean" ? (
            <Select
              label={t("valueLabel")}
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
              label={t("valueLabel")}
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
            label={t("mean")}
            size="sm"
            type="number"
            value={String(definition.mean)}
            onValueChange={(v) => onChange({ ...definition, mean: Number(v) || 0 })}
          />
          <Input
            label={t("std")}
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
            label={t("min")}
            size="sm"
            type="number"
            value={String(definition.min)}
            onValueChange={(v) => onChange({ ...definition, min: Number(v) || 0 })}
          />
          <Input
            label={t("max")}
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
            label={t("expression")}
            size="sm"
            placeholder="e.g. Math.max({{price}} - {{cost}}, 0)"
            value={definition.expression}
            onValueChange={(v) => onChange({ ...definition, expression: v })}
            minRows={1}
          />
          {allParamIds.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              <span className="text-tiny text-default-400 self-center">{t("insert")}</span>
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
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Input
              label={t("inputLabel")}
              size="sm"
              className="flex-1"
              value={definition.inputLabel || ""}
              onValueChange={(v) => onChange({ ...definition, inputLabel: v })}
            />
            <Select
              label={t("inputType")}
              size="sm"
              className="w-32"
              selectedKeys={[definition.inputType || "text"]}
              onSelectionChange={(keys) => {
                const v = Array.from(keys)[0] as "number" | "text";
                if (v) onChange({ ...definition, inputType: v });
              }}
            >
              <SelectItem key="number">{t("inputNumber")}</SelectItem>
              <SelectItem key="text">{t("inputText")}</SelectItem>
            </Select>
          </div>
          <Textarea
            label={t("validation")}
            size="sm"
            placeholder="e.g. {{this}} > 0 && {{this}} <= 100"
            description={t("validationDesc")}
            value={definition.validation || ""}
            onValueChange={(v) => onChange({ ...definition, validation: v || undefined })}
            minRows={1}
          />
          {allParamIds.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              <span className="text-tiny text-default-400 self-center">{t("insert")}</span>
              <Chip
                size="sm"
                variant="flat"
                color="primary"
                className="cursor-pointer"
                onClick={() =>
                  onChange({
                    ...definition,
                    validation: (definition.validation || "") + "{{this}}",
                  })
                }
              >
                {"{{this}}"}
              </Chip>
              {allParamIds.map((id) => (
                <Chip
                  key={id}
                  size="sm"
                  variant="flat"
                  className="cursor-pointer"
                  onClick={() =>
                    onChange({
                      ...definition,
                      validation: (definition.validation || "") + `{{${id}}}`,
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

    case "history": {
      const nonHistoryParamIds = allParams
        ? allParamIds.filter((id) => allParams[id]?.type !== "history")
        : allParamIds;
      return (
        <div className="flex-1 space-y-2">
          <Textarea
            label={t("historyExpression")}
            size="sm"
            placeholder="e.g. sum({{price}}) * 2 + latest({{cost}})"
            value={definition.expression}
            onValueChange={(v) => onChange({ ...definition, expression: v })}
            minRows={1}
          />
          <div className="space-y-1">
            {nonHistoryParamIds.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                <span className="text-tiny text-default-400 self-center">{t("insertAggregation")}</span>
                {HISTORY_AGGREGATIONS.map((agg) => (
                  <div key={agg.key} className="flex gap-0.5">
                    {nonHistoryParamIds.map((id) => (
                      <Chip
                        key={`${agg.key}-${id}`}
                        size="sm"
                        variant="flat"
                        color="success"
                        className="cursor-pointer"
                        onClick={() =>
                          onChange({
                            ...definition,
                            expression: definition.expression + `${agg.key}({{${id}}})`,
                          })
                        }
                      >
                        {`${agg.key}({{${id}}})`}
                      </Chip>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <p className="text-tiny text-default-400">
              Use agg({`{{param}}`}) syntax. Aggregations: min, max, mean, mode, sum (all rows), latest (previous row).
              History params cannot reference other history params.
            </p>
          </div>
        </div>
      );
    }
  }
}

function ParamRow({
  paramId,
  definition,
  onChangeId,
  onChangeDef,
  onRemove,
  allParamIds,
  allParams,
  inheritedFrom,
}: {
  paramId: string;
  definition: ParamDefinition;
  onChangeId: (oldId: string, newId: string, newName: string) => void;
  onChangeDef: (id: string, def: ParamDefinition) => void;
  onRemove: (id: string) => void;
  allParamIds: string[];
  allParams?: Record<string, ParamDefinition>;
  inheritedFrom?: string;
}) {
  const t = useTranslations("admin.experiments");
  const [nameInput, setNameInput] = useState(
    paramId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  );
  const [duplicateError, setDuplicateError] = useState(false);
  const [reservedError, setReservedError] = useState(false);

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-content2/50">
      <div className="flex flex-col gap-1 min-w-[180px]">
        <Input
          label={t("nameLabel")}
          size="sm"
          value={nameInput}
          onValueChange={(v) => {
            setNameInput(v);
            setDuplicateError(false);
            setReservedError(false);
          }}
          onBlur={() => {
            const newSlug = slugify(nameInput);
            if (!newSlug || newSlug === paramId) return;
            if (RESERVED_NAMES.has(newSlug)) {
              setReservedError(true);
              setNameInput(
                paramId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              );
              return;
            }
            const isDuplicate =
              allParamIds.filter((id) => id !== paramId).includes(newSlug);
            if (isDuplicate) {
              setDuplicateError(true);
              setNameInput(
                paramId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              );
            } else {
              setDuplicateError(false);
              setReservedError(false);
              onChangeId(paramId, newSlug, nameInput);
            }
          }}
          isInvalid={duplicateError || reservedError}
          errorMessage={
            reservedError
              ? t("reservedNameError", { name: slugify(nameInput) })
              : duplicateError
                ? t("duplicateParamError")
                : undefined
          }
        />
        <Chip size="sm" variant="flat" color="secondary">
          {paramId}
        </Chip>
        {inheritedFrom && (
          <Chip size="sm" variant="dot" color="warning">
            {t("inheritedFrom", { source: inheritedFrom })}
          </Chip>
        )}
      </div>

      <Select
        label={t("typeLabel")}
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
        {VALUE_TYPES.map((vt) => (
          <SelectItem key={vt.key}>{t(vt.key === "norm" ? "normal" : vt.key === "unif" ? "uniform" : vt.key === "student_input" ? "studentInput" : vt.key as "constant" | "equation" | "history")}</SelectItem>
        ))}
      </Select>

      <ParamValueEditor
        definition={definition}
        onChange={(def) => onChangeDef(paramId, def)}
        allParamIds={allParamIds.filter((id) => id !== paramId)}
        allParams={allParams}
      />

      {isNumericParam(definition) && (
        <div className="flex flex-col gap-1 mt-2">
          <Checkbox
            size="sm"
            isSelected={!!definition.visualize}
            onValueChange={(checked) =>
              onChangeDef(paramId, { ...definition, visualize: checked || undefined, visualizeMax: checked ? definition.visualizeMax : undefined })
            }
          >
            <span className="text-xs">{t("visualize")}</span>
          </Checkbox>
          {definition.visualize && (
            <Input
              label={t("barMax")}
              size="sm"
              type="number"
              className="w-24"
              value={definition.visualizeMax != null ? String(definition.visualizeMax) : ""}
              onValueChange={(v) =>
                onChangeDef(paramId, { ...definition, visualizeMax: v ? Number(v) || undefined : undefined })
              }
              placeholder="Auto"
            />
          )}
          <Checkbox
            size="sm"
            isSelected={!!definition.displayOnStudentSide}
            onValueChange={(checked) =>
              onChangeDef(paramId, { ...definition, displayOnStudentSide: checked || undefined })
            }
          >
            <span className="text-xs">{t("displayOnStudentSide")}</span>
          </Checkbox>
        </div>
      )}

      {!isNumericParam(definition) && (
        <Checkbox
          size="sm"
          className="mt-2"
          isSelected={!!definition.displayOnStudentSide}
          onValueChange={(checked) =>
            onChangeDef(paramId, { ...definition, displayOnStudentSide: checked || undefined })
          }
        >
          <span className="text-xs">{t("displayOnStudentSide")}</span>
        </Checkbox>
      )}

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
  const t = useTranslations("admin.experiments");
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
    if (params[newId] || allParamIds.includes(newId)) return;
    if (RESERVED_NAMES.has(newId)) return;
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
          allParams={params}
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
                {t("inherited", { level: source })}
              </Chip>
              <span className="text-sm text-default-400">{def.type}</span>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="flat"
                startContent={<Copy className="w-3 h-3" />}
                onPress={() => onChange({ ...params, [id]: { ...def } })}
              >
                {t("override")}
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
        {t("addParam")}
      </Button>
    </div>
  );
}

function ParamHelpModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("admin.experiments");
  const tCommon = useTranslations("common");
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <span>{t("paramRefGuide")}</span>
          </div>
        </ModalHeader>
        <ModalBody className="space-y-1 pb-6">
          <h3 className="text-lg font-bold mt-2 mb-3 border-b border-divider pb-2">Parameter Types</h3>

          <div className="space-y-4">
            <div className="rounded-lg bg-content2/50 p-3 space-y-1">
              <h4 className="text-sm font-semibold text-primary">Constant</h4>
              <p className="text-sm text-default-600">A fixed value (number, string, or boolean) that does not change between rounds.</p>
            </div>

            <div className="rounded-lg bg-content2/50 p-3 space-y-1">
              <h4 className="text-sm font-semibold text-primary">Normal Distribution</h4>
              <p className="text-sm text-default-600">Samples a random number from a normal (Gaussian) distribution each round. Configure the <strong>mean</strong> (&mu;) and <strong>standard deviation</strong> (&sigma;).</p>
            </div>

            <div className="rounded-lg bg-content2/50 p-3 space-y-1">
              <h4 className="text-sm font-semibold text-primary">Uniform Distribution</h4>
              <p className="text-sm text-default-600">Samples a random number uniformly between <strong>min</strong> and <strong>max</strong> each round.</p>
            </div>

            <div className="rounded-lg bg-content2/50 p-3 space-y-2">
              <h4 className="text-sm font-semibold text-primary">Equation</h4>
              <p className="text-sm text-default-600">Computes a value from other parameters in the <em>current round</em>. Returns a <strong>number</strong>.</p>
              <div className="space-y-1">
                <p className="text-xs font-medium text-default-500">Available in expressions:</p>
                <ul className="text-sm text-default-600 list-disc list-inside space-y-0.5">
                  <li><code className="text-xs bg-content3 px-1 py-0.5 rounded">{"{{param_id}}"}</code> &mdash; value of another param in this round</li>
                  <li><code className="text-xs bg-content3 px-1 py-0.5 rounded">Math.*</code> &mdash; all Math functions and constants</li>
                  <li>Arithmetic: <code className="text-xs bg-content3 px-1 py-0.5 rounded">+ - * / % **</code></li>
                  <li>Comparisons & ternary: <code className="text-xs bg-content3 px-1 py-0.5 rounded">{"{{x}} > 5 ? 1 : 0"}</code></li>
                </ul>
              </div>
              <div className="space-y-1 mt-1">
                <p className="text-xs font-medium text-default-500">Examples:</p>
                <pre className="text-xs bg-content3 rounded-md p-2 overflow-x-auto"><code>{"Math.max({{price}} - {{cost}}, 0)"}</code></pre>
                <pre className="text-xs bg-content3 rounded-md p-2 overflow-x-auto"><code>{"{{quantity}} * {{price}} * (1 - {{discount}} / 100)"}</code></pre>
              </div>
            </div>

            <div className="rounded-lg bg-content2/50 p-3 space-y-2">
              <h4 className="text-sm font-semibold text-primary">Student Input</h4>
              <p className="text-sm text-default-600">An input field the student fills in during the game.</p>
              <p className="text-sm text-default-600"><strong>Validation (optional):</strong> A boolean expression that must be <code className="text-xs bg-content3 px-1 py-0.5 rounded">true</code> for the student to continue.</p>
              <div className="space-y-1">
                <p className="text-xs font-medium text-default-500">Available in validation expressions:</p>
                <ul className="text-sm text-default-600 list-disc list-inside space-y-0.5">
                  <li><code className="text-xs bg-content3 px-1 py-0.5 rounded">{"{{this}}"}</code> &mdash; the student&apos;s input value</li>
                  <li><code className="text-xs bg-content3 px-1 py-0.5 rounded">{"{{param_id}}"}</code> &mdash; value of another param in this round</li>
                  <li><code className="text-xs bg-content3 px-1 py-0.5 rounded">Math.*</code>, arithmetic, comparisons &mdash; same as Equation</li>
                  <li>Boolean logic: <code className="text-xs bg-content3 px-1 py-0.5 rounded">{"&&"}</code> <code className="text-xs bg-content3 px-1 py-0.5 rounded">{"||"}</code> <code className="text-xs bg-content3 px-1 py-0.5 rounded">!</code></li>
                </ul>
              </div>
              <div className="space-y-1 mt-1">
                <p className="text-xs font-medium text-default-500">Validation examples:</p>
                <pre className="text-xs bg-content3 rounded-md p-2 overflow-x-auto"><code>{"{{this}} > 0 && {{this}} <= 100"}</code></pre>
                <pre className="text-xs bg-content3 rounded-md p-2 overflow-x-auto"><code>{"{{this}} >= {{min_price}} && {{this}} <= {{max_price}}"}</code></pre>
              </div>
            </div>

            <div className="rounded-lg bg-content2/50 p-3 space-y-2">
              <h4 className="text-sm font-semibold text-primary">History</h4>
              <p className="text-sm text-default-600">Aggregates parameter values across rounds. Returns a <strong>number</strong>. History variables <strong>cannot</strong> reference other history variables.</p>
              <div className="space-y-1">
                <p className="text-xs font-medium text-default-500">Available in history expressions:</p>
                <ul className="text-sm text-default-600 list-disc list-inside space-y-0.5">
                  <li><code className="text-xs bg-content3 px-1 py-0.5 rounded">{"agg({{param_id}})"}</code> &mdash; aggregation call (see functions below)</li>
                  <li><code className="text-xs bg-content3 px-1 py-0.5 rounded">Math.*</code>, arithmetic &mdash; same as Equation</li>
                  <li><strong>Not</strong> supported: bare <code className="text-xs bg-content3 px-1 py-0.5 rounded">{"{{param_id}}"}</code> references (must be wrapped in an aggregation function)</li>
                </ul>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-default-500">Aggregation functions:</p>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <div className="flex items-center gap-1.5"><code className="text-xs bg-content3 px-1 py-0.5 rounded">{"sum({{p}})"}</code> <span className="text-default-500 text-xs">all rows</span></div>
                  <div className="flex items-center gap-1.5"><code className="text-xs bg-content3 px-1 py-0.5 rounded">{"mean({{p}})"}</code> <span className="text-default-500 text-xs">average</span></div>
                  <div className="flex items-center gap-1.5"><code className="text-xs bg-content3 px-1 py-0.5 rounded">{"min({{p}})"}</code> <span className="text-default-500 text-xs">minimum</span></div>
                  <div className="flex items-center gap-1.5"><code className="text-xs bg-content3 px-1 py-0.5 rounded">{"max({{p}})"}</code> <span className="text-default-500 text-xs">maximum</span></div>
                  <div className="flex items-center gap-1.5"><code className="text-xs bg-content3 px-1 py-0.5 rounded">{"mode({{p}})"}</code> <span className="text-default-500 text-xs">most frequent</span></div>
                  <div className="flex items-center gap-1.5"><code className="text-xs bg-content3 px-1 py-0.5 rounded">{"latest({{p}})"}</code> <span className="text-default-500 text-xs">previous round only</span></div>
                </div>
              </div>
              <div className="space-y-1 mt-1">
                <p className="text-xs font-medium text-default-500">Examples (combine aggregations with arithmetic):</p>
                <pre className="text-xs bg-content3 rounded-md p-2 overflow-x-auto"><code>{"sum({{revenue}}) - sum({{cost}})"}</code></pre>
                <pre className="text-xs bg-content3 rounded-md p-2 overflow-x-auto"><code>{"latest({{price}}) * 1.1"}</code></pre>
              </div>
            </div>
          </div>

          <h3 className="text-lg font-bold mt-6 mb-3 border-b border-divider pb-2">Expression Comparison</h3>
          <p className="text-sm text-default-600 mb-3">Three places use expressions. They all support Math.* functions and arithmetic (+, -, *, /, %, **), but differ in what they can reference:</p>
          <p className="text-sm text-default-600"><strong>Equation</strong> — can use {"{{param_id}}"} to read current-round params. Returns a number.</p>
          <p className="text-sm text-default-600"><strong>Validation</strong> — can use {"{{this}}"} for the student&apos;s input, {"{{param_id}}"} for other params, and boolean logic ({"&&"}, {"||"}, !). Returns true or false.</p>
          <p className="text-sm text-default-600"><strong>History</strong> — can use aggregation calls like sum({"{{param}}"}), mean({"{{param}}"}), etc. Cannot use bare {"{{param_id}}"} — params must be wrapped in an aggregation function. Returns a number.</p>

          <h3 className="text-lg font-bold mt-6 mb-3 border-b border-divider pb-2">Templates</h3>
          <p className="text-sm text-default-600">Use <code className="text-xs bg-content3 px-1 py-0.5 rounded">{"{{param_id}}"}</code> placeholders in templates. They are replaced with resolved values at runtime.</p>
          <div className="flex gap-2 mt-2">
            <Chip size="sm" variant="flat" color="primary">Intro</Chip>
            <span className="text-sm text-default-500 self-center">Read-only info</span>
          </div>
          <div className="flex gap-2 mt-1">
            <Chip size="sm" variant="flat" color="secondary">Decision</Chip>
            <span className="text-sm text-default-500 self-center">Student inputs</span>
          </div>
          <div className="flex gap-2 mt-1">
            <Chip size="sm" variant="flat" color="success">Result</Chip>
            <span className="text-sm text-default-500 self-center">Computed outcomes</span>
          </div>

          <h3 className="text-lg font-bold mt-6 mb-3 border-b border-divider pb-2">Override Hierarchy</h3>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Chip size="sm" variant="flat" className="mt-0.5 shrink-0">1</Chip>
              <p className="text-sm text-default-600"><strong>Experiment level</strong> &mdash; defaults for all rounds</p>
            </div>
            <div className="flex items-start gap-2">
              <Chip size="sm" variant="flat" color="warning" className="mt-0.5 shrink-0">2</Chip>
              <p className="text-sm text-default-600"><strong>Block level</strong> &mdash; overrides experiment defaults for all rounds in that block</p>
            </div>
            <div className="flex items-start gap-2">
              <Chip size="sm" variant="flat" color="danger" className="mt-0.5 shrink-0">3</Chip>
              <p className="text-sm text-default-600"><strong>Round level</strong> &mdash; overrides block and experiment defaults for that specific round</p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onPress={onClose}>{tCommon("close")}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function ParameterEditor({ config, onChange }: ParameterEditorProps) {
  const t = useTranslations("admin.experiments");
  const allParamIds = Object.keys(config.params);
  const { isOpen: isHelpOpen, onOpen: onHelpOpen, onClose: onHelpClose } = useDisclosure();

  const handleExpParamsChange = (params: Record<string, ParamDefinition>) => {
    onChange({ ...config, params });
  };

  const handleBlockParamsChange = (
    blockIdx: number,
    params: Record<string, ParamDefinition>,
  ) => {
    const blocks = [...config.blocks];
    const block = blocks[blockIdx];
    if (isStaticBlock(block) || isInformationBlock(block) || isAiChatBlock(block)) return;
    blocks[blockIdx] = { ...block, params };
    onChange({ ...config, blocks });
  };

  const handleRoundParamsChange = (
    blockIdx: number,
    roundIdx: number,
    params: Record<string, ParamDefinition>,
  ) => {
    const blocks = [...config.blocks];
    const block = blocks[blockIdx];
    if (isStaticBlock(block) || isInformationBlock(block) || isAiChatBlock(block)) return;
    const rounds = [...block.rounds];
    rounds[roundIdx] = { ...rounds[roundIdx], params };
    blocks[blockIdx] = { ...block, rounds };
    onChange({ ...config, blocks });
  };

  const addBlock = () => {
    const newBlock: RoundBlockConfig = {
      id: `b_${crypto.randomUUID().slice(0, 8)}`,
      rounds: [{ id: `r_${crypto.randomUUID().slice(0, 8)}` }],
    };
    onChange({ ...config, blocks: [...config.blocks, newBlock] });
  };

  const addStaticBlock = () => {
    const newBlock: StaticBlockConfig = {
      type: "static",
      id: `b_${crypto.randomUUID().slice(0, 8)}`,
      title: "",
      body: "",
    };
    onChange({ ...config, blocks: [...config.blocks, newBlock] });
  };

  const addInformationBlock = () => {
    const newBlock: InformationBlockConfig = {
      type: "information",
      id: `b_${crypto.randomUUID().slice(0, 8)}`,
      title: "",
      body: "",
    };
    onChange({ ...config, blocks: [...config.blocks, newBlock] });
  };

  const addAiChatBlock = () => {
    const newBlock: AiChatBlockConfig = {
      type: "ai_chat",
      id: `b_${crypto.randomUUID().slice(0, 8)}`,
      systemPromptTemplate: "",
    };
    onChange({ ...config, blocks: [...config.blocks, newBlock] });
  };

  const removeBlock = (idx: number) => {
    const blocks = config.blocks.filter((_, i) => i !== idx);
    onChange({ ...config, blocks });
  };

  const addRound = (blockIdx: number) => {
    const blocks = [...config.blocks];
    const block = blocks[blockIdx];
    if (isStaticBlock(block) || isInformationBlock(block) || isAiChatBlock(block)) return;
    blocks[blockIdx] = {
      ...block,
      rounds: [
        ...block.rounds,
        { id: `r_${crypto.randomUUID().slice(0, 8)}` },
      ],
    };
    onChange({ ...config, blocks });
  };

  const removeRound = (blockIdx: number, roundIdx: number) => {
    const blocks = [...config.blocks];
    const block = blocks[blockIdx];
    if (isStaticBlock(block) || isInformationBlock(block) || isAiChatBlock(block)) return;
    blocks[blockIdx] = {
      ...block,
      rounds: block.rounds.filter((_: unknown, i: number) => i !== roundIdx),
    };
    onChange({ ...config, blocks });
  };

  const moveBlock = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= config.blocks.length) return;
    const blocks = [...config.blocks];
    [blocks[idx], blocks[targetIdx]] = [blocks[targetIdx], blocks[idx]];
    onChange({ ...config, blocks });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Tabs aria-label="Parameter scope" variant="underlined">
        <Tab key="experiment" title={t("experimentLevel")}>
          <Card>
            <CardHeader>
              <h4 className="text-medium font-semibold">
                {t("expLevelParams")}
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

        <Tab key="blocks" title={t("blockOverrides")}>
          <div className="space-y-4">
            <Accordion variant="bordered">
              {config.blocks.map((block, bi) => (
                <AccordionItem
                  key={block.id}
                  title={
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          className="w-5 h-5 min-w-0"
                          isDisabled={bi === 0}
                          onPress={() => moveBlock(bi, -1)}
                          aria-label="Move block up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          className="w-5 h-5 min-w-0"
                          isDisabled={bi === config.blocks.length - 1}
                          onPress={() => moveBlock(bi, 1)}
                          aria-label="Move block down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                      </div>
                      <span>{t("blockN", { n: bi + 1 })}</span>
                      {isStaticBlock(block) && (
                        <Chip size="sm" variant="flat" color="secondary">{t("staticLabel")}</Chip>
                      )}
                      {isInformationBlock(block) && (
                        <Chip size="sm" variant="flat" color="warning">{t("informationLabel")}</Chip>
                      )}
                      {isAiChatBlock(block) && (
                        <Chip size="sm" variant="flat" color="primary">{t("aiChatLabel")}</Chip>
                      )}
                      {block.label && (
                        <Chip size="sm" variant="flat">
                          {block.label}
                        </Chip>
                      )}
                      <Chip size="sm" variant="flat" color="secondary">
                        {block.id}
                      </Chip>
                    </div>
                  }
                >
                  {isStaticBlock(block) ? (
                    <div className="space-y-3">
                      <Input
                        label={t("blockLabelOptional")}
                        size="sm"
                        value={block.label || ""}
                        onValueChange={(v) => {
                          const blocks = [...config.blocks];
                          blocks[bi] = { ...blocks[bi], label: v || undefined };
                          onChange({ ...config, blocks });
                        }}
                        placeholder="e.g. Instructions"
                      />
                      <Input
                        label={t("staticTitle")}
                        size="sm"
                        value={block.title}
                        onValueChange={(v) => {
                          const blocks = [...config.blocks];
                          blocks[bi] = { ...blocks[bi], title: v } as StaticBlockConfig;
                          onChange({ ...config, blocks });
                        }}
                        placeholder="e.g. Welcome to the Experiment"
                      />
                      <Textarea
                        label={t("staticBody")}
                        value={block.body}
                        onValueChange={(v) => {
                          const blocks = [...config.blocks];
                          blocks[bi] = { ...blocks[bi], body: v } as StaticBlockConfig;
                          onChange({ ...config, blocks });
                        }}
                        placeholder="Static content displayed to the participant..."
                        minRows={3}
                        maxRows={20}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="flat"
                          color="danger"
                          onPress={() => removeBlock(bi)}
                          isDisabled={config.blocks.length <= 1}
                        >
                          {t("removeBlock")}
                        </Button>
                      </div>
                    </div>
                  ) : isInformationBlock(block) ? (
                    <div className="space-y-3">
                      <Input
                        label={t("blockLabelOptional")}
                        size="sm"
                        value={block.label || ""}
                        onValueChange={(v) => {
                          const blocks = [...config.blocks];
                          blocks[bi] = { ...blocks[bi], label: v || undefined };
                          onChange({ ...config, blocks });
                        }}
                        placeholder="e.g. Instructions"
                      />
                      <Input
                        label={t("staticTitle")}
                        size="sm"
                        value={block.title}
                        onValueChange={(v) => {
                          const blocks = [...config.blocks];
                          blocks[bi] = { ...blocks[bi], title: v } as InformationBlockConfig;
                          onChange({ ...config, blocks });
                        }}
                        placeholder="e.g. Important Information"
                      />
                      <Textarea
                        label={t("staticBody")}
                        value={block.body}
                        onValueChange={(v) => {
                          const blocks = [...config.blocks];
                          blocks[bi] = { ...blocks[bi], body: v } as InformationBlockConfig;
                          onChange({ ...config, blocks });
                        }}
                        placeholder="Information content displayed full-screen to the participant..."
                        minRows={3}
                        maxRows={20}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="flat"
                          color="danger"
                          onPress={() => removeBlock(bi)}
                          isDisabled={config.blocks.length <= 1}
                        >
                          {t("removeBlock")}
                        </Button>
                      </div>
                    </div>
                  ) : isAiChatBlock(block) ? (
                    <div className="space-y-3">
                      <Input
                        label={t("blockLabelOptional")}
                        size="sm"
                        value={block.label || ""}
                        onValueChange={(v) => {
                          const blocks = [...config.blocks];
                          blocks[bi] = { ...blocks[bi], label: v || undefined };
                          onChange({ ...config, blocks });
                        }}
                        placeholder="e.g. AI Discussion"
                      />
                      <Textarea
                        label={t("systemPromptTemplate")}
                        value={block.systemPromptTemplate}
                        onValueChange={(v) => {
                          const blocks = [...config.blocks];
                          blocks[bi] = { ...blocks[bi], systemPromptTemplate: v } as AiChatBlockConfig;
                          onChange({ ...config, blocks });
                        }}
                        placeholder="You are an assistant helping with this experiment. The current price is {{price}}..."
                        minRows={4}
                        maxRows={20}
                      />
                      <div className="flex gap-1 flex-wrap items-center">
                        <span className="text-tiny text-default-400">{t("insertParamColon")}</span>
                        {allParamIds.map((id) => (
                          <Chip
                            key={id}
                            size="sm"
                            variant="flat"
                            color="primary"
                            className="cursor-pointer"
                            onClick={() => {
                              const blocks = [...config.blocks];
                              const b = blocks[bi] as AiChatBlockConfig;
                              blocks[bi] = { ...b, systemPromptTemplate: b.systemPromptTemplate + `{{${id}}}` };
                              onChange({ ...config, blocks });
                            }}
                          >
                            {`{{${id}}}`}
                          </Chip>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="flat"
                          color="danger"
                          onPress={() => removeBlock(bi)}
                          isDisabled={config.blocks.length <= 1}
                        >
                          {t("removeBlock")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Input
                        label={t("blockLabelField")}
                        size="sm"
                        value={block.label || ""}
                        onValueChange={(v) => {
                          const blocks = [...config.blocks];
                          blocks[bi] = { ...blocks[bi], label: v || undefined };
                          onChange({ ...config, blocks });
                        }}
                        placeholder="e.g. Practice Block"
                      />
                      <ParamList
                        params={block.params || {}}
                        onChange={(p) => handleBlockParamsChange(bi, p)}
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
                          onPress={() => removeBlock(bi)}
                          isDisabled={config.blocks.length <= 1}
                        >
                          {t("removeBlock")}
                        </Button>
                      </div>
                    </div>
                  )}
                </AccordionItem>
              ))}
            </Accordion>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="flat"
                color="primary"
                startContent={<Plus className="w-4 h-4" />}
                onPress={addBlock}
              >
                {t("addRoundBlock")}
              </Button>
              <Button
                size="sm"
                variant="flat"
                color="secondary"
                startContent={<Plus className="w-4 h-4" />}
                onPress={addStaticBlock}
              >
                {t("addStaticBlock")}
              </Button>
              <Button
                size="sm"
                variant="flat"
                color="warning"
                startContent={<Plus className="w-4 h-4" />}
                onPress={addInformationBlock}
              >
                {t("addInformationBlock")}
              </Button>
              <Button
                size="sm"
                variant="flat"
                color="primary"
                startContent={<Plus className="w-4 h-4" />}
                onPress={addAiChatBlock}
              >
                {t("addAiChatBlock")}
              </Button>
            </div>
          </div>
        </Tab>

        <Tab key="rounds" title={t("roundOverrides")}>
          <div className="space-y-4">
            <Accordion variant="bordered">
              {config.blocks.map((block, bi) => {
                if (isStaticBlock(block)) {
                  return (
                    <AccordionItem
                      key={block.id}
                      title={
                        <div className="flex items-center gap-2">
                          <span>{t("blockN", { n: bi + 1 })} {block.label ? `(${block.label})` : ""}</span>
                          <Chip size="sm" variant="flat" color="secondary">{t("staticLabel")}</Chip>
                        </div>
                      }
                    >
                      <p className="text-sm text-default-400">
                        {t("staticNoRoundsOrParams")}
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
                          <span>{t("blockN", { n: bi + 1 })} {block.label ? `(${block.label})` : ""}</span>
                          <Chip size="sm" variant="flat" color="warning">{t("informationLabel")}</Chip>
                        </div>
                      }
                    >
                      <p className="text-sm text-default-400">
                        {t("informationNoRoundsOrParams")}
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
                          <span>{t("blockN", { n: bi + 1 })} {block.label ? `(${block.label})` : ""}</span>
                          <Chip size="sm" variant="flat" color="primary">{t("aiChatLabel")}</Chip>
                        </div>
                      }
                    >
                      <p className="text-sm text-default-400">
                        {t("aiChatNoRoundsOrParams")}
                      </p>
                    </AccordionItem>
                  );
                }
                return (
                  <AccordionItem
                    key={block.id}
                    title={
                      <span>
                        {t("blockN", { n: bi + 1 })} {block.label ? `(${block.label})` : ""}
                      </span>
                    }
                  >
                    <Accordion variant="splitted">
                      {block.rounds.map((round, ri) => (
                        <AccordionItem
                          key={round.id}
                          title={
                            <div className="flex items-center gap-2">
                              <span>{t("roundN", { n: ri + 1 })}</span>
                              <Chip size="sm" variant="flat" color="secondary">
                                {round.id}
                              </Chip>
                            </div>
                          }
                        >
                          <div className="space-y-3">
                            <ParamList
                              params={round.params || {}}
                              onChange={(p) => handleRoundParamsChange(bi, ri, p)}
                              allParamIds={allParamIds}
                              inheritedParams={{
                                ...Object.fromEntries(
                                  Object.entries(config.params).map(([k, v]) => [
                                    k,
                                    { def: v, source: "experiment" },
                                  ]),
                                ),
                                ...Object.fromEntries(
                                  Object.entries(block.params || {}).map(([k, v]) => [
                                    k,
                                    { def: v, source: t("blockN", { n: bi + 1 }) },
                                  ]),
                                ),
                              }}
                            />
                            <Button
                              size="sm"
                              variant="flat"
                              color="danger"
                              onPress={() => removeRound(bi, ri)}
                              isDisabled={block.rounds.length <= 1}
                            >
                              {t("removeRound")}
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
                      onPress={() => addRound(bi)}
                    >
                      {t("addRound")}
                    </Button>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </Tab>
      </Tabs>
        </div>
        <Button
          isIconOnly
          variant="light"
          size="sm"
          onPress={onHelpOpen}
          className="self-start mt-1"
          aria-label={t("paramRefGuide")}
        >
          <BookOpen className="w-5 h-5" />
        </Button>
      </div>
      <ParamHelpModal isOpen={isHelpOpen} onClose={onHelpClose} />
    </div>
  );
}
