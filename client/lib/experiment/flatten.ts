import type {
  ExperimentConfig,
  FlatRoundConfig,
  ParamDefinition,
  ParamSource,
} from "./types";
import { resolveTemplate } from "./template";

function mergeParams(
  config: ExperimentConfig,
  blockIndex: number,
  roundIndex: number,
): Record<string, { def: ParamDefinition; source: ParamSource }> {
  const result: Record<string, { def: ParamDefinition; source: ParamSource }> = {};

  for (const [k, v] of Object.entries(config.params)) {
    result[k] = { def: v, source: "experiment" };
  }

  const block = config.blocks[blockIndex];
  if (block?.params) {
    for (const [k, v] of Object.entries(block.params)) {
      result[k] = { def: v, source: "block" };
    }
  }

  const round = block?.rounds?.[roundIndex];
  if (round?.params) {
    for (const [k, v] of Object.entries(round.params)) {
      result[k] = { def: v, source: "round" };
    }
  }

  return result;
}

/**
 * Flatten the hierarchical ExperimentConfig into an array of per-round configs.
 * Each entry contains fully-merged parameters and fully-resolved templates.
 */
export function flattenConfig(config: ExperimentConfig): FlatRoundConfig[] {
  const result: FlatRoundConfig[] = [];

  for (let bi = 0; bi < config.blocks.length; bi++) {
    const block = config.blocks[bi];
    for (let ri = 0; ri < block.rounds.length; ri++) {
      result.push({
        blockIndex: bi,
        roundIndex: ri,
        blockId: block.id,
        roundId: block.rounds[ri].id,
        blockLabel: block.label,
        params: mergeParams(config, bi, ri),
        introTemplate: resolveTemplate(config, bi, ri, "intro"),
        decisionTemplate: resolveTemplate(config, bi, ri, "decision"),
        resultTemplate: resolveTemplate(config, bi, ri, "result"),
      });
    }
  }

  return result;
}
