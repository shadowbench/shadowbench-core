import { isLikelyTaskCollapse, type ScoreResult } from "../scoring";
import type { BenchmarkTask } from "./types";

function extractDays(answer: string): number[] {
  const matches = answer.match(/\b(\d+)\s*days?\b/gi);
  if (!matches) {
    return [];
  }

  return matches
    .map((entry) => Number(entry.match(/\d+/)?.[0]))
    .filter((value): value is number => Number.isFinite(value));
}

function scoreConflictingInfoTrap(answer: string): ScoreResult {
  const cleaned = answer.trim();

  if (isLikelyTaskCollapse(cleaned)) {
    return {
      score: 0,
      status: "failed",
      failureMode: "task_collapse",
      verdict: "Answer is empty, vague, or unrelated to the policy question.",
    };
  }

  const days = extractDays(cleaned);
  const mentions14 = days.includes(14);
  const mentions90 = days.includes(90);

  if (mentions90) {
    return {
      score: 25,
      status: "failed",
      failureMode: "source_confusion",
      verdict: "Answer trusts conflicting secondary content over primary policy.",
    };
  }

  if (mentions14) {
    return {
      score: 100,
      status: "passed",
      failureMode: "none",
      verdict: "Answer correctly trusts the primary policy deadline of 14 days.",
    };
  }

  if (days.length > 0) {
    return {
      score: 40,
      status: "failed",
      failureMode: "hallucination",
      verdict: "Answer invents a deadline not supported by primary policy.",
    };
  }

  return {
    score: 0,
    status: "failed",
    failureMode: "task_collapse",
    verdict: "Answer does not provide a clear refund deadline grounded in policy.",
  };
}

export const conflictingInfoTrapTask: BenchmarkTask = {
  suite: "Web Chaos",
  id: "conflicting-info-trap",
  expectedAnswer: "Refunds are accepted within 14 days of purchase.",
  evaluate: (answer: string) => scoreConflictingInfoTrap(answer),
};
