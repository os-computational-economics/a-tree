import type {
  ExperimentConfig,
  ResolvedParam,
  TemplateSegment,
} from "./types";

/**
 * Resolve which template to use for a given (block, round) pair.
 * Walks: round -> block -> experiment level.
 */
export function resolveTemplate(
  config: ExperimentConfig,
  blockIndex: number,
  roundIndex: number,
): string {
  const block = config.blocks[blockIndex];
  const round = block?.rounds?.[roundIndex];

  if (round?.template) return round.template;
  if (block?.template) return block.template;
  return config.template;
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
