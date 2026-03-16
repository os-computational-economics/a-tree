import type { HistoryRow, ParamValue, ExperimentConfig, SurveyBlockConfig, ChatLogEntry } from "./types";

interface TrialForExport {
  id: string;
  trialCode: string;
  historyTable: HistoryRow[];
  chatLogs?: Record<string, ChatLogEntry[]>;
  surveyResponses?: Record<string, Record<string, string>>;
}

type QuestionMap = Record<string, Record<string, string>>;

/**
 * Escapes a CSV cell value: wraps in quotes if it contains comma, quote, or newline.
 */
function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatParamValue(val: ParamValue): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(4);
  return String(val);
}

/**
 * Builds a CSV string from filtered trials' history tables.
 *
 * Each CSV row represents one round (history row) from one trial.
 * Columns: trial_id, trial_code, round, <all param keys across all trials>, timestamp
 */
export function buildTrialsCsv(trials: TrialForExport[]): string {
  // Collect all unique param keys across all trials' history rows
  const paramKeys = new Set<string>();
  for (const trial of trials) {
    for (const row of trial.historyTable) {
      for (const key of Object.keys(row.values)) {
        paramKeys.add(key);
      }
    }
  }

  const sortedKeys = Array.from(paramKeys).sort();
  const headers = ["trial_id", "trial_code", "round", ...sortedKeys, "timestamp"];
  const lines: string[] = [headers.map(escapeCsvCell).join(",")];

  for (const trial of trials) {
    for (let i = 0; i < trial.historyTable.length; i++) {
      const row = trial.historyTable[i];
      const cells = [
        trial.id,
        trial.trialCode,
        String(i + 1),
        ...sortedKeys.map((key) => formatParamValue(row.values[key] ?? null)),
        row.updatedAt ?? "",
      ];
      lines.push(cells.map(escapeCsvCell).join(","));
    }
  }

  return lines.join("\n");
}

/**
 * Builds a mapping of blockId -> questionId -> questionText from an experiment config.
 */
export function buildQuestionMap(config: ExperimentConfig): QuestionMap {
  const map: QuestionMap = {};
  for (const block of config.blocks) {
    if (block.type === "survey") {
      const surveyBlock = block as SurveyBlockConfig;
      map[surveyBlock.id] = {};
      for (const q of surveyBlock.questions) {
        map[surveyBlock.id][q.id] = q.text;
      }
    }
  }
  return map;
}

/**
 * Builds a CSV string from filtered trials' survey responses.
 *
 * Each CSV row represents one answer from one trial.
 * Columns: trial_id, trial_code, block_id, question_id, question_text, answer
 */
export function buildSurveyResponsesCsv(trials: TrialForExport[], questionMap?: QuestionMap): string {
  const headers = ["trial_id", "trial_code", "block_id", "question_id", "question_text", "answer"];
  const lines: string[] = [headers.map(escapeCsvCell).join(",")];

  for (const trial of trials) {
    if (!trial.surveyResponses) continue;
    for (const [blockId, answers] of Object.entries(trial.surveyResponses)) {
      for (const [questionId, answer] of Object.entries(answers)) {
        const questionText = questionMap?.[blockId]?.[questionId] ?? "";
        const cells = [trial.id, trial.trialCode, blockId, questionId, questionText, answer];
        lines.push(cells.map(escapeCsvCell).join(","));
      }
    }
  }

  return lines.join("\n");
}

/**
 * Builds a CSV string from filtered trials' AI chat logs.
 *
 * Each CSV row represents one message from one trial.
 * Columns: trial_id, trial_code, block_id, role, content, timestamp
 */
export function buildChatLogsCsv(trials: TrialForExport[]): string {
  const headers = ["trial_id", "trial_code", "block_id", "role", "content", "timestamp"];
  const lines: string[] = [headers.map(escapeCsvCell).join(",")];

  for (const trial of trials) {
    if (!trial.chatLogs) continue;
    for (const [blockId, entries] of Object.entries(trial.chatLogs)) {
      for (const entry of entries) {
        const cells = [
          trial.id,
          trial.trialCode,
          blockId,
          entry.role,
          entry.content,
          entry.timestamp ? new Date(entry.timestamp).toISOString() : "",
        ];
        lines.push(cells.map(escapeCsvCell).join(","));
      }
    }
  }

  return lines.join("\n");
}

/**
 * Triggers a browser download of a CSV string.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
