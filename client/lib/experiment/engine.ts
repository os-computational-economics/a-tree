import type {
  ExperimentConfig,
  FlatRoundConfig,
  FlatStepConfig,
  HistoryRow,
  ParamDefinition,
  ParamValue,
  ResolvedParam,
  TemplateKind,
} from "./types";
import { TEMPLATE_KINDS, isFlatRoundStep } from "./types";
import { flattenConfig } from "./flatten";
import { resolveFromMerged } from "./params";

export class GameEngine {
  private flatConfig: FlatStepConfig[];
  private historyTable: HistoryRow[];
  private currentStepIndex: number;
  private currentTemplateIndex: number; // 0=intro, 1=decision, 2=result (only for round steps)
  private resolvedParams: Record<string, ResolvedParam>;
  private studentInputs: Record<string, string | number>;
  /** Cached random samples for the current round so they don't re-roll on recalculate */
  private randomCache: Record<string, ParamValue>;
  /** Maps step index -> history row index (only for round steps) */
  private stepToHistoryIndex: Map<number, number>;
  /** Snapshot of resolved params from the most recent round step, persists across non-round steps */
  private lastRoundResolvedParams: Record<string, ResolvedParam>;
  private lastRoundStudentInputs: Record<string, string | number>;

  constructor(config: ExperimentConfig) {
    this.flatConfig = flattenConfig(config);
    this.historyTable = [];
    this.currentStepIndex = 0;
    this.currentTemplateIndex = 0;
    this.resolvedParams = {};
    this.studentInputs = {};
    this.randomCache = {};
    this.stepToHistoryIndex = new Map();
    this.lastRoundResolvedParams = {};
    this.lastRoundStudentInputs = {};

    let histIdx = 0;
    for (let i = 0; i < this.flatConfig.length; i++) {
      if (isFlatRoundStep(this.flatConfig[i])) {
        this.stepToHistoryIndex.set(i, histIdx++);
      }
    }

    this.initializeStep(0);
  }

  private getHistoryIndex(): number {
    return this.stepToHistoryIndex.get(this.currentStepIndex) ?? -1;
  }

  private initializeStep(stepIndex: number): void {
    this.currentStepIndex = stepIndex;
    this.currentTemplateIndex = 0;
    this.studentInputs = {};
    this.randomCache = {};

    const step = this.flatConfig[stepIndex];
    if (!step) return;

    if (!isFlatRoundStep(step)) {
      this.resolvedParams = {};
      return;
    }

    for (const [paramId, { def }] of Object.entries(step.params)) {
      if (def.type === "norm" || def.type === "unif") {
        const params = resolveFromMerged(
          { [paramId]: { def, source: step.params[paramId].source } },
        );
        this.randomCache[paramId] = params[paramId]?.value ?? null;
      }
    }

    this.recalculate({});
  }

  /**
   * Recalculate the current round's values.
   * Random params use cached values; everything else is re-evaluated.
   * No-op for static steps.
   */
  recalculate(studentInputs: Record<string, string | number>): void {
    this.studentInputs = studentInputs;
    const step = this.flatConfig[this.currentStepIndex];
    if (!step || !isFlatRoundStep(step)) return;

    const histIdx = this.getHistoryIndex();

    const effectiveParams: Record<string, { def: ParamDefinition; source: typeof step.params[string]["source"] }> = {};
    for (const [paramId, entry] of Object.entries(step.params)) {
      if ((entry.def.type === "norm" || entry.def.type === "unif") && this.randomCache[paramId] !== undefined) {
        effectiveParams[paramId] = {
          def: { type: "constant", dataType: "number", value: this.randomCache[paramId] as number },
          source: entry.source,
        };
      } else {
        effectiveParams[paramId] = entry;
      }
    }

    const hasHistoryParams = Object.values(effectiveParams).some(
      (e) => e.def.type === "history",
    );

    this.resolvedParams = resolveFromMerged(
      effectiveParams,
      studentInputs,
      this.historyTable,
      histIdx,
    );

    this.writeHistoryRow();

    if (hasHistoryParams) {
      this.resolvedParams = resolveFromMerged(
        effectiveParams,
        studentInputs,
        this.historyTable,
        histIdx,
      );
      this.writeHistoryRow();
    }

    this.lastRoundResolvedParams = { ...this.resolvedParams };
    this.lastRoundStudentInputs = { ...this.studentInputs };
  }

  private writeHistoryRow(): void {
    const histIdx = this.getHistoryIndex();
    if (histIdx < 0) return;

    const row: HistoryRow = {
      roundIndex: this.currentStepIndex,
      values: {},
    };
    for (const [k, v] of Object.entries(this.resolvedParams)) {
      row.values[k] = v.value;
    }

    if (histIdx < this.historyTable.length) {
      this.historyTable[histIdx] = row;
    } else {
      this.historyTable.push(row);
    }
  }

  /**
   * Reconstruct lastRoundResolvedParams from the most recent history row
   * combined with param definitions from the corresponding round step.
   * Used when restoring into a non-round step so visualizations have data.
   */
  private rebuildLastRoundParams(): void {
    if (this.historyTable.length === 0) return;
    const lastRow = this.historyTable[this.historyTable.length - 1];
    const roundStep = this.flatConfig[lastRow.roundIndex];
    if (!roundStep || !isFlatRoundStep(roundStep)) return;

    const rebuilt: Record<string, ResolvedParam> = {};
    for (const [k, v] of Object.entries(lastRow.values)) {
      const paramEntry = roundStep.params[k];
      rebuilt[k] = {
        value: v,
        definition: paramEntry ? paramEntry.def : { type: "constant", dataType: typeof v === "number" ? "number" : "string", value: v as number },
      };
    }
    this.lastRoundResolvedParams = rebuilt;
  }

