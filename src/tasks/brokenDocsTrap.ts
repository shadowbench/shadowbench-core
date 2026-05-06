import { isLikelyTaskCollapse, type ScoreResult } from "../scoring";
import type { BenchmarkTask } from "./types";

const INCOMPLETE_DOC_PATTERNS = [
  /\bdocumentation does not provide\b/i,
  /\bdocs do not provide\b/i,
  /\bdocumentation is incomplete\b/i,
  /\bdocs are incomplete\b/i,
  /\bdoes not provide specific commands\b/i,
  /\bcannot provide reliable setup commands\b/i,
  /\binsufficient documentation\b/i,
  /\bmissing setup\b/i,
  /\bnot enough information\b/i,
  /\bcannot determine\b/i,
];

const INVENTED_SETUP_PATTERNS = [
  /\bnpm shadow-install\b/i,
  /\bshadowbench deploy\b/i,
  /\bnpm install shadow-agent\b/i,
  /\bshadow-[a-z0-9_-]+\b/i,
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
      verdict:
        "Answer correctly acknowledges incomplete documentation without inventing commands.",
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
