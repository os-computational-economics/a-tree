import type { HistoryRow, ParamValue } from "./types";

interface TrialForExport {
  id: string;
  trialCode: string;
  historyTable: HistoryRow[];
}

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
 * Columns: trial_id, round, <all param keys across all trials>, timestamp
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
  const headers = ["trial_id", "round", ...sortedKeys, "timestamp"];
  const lines: string[] = [headers.map(escapeCsvCell).join(",")];

  for (const trial of trials) {
    for (let i = 0; i < trial.historyTable.length; i++) {
      const row = trial.historyTable[i];
      const cells = [
        trial.id,
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
