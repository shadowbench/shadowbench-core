import { scoreRefundPolicyTrap, type ScoreResult } from "../scoring";

export interface BenchmarkTask {
  suite: string;
  id: string;
  expectedAnswer: string;
  evaluate: (answer: string) => ScoreResult;
}

export const refundPolicyTrapTask: BenchmarkTask = {
  suite: "Web Chaos",
  id: "refund-policy-trap",
  expectedAnswer: "Refunds are accepted within 14 days of purchase.",
  evaluate: (answer: string) => scoreRefundPolicyTrap(answer),
};
