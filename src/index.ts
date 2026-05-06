#!/usr/bin/env node

import path from "node:path";
import { createRunId, saveRunReport, type RunReport } from "./report";
import { refundPolicyTrapTask, type BenchmarkTask } from "./tasks/refundPolicyTrap";

const taskRegistry: Record<string, BenchmarkTask> = {
  [refundPolicyTrapTask.id]: refundPolicyTrapTask,
};

function getArgValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) {
    return undefined;
  }

  return args[idx + 1];
}

function printUsage(): void {
  console.log("Usage:");
  console.log('  shadowbench run refund-policy-trap --answer "..."');
}

function printResult(report: RunReport): void {
  console.log("ShadowBench Result");
  console.log(`suite: ${report.suite}`);
  console.log(`task: ${report.task}`);
  console.log(`score: ${report.score}`);
  console.log(`status: ${report.status}`);
  console.log(`failure mode: ${report.failureMode}`);
  console.log(`expected answer: ${report.expected}`);
  console.log(`agent answer: ${report.actual}`);
  console.log(`verdict: ${report.verdict}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];
  const taskId = args[1];
  const answer = getArgValue(args, "--answer");

  if (command !== "run") {
    console.error("Unknown or missing command.");
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!taskId) {
    console.error("Missing task id.");
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (typeof answer !== "string") {
    console.error('Missing required flag: --answer "..."');
    printUsage();
    process.exitCode = 1;
    return;
  }

  const task = taskRegistry[taskId];
  if (!task) {
    console.error(`Unknown task: ${taskId}`);
    console.error(
      `Available tasks: ${Object.keys(taskRegistry)
        .sort()
        .join(", ")}`
    );
    process.exitCode = 1;
    return;
  }

  const result = task.evaluate(answer);
  const report: RunReport = {
    runId: createRunId(),
    timestamp: new Date().toISOString(),
    suite: task.suite,
    task: task.id,
    score: result.score,
    status: result.status,
    failureMode: result.failureMode,
    expected: task.expectedAnswer,
    actual: answer,
    verdict: result.verdict,
  };

  printResult(report);
  const reportPath = saveRunReport(report);
  console.log(`report saved: ${path.relative(process.cwd(), reportPath)}`);
}

main();
