export type HistoryAggregation = "min" | "max" | "mean" | "mode" | "sum" | "latest";

export type ParamDefinition =
  | { type: "constant"; dataType: "number" | "string" | "boolean"; value: number | string | boolean; visualize?: boolean; visualizeMax?: number; displayOnStudentSide?: boolean }
  | { type: "norm"; mean: number; std: number; visualize?: boolean; visualizeMax?: number; displayOnStudentSide?: boolean }
  | { type: "unif"; min: number; max: number; visualize?: boolean; visualizeMax?: number; displayOnStudentSide?: boolean }
  | { type: "equation"; expression: string; visualize?: boolean; visualizeMax?: number; displayOnStudentSide?: boolean }
  | { type: "student_input"; inputLabel?: string; inputType?: "number" | "text"; validation?: string; visualize?: boolean; visualizeMax?: number; displayOnStudentSide?: boolean }
  | { type: "history"; expression: string; visualize?: boolean; visualizeMax?: number; displayOnStudentSide?: boolean };

export type TemplateKind = "intro" | "decision" | "result";

export const TEMPLATE_KINDS: TemplateKind[] = ["intro", "decision", "result"];

export interface TemplateSet {
  introTemplate: string;
  decisionTemplate: string;
  resultTemplate: string;
}

export interface RoundConfig {
  id: string;
  params?: Record<string, ParamDefinition>;
  introTemplate?: string;
  decisionTemplate?: string;
  resultTemplate?: string;
}

export interface RoundBlockConfig {
  type?: "round";
  id: string;
  label?: string;
  params?: Record<string, ParamDefinition>;
  introTemplate?: string;
  decisionTemplate?: string;
  resultTemplate?: string;
  rounds: RoundConfig[];
}

export interface StaticBlockConfig {
  type: "static";
  id: string;
  label?: string;
  title: string;
  body: string;
}

export interface AiChatBlockConfig {
  type: "ai_chat";
  id: string;
  label?: string;
  systemPromptTemplate: string;
}

export type BlockConfig = RoundBlockConfig | StaticBlockConfig | AiChatBlockConfig;

export interface ExperimentConfig {
  params: Record<string, ParamDefinition>;
  introTemplate: string;
  decisionTemplate: string;
  resultTemplate: string;
  gameGuide?: string;
  blocks: BlockConfig[];
}

export type ParamSource = "experiment" | "block" | "round";

export interface ResolvedParam {
  paramId: string;
  definition: ParamDefinition;
  value: number | string | boolean | null;
  source: ParamSource;
}

export type TemplateSegment =
  | { type: "text"; content: string }
  | { type: "value"; paramId: string; value: number | string | boolean; source: ParamSource }
  | { type: "input"; paramId: string; inputLabel?: string; inputType?: "number" | "text"; validation?: string };

export type ParamValue = number | string | boolean | null;

export interface HistoryRow {
  roundIndex: number;
  values: Record<string, ParamValue>;
  updatedAt: string;
}

export interface FlatRoundConfig {
  type?: "round";
  blockIndex: number;
  roundIndex: number;
  blockId: string;
  roundId: string;
  blockLabel?: string;
  params: Record<string, { def: ParamDefinition; source: ParamSource }>;
  introTemplate: string;
  decisionTemplate: string;
  resultTemplate: string;
}

export interface FlatStaticBlockConfig {
  type: "static";
  blockIndex: number;
  blockId: string;
  blockLabel?: string;
  title: string;
  body: string;
}

export interface FlatAiChatBlockConfig {
  type: "ai_chat";
  blockIndex: number;
  blockId: string;
  blockLabel?: string;
  systemPromptTemplate: string;
}

export type FlatStepConfig = FlatRoundConfig | FlatStaticBlockConfig | FlatAiChatBlockConfig;

export interface ChatLogEntry {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export function isStaticBlock(block: BlockConfig): block is StaticBlockConfig {
  return block.type === "static";
}

export function isAiChatBlock(block: BlockConfig): block is AiChatBlockConfig {
  return block.type === "ai_chat";
}

export function isRoundBlock(block: BlockConfig): block is RoundBlockConfig {
  return block.type !== "static" && block.type !== "ai_chat";
}

export function isFlatStaticStep(step: FlatStepConfig): step is FlatStaticBlockConfig {
  return step.type === "static";
}

export function isFlatAiChatStep(step: FlatStepConfig): step is FlatAiChatBlockConfig {
  return step.type === "ai_chat";
}

export function isFlatRoundStep(step: FlatStepConfig): step is FlatRoundConfig {
  return step.type !== "static" && step.type !== "ai_chat";
}

export function isNumericParam(def: ParamDefinition): boolean {
  if (def.type === "constant") return def.dataType === "number";
  if (def.type === "student_input") return def.inputType === "number";
  return def.type === "norm" || def.type === "unif" || def.type === "equation" || def.type === "history";
}
