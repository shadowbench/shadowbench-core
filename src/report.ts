import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FailureMode } from "./scoring";

export interface RunReport {
  runId: string;
  timestamp: string;
  suite: string;
  task: string;
  score: number;
  status: "passed" | "failed";
  failureMode: FailureMode;
  expected: string;
  actual: string;
  verdict: string;
}

export function createRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function saveRunReport(report: RunReport): string {
  const runsDir = path.resolve(process.cwd(), "runs");
  mkdirSync(runsDir, { recursive: true });

  const filePath = path.join(runsDir, `${report.runId}.json`);
  writeFileSync(filePath, JSON.stringify(report, null, 2), "utf-8");

  return filePath;
}
