import type {
  ExperimentConfig,
  ParamDefinition,
  ParamSource,
  ParamValue,
  ResolvedParam,
  HistoryRow,
  HistoryAggregation,
} from "./types";

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
 * Extract dependencies from a history expression.
 * Matches patterns like sum({{price}}), latest({{cost}}), etc.
 */
function extractHistoryDependencies(expression: string): string[] {
  const deps: string[] = [];
  const re = /(?:min|max|mean|mode|sum|latest)\(\{\{(\w+)\}\}\)/g;
  let match;
  while ((match = re.exec(expression)) !== null) {
    deps.push(match[1]);
  }
  return deps;
}

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

function computeAggregate(fn: HistoryAggregation, values: number[]): number {
  if (values.length === 0) return 0;
  switch (fn) {
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "mean":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "mode": {
      const freq: Record<number, number> = {};
      for (const v of values) freq[v] = (freq[v] || 0) + 1;
      let maxCount = 0, modeVal = values[0];
      for (const key of Object.keys(freq)) {
        const val = Number(key);
        if (freq[val] > maxCount) { maxCount = freq[val]; modeVal = val; }
      }
      return modeVal;
    }
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "latest":
      return values[values.length - 1];
    default:
      return 0;
  }
}

/**
 * Resolve a history expression against the history table.
 * Replaces `agg({{param}})` calls with computed aggregates,
 * then evaluates the resulting arithmetic expression.
 *
 * For `latest`, only the previous row (not current) is used.
 * For all others, all rows from 0..currentRowIndex (inclusive) are used.
 */
function resolveHistoryExpression(
  expression: string,
  historyTable: HistoryRow[],
  currentRowIndex: number,
): number {
  const scope: Record<string, number> = {};
  let counter = 0;
  const AGGREGATIONS: HistoryAggregation[] = ["min", "max", "mean", "mode", "sum", "latest"];
  const pattern = new RegExp(
    `(${AGGREGATIONS.join("|")})\\(\\{\\{(\\w+)\\}\\}\\)`,
    "g",
  );

  const substituted = expression.replace(pattern, (_, fn: HistoryAggregation, paramId: string) => {
    const isLatest = fn === "latest";
    const endIdx = isLatest ? currentRowIndex : currentRowIndex + 1;
    const startIdx = isLatest ? Math.max(0, endIdx - 1) : 0;
    const values: number[] = [];
    for (let i = startIdx; i < endIdx; i++) {
      const v = historyTable[i]?.values[paramId];
      if (typeof v === "number") values.push(v);
    }
    const result = computeAggregate(fn, values);
    const placeholder = `__hist_${counter++}`;
    scope[placeholder] = result;
    return placeholder;
  });

  if (Object.keys(scope).length === 0) {
    return safeEval(substituted, {});
  }
  return safeEval(substituted, scope);
}

function resolveValue(
  def: ParamDefinition,
  resolvedScope: Record<string, number | string | boolean>,
  historyTable?: HistoryRow[],
  currentRowIndex?: number,
): ParamValue {
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
    case "history": {
      if (!historyTable || currentRowIndex === undefined) return null;
      return resolveHistoryExpression(def.expression, historyTable, currentRowIndex);
    }
    case "student_input":
      return null;
    default:
      return null;
  }
}

/**
 * Resolve all parameters for a given (block, round) pair.
 * Optionally accepts historyTable for resolving history-type params.
 */
export function resolveParameters(
  config: ExperimentConfig,
  blockIndex: number,
  roundIndex: number,
  studentInputs?: Record<string, string | number>,
  historyTable?: HistoryRow[],
  currentRowIndex?: number,
): Record<string, ResolvedParam> {
  const merged = mergeParams(config, blockIndex, roundIndex);
  return resolveFromMerged(merged, studentInputs, historyTable, currentRowIndex);
}

/**
 * Resolve params from an already-merged param map (used by GameEngine).
 */
export function resolveFromMerged(
  merged: Record<string, { def: ParamDefinition; source: ParamSource }>,
  studentInputs?: Record<string, string | number>,
  historyTable?: HistoryRow[],
  currentRowIndex?: number,
): Record<string, ResolvedParam> {
  const paramIds = Object.keys(merged);

  const depsMap: Record<string, string[]> = {};
  const historyParamIds = new Set(
    paramIds.filter((id) => merged[id].def.type === "history"),
  );
  for (const id of paramIds) {
    const { def } = merged[id];
    if (def.type === "equation") {
      depsMap[id] = extractDependencies(def.expression);
    } else if (def.type === "history") {
      // History params read from the history table, never from other history params
      depsMap[id] = extractHistoryDependencies(def.expression)
        .filter((dep) => !historyParamIds.has(dep));
    } else {
      depsMap[id] = [];
    }
  }

  const sorted = topoSort(paramIds, depsMap);

  const resolvedScope: Record<string, number | string | boolean> = {};
  const result: Record<string, ResolvedParam> = {};

  for (const paramId of sorted) {
    const { def, source } = merged[paramId];
    let value: ParamValue;

    if (def.type === "student_input") {
      value = studentInputs?.[paramId] ?? null;
    } else {
      value = resolveValue(def, resolvedScope, historyTable, currentRowIndex);
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
 * History params are resolved sequentially, each round seeing all prior rows.
 */
export function resolveFullRun(
  config: ExperimentConfig,
): { blockIndex: number; roundIndex: number; blockId: string; roundId: string; params: Record<string, ResolvedParam> }[] {
  const results: { blockIndex: number; roundIndex: number; blockId: string; roundId: string; params: Record<string, ResolvedParam> }[] = [];
  const historyTable: HistoryRow[] = [];
  let globalRoundIdx = 0;

  for (let bi = 0; bi < config.blocks.length; bi++) {
    const block = config.blocks[bi];
    for (let ri = 0; ri < block.rounds.length; ri++) {
      const round = block.rounds[ri];
      const params = resolveParameters(config, bi, ri, undefined, historyTable, globalRoundIdx);

      const row: HistoryRow = {
        roundIndex: globalRoundIdx,
        values: {},
      };
      for (const [k, v] of Object.entries(params)) {
        row.values[k] = v.value;
      }
      historyTable.push(row);

      results.push({
        blockIndex: bi,
        roundIndex: ri,
        blockId: block.id,
        roundId: round.id,
        params,
      });
      globalRoundIdx++;
    }
  }

  return results;
}
