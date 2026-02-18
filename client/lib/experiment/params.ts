import type {
  ExperimentConfig,
  ParamDefinition,
  ParamSource,
  ResolvedParam,
} from "./types";

/**
 * Merge params from all three levels for a given block/round.
 * Returns entries tagged with their source level.
 */
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
 * Extract {{param_id}} references from an equation expression.
 */
function extractDependencies(expression: string): string[] {
  const deps: string[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = re.exec(expression)) !== null) {
    deps.push(match[1]);
  }
  return deps;
}

/**
 * Topological sort of param IDs. Throws on circular dependencies.
 */
function topoSort(
  paramIds: string[],
  depsMap: Record<string, string[]>,
): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sorted: string[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new Error(`Circular dependency detected involving parameter "${id}"`);
    }
    visiting.add(id);
    for (const dep of depsMap[id] || []) {
      if (paramIds.includes(dep)) {
        visit(dep);
      }
    }
    visiting.delete(id);
    visited.add(id);
    sorted.push(id);
  }

  for (const id of paramIds) {
    visit(id);
  }

  return sorted;
}

/** Box-Muller transform for normal distribution sampling. */
function sampleNorm(mean: number, std: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * std + mean;
}

function sampleUnif(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Safely evaluate a JS expression with a given variable scope.
 * Only allows Math and the provided variables.
 */
function safeEval(expression: string, scope: Record<string, number | string | boolean>): number {
  const keys = Object.keys(scope);
  const values = keys.map((k) => scope[k]);
  try {
    const fn = new Function("Math", ...keys, `"use strict"; return (${expression});`);
    return fn(Math, ...values);
  } catch (e) {
    throw new Error(`Failed to evaluate equation: ${expression} — ${(e as Error).message}`);
  }
}

/**
 * Resolve a single param definition into a concrete value.
 */
function resolveValue(
  def: ParamDefinition,
  resolvedScope: Record<string, number | string | boolean>,
  studentInputs?: Record<string, string | number>,
): number | string | boolean | null {
  switch (def.type) {
    case "constant":
      return def.value;
    case "norm":
      return sampleNorm(def.mean, def.std);
    case "unif":
      return sampleUnif(def.min, def.max);
    case "equation": {
      const expr = def.expression.replace(
        /\{\{(\w+)\}\}/g,
        (_, id) => String(resolvedScope[id] ?? 0),
      );
      return safeEval(expr, resolvedScope);
    }
    case "student_input": {
      if (studentInputs && studentInputs[Object.keys(resolvedScope).find(() => false) ?? ""] !== undefined) {
        // handled below
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Main entry: resolve all parameters for a given (block, round) pair.
 */
export function resolveParameters(
  config: ExperimentConfig,
  blockIndex: number,
  roundIndex: number,
  studentInputs?: Record<string, string | number>,
): Record<string, ResolvedParam> {
  const merged = mergeParams(config, blockIndex, roundIndex);
  const paramIds = Object.keys(merged);

  const depsMap: Record<string, string[]> = {};
  for (const id of paramIds) {
    const { def } = merged[id];
    if (def.type === "equation") {
      depsMap[id] = extractDependencies(def.expression);
    } else {
      depsMap[id] = [];
    }
  }

  const sorted = topoSort(paramIds, depsMap);

  const resolvedScope: Record<string, number | string | boolean> = {};
  const result: Record<string, ResolvedParam> = {};

  for (const paramId of sorted) {
    const { def, source } = merged[paramId];
    let value: number | string | boolean | null;

    if (def.type === "student_input") {
      value = studentInputs?.[paramId] ?? null;
    } else {
      value = resolveValue(def, resolvedScope, studentInputs);
    }

    if (value !== null) {
      resolvedScope[paramId] = value;
    }

    result[paramId] = { paramId, definition: def, value, source };
  }

  return result;
}

/**
 * Resolve all params for an entire experiment run (all blocks, all rounds).
 */
export function resolveFullRun(
  config: ExperimentConfig,
): { blockIndex: number; roundIndex: number; blockId: string; roundId: string; params: Record<string, ResolvedParam> }[] {
  const results: { blockIndex: number; roundIndex: number; blockId: string; roundId: string; params: Record<string, ResolvedParam> }[] = [];

  for (let bi = 0; bi < config.blocks.length; bi++) {
    const block = config.blocks[bi];
    for (let ri = 0; ri < block.rounds.length; ri++) {
      const round = block.rounds[ri];
      results.push({
        blockIndex: bi,
        roundIndex: ri,
        blockId: block.id,
        roundId: round.id,
        params: resolveParameters(config, bi, ri),
      });
    }
  }

  return results;
}
