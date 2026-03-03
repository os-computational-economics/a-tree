import type {
  ExperimentConfig,
  FlatRoundConfig,
  FlatStepConfig,
  ParamDefinition,
  ParamSource,
} from "./types";
import { isStaticBlock } from "./types";
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
  if (block && !isStaticBlock(block) && block.params) {
    for (const [k, v] of Object.entries(block.params)) {
      result[k] = { def: v, source: "block" };
    }
  }

  const round = block && !isStaticBlock(block) ? block.rounds?.[roundIndex] : undefined;
  if (round?.params) {
    for (const [k, v] of Object.entries(round.params)) {
      result[k] = { def: v, source: "round" };
    }
  }

  return result;
}

/**
 * Flatten the hierarchical ExperimentConfig into an array of per-step configs.
 * Round blocks produce one FlatRoundConfig per round; static blocks produce a single FlatStaticBlockConfig.
 */
export function flattenConfig(config: ExperimentConfig): FlatStepConfig[] {
  const result: FlatStepConfig[] = [];

  for (let bi = 0; bi < config.blocks.length; bi++) {
    const block = config.blocks[bi];

    if (isStaticBlock(block)) {
      result.push({
        type: "static",
        blockIndex: bi,
        blockId: block.id,
        blockLabel: block.label,
        title: block.title,
        body: block.body,
      });
      continue;
    }

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
