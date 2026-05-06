import type { ScoreResult } from "../scoring";

export interface BenchmarkTask {
  suite: string;
  id: string;
  expectedAnswer: string;
  evaluate: (answer: string) => ScoreResult;
}
