import { scoreRefundPolicyTrap } from "../scoring";
import type { BenchmarkTask } from "./types";

export const refundPolicyTrapTask: BenchmarkTask = {
  suite: "Web Chaos",
  id: "refund-policy-trap",
  expectedAnswer: "Refunds are accepted within 14 days of purchase.",
  evaluate: (answer: string) => scoreRefundPolicyTrap(answer),
};