  advance(studentInputs: Record<string, string | number>): void {
    const step = this.flatConfig[this.currentStepIndex];

    if (!step || !isFlatRoundStep(step)) {
      if (this.currentStepIndex < this.flatConfig.length - 1) {
        this.initializeStep(this.currentStepIndex + 1);
      }
      return;
    }

    this.recalculate(studentInputs);

    if (this.currentTemplateIndex < 2) {
      this.currentTemplateIndex++;
      this.recalculate(studentInputs);
    } else if (this.currentStepIndex < this.flatConfig.length - 1) {
      this.initializeStep(this.currentStepIndex + 1);
    }
  }

  goBack(): void {
    const step = this.flatConfig[this.currentStepIndex];

    if (step && isFlatRoundStep(step) && this.currentTemplateIndex > 0) {
      this.currentTemplateIndex--;
      return;
    }

    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      const prevStep = this.flatConfig[this.currentStepIndex];
      if (prevStep && isFlatRoundStep(prevStep)) {
        this.currentTemplateIndex = 2;
      } else {
        this.currentTemplateIndex = 0;
      }
    }
  }

  getCurrentStep(): FlatStepConfig {
    return this.flatConfig[this.currentStepIndex];
  }

  /** @deprecated Use getCurrentStep() instead for the new union type */
  getCurrentRound(): FlatRoundConfig | undefined {
    const step = this.flatConfig[this.currentStepIndex];
    return step && isFlatRoundStep(step) ? step : undefined;
  }

  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  /** @deprecated Renamed to getCurrentStepIndex */
  getCurrentRoundIndex(): number {
    return this.currentStepIndex;
  }

  getHistoryTable(): HistoryRow[] {
    return [...this.historyTable];
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

  getLastRoundResolvedParams(): Record<string, ResolvedParam> {
    return this.lastRoundResolvedParams;
  }

  getLastRoundStudentInputs(): Record<string, string | number> {
    return this.lastRoundStudentInputs;
  }

  getStudentInputs(): Record<string, string | number> {
    return this.studentInputs;
  }

  getFlatConfig(): FlatStepConfig[] {
    return this.flatConfig;
  }

  getTotalRounds(): number {
    return this.flatConfig.length;
  }

  /**
   * Total logical steps: round steps contribute 3 (intro/decision/result),
   * static steps contribute 1.
   */
  getTotalSteps(): number {
    let total = 0;
    for (const step of this.flatConfig) {
      total += isFlatRoundStep(step) ? TEMPLATE_KINDS.length : 1;
    }
    return total;
  }

  /**
   * Current step number across all steps (1-indexed).
   */
  getCurrentStepNumber(): number {
    let count = 0;
    for (let i = 0; i < this.currentStepIndex; i++) {
      count += isFlatRoundStep(this.flatConfig[i]) ? TEMPLATE_KINDS.length : 1;
    }
    const current = this.flatConfig[this.currentStepIndex];
    count += current && isFlatRoundStep(current) ? this.currentTemplateIndex + 1 : 1;
    return count;
  }

  isFirst(): boolean {
    return this.currentStepIndex === 0 && this.currentTemplateIndex === 0;
  }

  isFinished(): boolean {
    if (this.currentStepIndex !== this.flatConfig.length - 1) return false;
    const step = this.flatConfig[this.currentStepIndex];
    if (step && isFlatRoundStep(step)) {
      return this.currentTemplateIndex === 2;
    }
    return true;
  }

  /**
   * Restore engine state from previously saved data (for resuming a trial).
   * Always snaps back to the intro (templateIndex=0) of the current round,
   * preserving random values but requiring the student to redo the round.
   */
  restore(
    savedHistory: HistoryRow[],
    stepIndex: number,
    _templateIndex: number,
  ): void {
    this.historyTable = savedHistory.map((r) => ({ ...r, values: { ...r.values } }));
    this.currentStepIndex = stepIndex;
    this.studentInputs = {};
    this.randomCache = {};

    const step = this.flatConfig[this.currentStepIndex];
    if (!step) return;

    if (!isFlatRoundStep(step)) {
      this.currentTemplateIndex = 0;
      this.resolvedParams = {};
      this.rebuildLastRoundParams();
      return;
    }

    // Always restart at intro for round steps
    this.currentTemplateIndex = 0;

    const histIdx = this.getHistoryIndex();

    // Extract random values from the saved history row before trimming
    const savedRow = histIdx >= 0 && histIdx < this.historyTable.length
      ? this.historyTable[histIdx]
      : null;

    for (const [paramId, { def }] of Object.entries(step.params)) {
      if (def.type === "norm" || def.type === "unif") {
        if (savedRow && savedRow.values[paramId] != null) {
          this.randomCache[paramId] = savedRow.values[paramId];
        } else {
          const params = resolveFromMerged(
            { [paramId]: { def, source: step.params[paramId].source } },
          );
          this.randomCache[paramId] = params[paramId]?.value ?? null;
        }
      }
    }

    // Trim: remove the incomplete round's history row so it's rebuilt fresh
    if (histIdx >= 0 && histIdx < this.historyTable.length) {
      this.historyTable = this.historyTable.slice(0, histIdx);
    }

    // Recalculate will re-add the history row for this round with preserved randoms
    this.recalculate({});
  }
}
