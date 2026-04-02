export type HistoryAggregation = "min" | "max" | "mean" | "mode" | "sum" | "latest";

export type ParamDefinition =
  | { type: "constant"; dataType: "number" | "string" | "boolean"; value: number | string | boolean; visualize?: boolean; visualizeMax?: number; displayOnStudentSide?: boolean }
  | { type: "norm"; mean: number; std: number; visualize?: boolean; visualizeMax?: number; displayOnStudentSide?: boolean }
  | { type: "unif"; min: number; max: number; visualize?: boolean; visualizeMax?: number; displayOnStudentSide?: boolean }
  | { type: "equation"; expression: string; visualize?: boolean; visualizeMax?: number; displayOnStudentSide?: boolean }
  | { type: "student_input"; inputLabel?: string; inputType?: "number" | "text" | "multiple_choice" | "slider"; options?: string[]; sliderMin?: number; sliderMax?: number; sliderStep?: number; validation?: string; visualize?: boolean; visualizeMax?: number; displayOnStudentSide?: boolean }
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

export interface InformationBlockConfig {
  type: "information";
  id: string;
  label?: string;
  title: string;
  body: string;
}

export type TtsVoice = "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage" | "shimmer" | "verse" | "marin" | "cedar";

export const TTS_VOICES: TtsVoice[] = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"];

export interface AiChatBlockConfig {
  type: "ai_chat";
  id: string;
  label?: string;
  systemPromptTemplate: string;
  responseMode?: "text" | "voice";
  ttsVoice?: TtsVoice;
  ttsInstructions?: string;
  initiator?: "user" | "ai";
}

export const LIKERT_SCALE_PRESETS = {
  agreement_5: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"],
  agreement_7: ["Strongly Disagree", "Disagree", "Somewhat Disagree", "Neutral", "Somewhat Agree", "Agree", "Strongly Agree"],
  satisfaction_5: ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"],
  frequency_5: ["Never", "Rarely", "Sometimes", "Often", "Always"],
  likelihood_5: ["Very Unlikely", "Unlikely", "Neutral", "Likely", "Very Likely"],
} as const;

export type LikertPresetKey = keyof typeof LIKERT_SCALE_PRESETS;

export interface SurveyQuestion {
  id: string;
  text: string;
  questionType: "text" | "multiple_choice" | "likert_scale";
  options?: string[];
  scalePoints?: number;
  scaleLabels?: string[];
}

export interface SurveyBlockConfig {
  type: "survey";
  id: string;
  label?: string;
  questions: SurveyQuestion[];
}

export type BlockConfig = RoundBlockConfig | StaticBlockConfig | InformationBlockConfig | AiChatBlockConfig | SurveyBlockConfig;

export type RoundProgressTrigger = "after_intro" | "after_decision" | "after_result";

export interface ExperimentConfig {
  params: Record<string, ParamDefinition>;
  introTemplate: string;
  decisionTemplate: string;
  resultTemplate: string;
  gameGuide?: string;
  roundProgressTrigger?: RoundProgressTrigger;
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
  | { type: "input"; paramId: string; inputLabel?: string; inputType?: "number" | "text" | "multiple_choice" | "slider"; options?: string[]; sliderMin?: number; sliderMax?: number; sliderStep?: number; validation?: string };

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

export interface FlatInformationBlockConfig {
  type: "information";
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
  responseMode?: "text" | "voice";
  ttsVoice?: TtsVoice;
  ttsInstructions?: string;
  initiator?: "user" | "ai";
}

export interface FlatSurveyBlockConfig {
  type: "survey";
  blockIndex: number;
  blockId: string;
  blockLabel?: string;
  questions: SurveyQuestion[];
}

export type FlatStepConfig = FlatRoundConfig | FlatStaticBlockConfig | FlatInformationBlockConfig | FlatAiChatBlockConfig | FlatSurveyBlockConfig;

export interface ChatLogEntry {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  audioKey?: string;
}

export function isStaticBlock(block: BlockConfig): block is StaticBlockConfig {
  return block.type === "static";
}

export function isInformationBlock(block: BlockConfig): block is InformationBlockConfig {
  return block.type === "information";
}

export function isAiChatBlock(block: BlockConfig): block is AiChatBlockConfig {
  return block.type === "ai_chat";
}

export function isSurveyBlock(block: BlockConfig): block is SurveyBlockConfig {
  return block.type === "survey";
}

export function isRoundBlock(block: BlockConfig): block is RoundBlockConfig {
  return block.type !== "static" && block.type !== "information" && block.type !== "ai_chat" && block.type !== "survey";
}

export function isFlatStaticStep(step: FlatStepConfig): step is FlatStaticBlockConfig {
  return step.type === "static";
}

export function isFlatInformationStep(step: FlatStepConfig): step is FlatInformationBlockConfig {
  return step.type === "information";
}

export function isFlatAiChatStep(step: FlatStepConfig): step is FlatAiChatBlockConfig {
  return step.type === "ai_chat";
}

export function isFlatSurveyStep(step: FlatStepConfig): step is FlatSurveyBlockConfig {
  return step.type === "survey";
}

export function isFlatRoundStep(step: FlatStepConfig): step is FlatRoundConfig {
  return step.type !== "static" && step.type !== "information" && step.type !== "ai_chat" && step.type !== "survey";
}

export function isNumericParam(def: ParamDefinition): boolean {
  if (def.type === "constant") return def.dataType === "number";
  if (def.type === "student_input") return def.inputType === "number" || def.inputType === "slider";
  return def.type === "norm" || def.type === "unif" || def.type === "equation" || def.type === "history";
}
