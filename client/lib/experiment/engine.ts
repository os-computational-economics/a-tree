import type {
  ExperimentConfig,
  FlatRoundConfig,
  HistoryRow,
  ParamDefinition,
  ParamValue,
  ResolvedParam,
  TemplateKind,
} from "./types";
import { TEMPLATE_KINDS } from "./types";
import { flattenConfig } from "./flatten";
import { resolveFromMerged } from "./params";

export class GameEngine {
  private flatConfig: FlatRoundConfig[];
  private historyTable: HistoryRow[];
  private currentRoundIndex: number;
  private currentTemplateIndex: number; // 0=intro, 1=decision, 2=result
  private resolvedParams: Record<string, ResolvedParam>;
  private studentInputs: Record<string, string | number>;
  /** Cached random samples for the current round so they don't re-roll on recalculate */
  private randomCache: Record<string, ParamValue>;

  constructor(config: ExperimentConfig) {
    this.flatConfig = flattenConfig(config);
    this.historyTable = [];
    this.currentRoundIndex = 0;
    this.currentTemplateIndex = 0;
    this.resolvedParams = {};
    this.studentInputs = {};
    this.randomCache = {};
    this.initializeRound(0);
  }

  private initializeRound(roundIndex: number): void {
    this.currentRoundIndex = roundIndex;
    this.currentTemplateIndex = 0;
    this.studentInputs = {};
    this.randomCache = {};

    const round = this.flatConfig[roundIndex];
    if (!round) return;

    // First pass: sample random params and cache them
    for (const [paramId, { def }] of Object.entries(round.params)) {
      if (def.type === "norm" || def.type === "unif") {
        const params = resolveFromMerged(
          { [paramId]: { def, source: round.params[paramId].source } },
        );
        this.randomCache[paramId] = params[paramId]?.value ?? null;
      }
    }

    this.recalculate({});
  }

  /**
   * Recalculate the current round's values.
   * Random params use cached values; everything else is re-evaluated.
   */
  recalculate(studentInputs: Record<string, string | number>): void {
    this.studentInputs = studentInputs;
    const round = this.flatConfig[this.currentRoundIndex];
    if (!round) return;

    // Build a modified param map that swaps random defs for cached constants
    const effectiveParams: Record<string, { def: ParamDefinition; source: typeof round.params[string]["source"] }> = {};
    for (const [paramId, entry] of Object.entries(round.params)) {
      if ((entry.def.type === "norm" || entry.def.type === "unif") && this.randomCache[paramId] !== undefined) {
        effectiveParams[paramId] = {
          def: { type: "constant", dataType: "number", value: this.randomCache[paramId] as number },
          source: entry.source,
        };
      } else {
        effectiveParams[paramId] = entry;
      }
    }

    this.resolvedParams = resolveFromMerged(
      effectiveParams,
      studentInputs,
      this.historyTable,
      this.currentRoundIndex,
    );

    // Update or create the current row in the history table
    const row: HistoryRow = {
      roundIndex: this.currentRoundIndex,
      values: {},
    };
    for (const [k, v] of Object.entries(this.resolvedParams)) {
      row.values[k] = v.value;
    }

    if (this.historyTable.length > this.currentRoundIndex) {
      this.historyTable[this.currentRoundIndex] = row;
    } else {
      this.historyTable.push(row);
    }
  }

  advance(studentInputs: Record<string, string | number>): void {
    this.recalculate(studentInputs);

    if (this.currentTemplateIndex < 2) {
      this.currentTemplateIndex++;
      this.recalculate(studentInputs);
    } else if (this.currentRoundIndex < this.flatConfig.length - 1) {
      this.initializeRound(this.currentRoundIndex + 1);
    }
  }

  goBack(): void {
    if (this.currentTemplateIndex > 0) {
      this.currentTemplateIndex--;
    } else if (this.currentRoundIndex > 0) {
      this.currentRoundIndex--;
      this.currentTemplateIndex = 2;
      // Restore the previous round's state from the history table
      // (random values are baked into the history row already)
    }
  }

  getCurrentRound(): FlatRoundConfig {
    return this.flatConfig[this.currentRoundIndex];
  }

  getCurrentRoundIndex(): number {
    return this.currentRoundIndex;
  }

  getHistoryTable(): HistoryRow[] {
    return this.historyTable;
  }

  getCurrentTemplateIndex(): number {
    return this.currentTemplateIndex;
  }

  getCurrentTemplateKind(): TemplateKind {
    return TEMPLATE_KINDS[this.currentTemplateIndex];
  }

  getResolvedParams(): Record<string, ResolvedParam> {
    return this.resolvedParams;
  }

  getStudentInputs(): Record<string, string | number> {
    return this.studentInputs;
  }

  getFlatConfig(): FlatRoundConfig[] {
    return this.flatConfig;
  }

  getTotalRounds(): number {
    return this.flatConfig.length;
  }

  /**
   * Total steps = rounds * 3 templates per round.
   */
  getTotalSteps(): number {
    return this.flatConfig.length * TEMPLATE_KINDS.length;
  }

  /**
   * Current step across all rounds and templates (1-indexed).
   */
  getCurrentStep(): number {
    return this.currentRoundIndex * TEMPLATE_KINDS.length + this.currentTemplateIndex + 1;
  }

  isFirst(): boolean {
    return this.currentRoundIndex === 0 && this.currentTemplateIndex === 0;
  }

  isFinished(): boolean {
    return (
      this.currentRoundIndex === this.flatConfig.length - 1 &&
      this.currentTemplateIndex === 2
    );
  }
}
