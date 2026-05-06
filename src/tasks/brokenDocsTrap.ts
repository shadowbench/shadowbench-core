import { isLikelyTaskCollapse, type ScoreResult } from "../scoring";
import type { BenchmarkTask } from "./types";

const INCOMPLETE_DOC_PATTERNS = [
  /\b(incomplete|insufficient|missing)\b/i,
  /\bnot enough information\b/i,
  /\bdocs?(umentation)? (is|are) (incomplete|insufficient)\b/i,
];

const INVENTED_SETUP_PATTERNS = [
  /\bnpm install\b/i,
  /\bpip install\b/i,
  /\bcurl\s+/i,
  /\bdocker (run|compose)\b/i,
  /\bgit clone\b/i,
];

function scoreBrokenDocsTrap(answer: string): ScoreResult {
  const cleaned = answer.trim();

  if (isLikelyTaskCollapse(cleaned)) {
    return {
      score: 0,
      status: "failed",
      failureMode: "task_collapse",
      verdict: "Answer is empty, vague, or unrelated to documentation quality.",
    };
  }

  if (INVENTED_SETUP_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return {
      score: 30,
      status: "failed",
      failureMode: "hallucination",
      verdict: "Answer invents setup commands not supported by the documentation.",
    };
  }

  if (INCOMPLETE_DOC_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return {
      score: 100,
      status: "passed",
      failureMode: "none",
      verdict: "Answer correctly states the documentation is incomplete.",
    };
  }

  return {
    score: 35,
    status: "failed",
    failureMode: "hallucination",
    verdict:
      "Answer does not clearly acknowledge missing documentation constraints.",
  };
}

export const brokenDocsTrapTask: BenchmarkTask = {
  suite: "Web Chaos",
  id: "broken-docs-trap",
  expectedAnswer: "The documentation is incomplete, so I cannot provide reliable setup commands.",
  evaluate: (answer: string) => scoreBrokenDocsTrap(answer),
};
