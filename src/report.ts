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

export interface CombinedRunReport {
  runId: string;
  timestamp: string;
  suite: string;
  mode: "demo" | "model" | "compare" | "agent-url";
  provider?: string;
  agentUrl?: string;
  results: RunReport[];
}

export interface CompareProviderResult {
  provider: string;
  averageScore: number;
  passed: number;
  failed: number;
  failureModes: string[];
  taskResults: RunReport[];
}

export interface ComparisonRunReport {
  runId: string;
  timestamp: string;
  suite: "Web Chaos";
  mode: "compare";
  providers: string[];
  results: CompareProviderResult[];
}

export function createRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureRunsDir(): string {
  const runsDir = path.resolve(process.cwd(), "runs");
  mkdirSync(runsDir, { recursive: true });
  return runsDir;
}

export function saveRunReport(report: RunReport): string {
  const runsDir = ensureRunsDir();

  const filePath = path.join(runsDir, `${report.runId}.json`);
  writeFileSync(filePath, JSON.stringify(report, null, 2), "utf-8");

  return filePath;
}

export function saveCombinedRunReport(report: CombinedRunReport): string {
  const runsDir = ensureRunsDir();

  const filePath = path.join(runsDir, `${report.runId}.json`);
  writeFileSync(filePath, JSON.stringify(report, null, 2), "utf-8");

  return filePath;
}

export function saveComparisonRunReport(report: ComparisonRunReport): string {
  const runsDir = ensureRunsDir();

  const filePath = path.join(runsDir, `${report.runId}.json`);
  writeFileSync(filePath, JSON.stringify(report, null, 2), "utf-8");

  return filePath;
}
