export type ParamDefinition =
  | { type: "constant"; dataType: "number" | "string" | "boolean"; value: number | string | boolean }
  | { type: "norm"; mean: number; std: number }
  | { type: "unif"; min: number; max: number }
  | { type: "equation"; expression: string }
  | { type: "student_input"; inputLabel?: string; inputType?: "number" | "text" };

export interface RoundConfig {
  id: string;
  params?: Record<string, ParamDefinition>;
  template?: string;
}

export interface BlockConfig {
  id: string;
  label?: string;
  params?: Record<string, ParamDefinition>;
  template?: string;
  rounds: RoundConfig[];
}

export interface ExperimentConfig {
  params: Record<string, ParamDefinition>;
  template: string;
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
  | { type: "input"; paramId: string; inputLabel?: string; inputType?: "number" | "text" };
