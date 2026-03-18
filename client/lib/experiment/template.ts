import type {
  ExperimentConfig,
  HistoryRow,
  ParamValue,
  ResolvedParam,
  TemplateSegment,
  TemplateKind,
  TemplateSet,
} from "./types";
import { isStaticBlock, isInformationBlock, isAiChatBlock, isSurveyBlock } from "./types";

const TEMPLATE_FIELD_MAP: Record<TemplateKind, "introTemplate" | "decisionTemplate" | "resultTemplate"> = {
  intro: "introTemplate",
  decision: "decisionTemplate",
  result: "resultTemplate",
};

/**
 * Resolve which template to use for a given (block, round) pair and template kind.
 * Walks: round -> block -> experiment level.
 */
export function resolveTemplate(
  config: ExperimentConfig,
  blockIndex: number,
  roundIndex: number,
  kind: TemplateKind,
): string {
  const field = TEMPLATE_FIELD_MAP[kind];
  const block = config.blocks[blockIndex];

  if (block && isStaticBlock(block)) return config[field];
  if (block && isInformationBlock(block)) return config[field];
  if (block && isAiChatBlock(block)) return config[field];
  if (block && isSurveyBlock(block)) return config[field];

  const round = block && !isStaticBlock(block) && !isInformationBlock(block) && !isAiChatBlock(block) && !isSurveyBlock(block) ? block.rounds?.[roundIndex] : undefined;

  if (round?.[field]) return round[field];
  if (block && !isStaticBlock(block) && !isInformationBlock(block) && !isAiChatBlock(block) && !isSurveyBlock(block) && block[field]) return block[field];
  return config[field];
}

/**
 * Resolve all three templates for a given (block, round) pair.
 */
export function resolveTemplates(
  config: ExperimentConfig,
  blockIndex: number,
  roundIndex: number,
): TemplateSet {
  return {
    introTemplate: resolveTemplate(config, blockIndex, roundIndex, "intro"),
    decisionTemplate: resolveTemplate(config, blockIndex, roundIndex, "decision"),
    resultTemplate: resolveTemplate(config, blockIndex, roundIndex, "result"),
  };
}

/**
 * Render a template string into segments.
 * Each {{param_id}} becomes either a resolved value or an input placeholder.
 */
export function renderTemplate(
  template: string,
  resolvedParams: Record<string, ResolvedParam>,
): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let lastIndex = 0;
  let match;

  while ((match = re.exec(template)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: template.slice(lastIndex, match.index) });
    }

    const paramId = match[1];
    const resolved = resolvedParams[paramId];

    if (!resolved) {
      segments.push({ type: "text", content: `{{${paramId}}}` });
    } else if (resolved.definition.type === "student_input") {
      if (resolved.value !== null) {
        segments.push({
          type: "value",
          paramId,
          value: resolved.value,
          source: resolved.source,
        });
      } else {
        segments.push({
          type: "input",
          paramId,
          inputLabel: resolved.definition.inputLabel,
          inputType: resolved.definition.inputType,
          validation: resolved.definition.validation,
        });
      }
    } else {
      segments.push({
        type: "value",
        paramId,
        value: resolved.value ?? 0,
        source: resolved.source,
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < template.length) {
    segments.push({ type: "text", content: template.slice(lastIndex) });
  }

  return segments;
}

function formatParamValue(val: ParamValue): string {
  if (val === null) return "\u2014";
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(4);
  return String(val);
}

/**
 * Replace {{param_id}} placeholders in an HTML string with the latest value
 * of that variable from the history table. Unknown variables are left as-is.
 */
export function interpolateHistoryVars(html: string, historyTable: HistoryRow[]): string {
  if (historyTable.length === 0) return html;

  const latestValues: Record<string, ParamValue> = {};
  for (const row of historyTable) {
    for (const [k, v] of Object.entries(row.values)) {
      latestValues[k] = v;
    }
  }

  return html.replace(/\{\{(\w+)\}\}/g, (full, paramId: string) => {
    if (paramId in latestValues) {
      const raw = formatParamValue(latestValues[paramId]);
      const escaped = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<span class="font-semibold text-primary">${escaped}</span>`;
    }
    return full;
  });
}
