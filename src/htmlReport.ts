import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FailureMode } from "./scoring";
import type { CombinedRunReport, ComparisonRunReport, RunReport } from "./report";

type ReportInput = RunReport | CombinedRunReport | ComparisonRunReport;

const FAILURE_MODE_ORDER: FailureMode[] = [
  "prompt_injection",
  "secret_leak",
  "unsafe_action",
  "hallucination",
  "source_confusion",
  "task_collapse",
  "none",
];

function isCombinedReport(report: ReportInput): report is CombinedRunReport {
  return (
    typeof (report as CombinedRunReport).mode === "string" &&
    ((report as CombinedRunReport).mode === "demo" ||
      (report as CombinedRunReport).mode === "model")
  );
}

function isComparisonReport(report: ReportInput): report is ComparisonRunReport {
  return (report as ComparisonRunReport).mode === "compare";
}

function isRunReport(report: ReportInput): report is RunReport {
  return typeof (report as RunReport).task === "string";
}

function asRows(report: ReportInput): RunReport[] {
  if (isComparisonReport(report)) {
    return report.results.flatMap((providerResult) => providerResult.taskResults);
  }
  if (isCombinedReport(report)) {
    return report.results;
  }
  return isRunReport(report) ? [report] : [];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildFailureBreakdown(rows: RunReport[]): Record<FailureMode, number> {
  const counts = Object.fromEntries(
    FAILURE_MODE_ORDER.map((mode) => [mode, 0])
  ) as Record<FailureMode, number>;

  for (const row of rows) {
    counts[row.failureMode] += 1;
  }

  return counts;
}

function buildComparisonHtml(report: ComparisonRunReport): string {
  const providerCount = report.results.length;
  const bestScore = Math.max(...report.results.map((result) => result.averageScore), 0);
  const totalTasks = report.results.reduce(
    (sum, result) => sum + result.passed + result.failed,
    0
  );
  const totalFailures = report.results.reduce((sum, result) => sum + result.failed, 0);

  const winners = report.results.filter((result) => result.averageScore === bestScore);
  const isTie = winners.length > 1;
  const topResultTitle = isTie ? "Top Result: Tie" : "Top Result";
  const topProviderLine = isTie
    ? `Providers: ${winners.map((winner) => winner.provider).join(", ")}`
    : `Provider: ${winners[0]?.provider ?? "-"}`;
  const topFailureModes = isTie
    ? winners
        .flatMap((winner) => winner.failureModes)
        .filter((mode, index, arr) => arr.indexOf(mode) === index)
        .join(", ")
    : winners[0]?.failureModes.join(", ") ?? "none";

  const providerCardsHtml = report.results
    .map((result) => {
      const status = result.failed === 0 ? "passed" : "failed";
      return `
      <article class="provider-card ${status}">
        <div class="provider-head">
          <code>${escapeHtml(result.provider)}</code>
          <span class="status-pill ${status}">${status.toUpperCase()}</span>
        </div>
        <div class="provider-score">${result.averageScore}/100</div>
        <div class="provider-metrics">
          <span>Passed: ${result.passed}</span>
          <span>Failed: ${result.failed}</span>
        </div>
        <div class="provider-modes"><code>${escapeHtml(result.failureModes.join(", "))}</code></div>
      </article>`;
    })
    .join("");

  const providerEvidenceHtml = report.results
    .map((result) => {
      const taskRows =
        result.taskResults.length > 0
          ? result.taskResults
              .map(
                (taskResult) => `
            <tr class="compare-row">
              <td><code>${escapeHtml(taskResult.task)}</code></td>
              <td>${taskResult.score}</td>
              <td><span class="status-pill ${taskResult.status}">${taskResult.status.toUpperCase()}</span></td>
              <td><code>${escapeHtml(taskResult.failureMode)}</code></td>
              <td>${escapeHtml(taskResult.verdict)}</td>
            </tr>`
              )
              .join("")
          : `<tr><td colspan="5" style="color:#646674;">No task-level results available.</td></tr>`;

      return `
      <article class="provider-evidence-card">
        <div class="provider-evidence-head">
          <h4><code>${escapeHtml(result.provider)}</code></h4>
          <span class="status-pill ${result.failed === 0 ? "passed" : "failed"}">${
            result.failed === 0 ? "PASSED" : "FAILED"
          }</span>
        </div>
        <p class="provider-evidence-meta">Average score: ${result.averageScore}/100 | Passed: ${
          result.passed
        } | Failed: ${result.failed}</p>
        <table>
          <thead>
            <tr>
              <th>task</th>
              <th>score</th>
              <th>status</th>
              <th>failureMode</th>
              <th>verdict</th>
            </tr>
          </thead>
          <tbody>${taskRows}</tbody>
        </table>
      </article>`;
    })
    .join("");

  const rowsHtml = report.results
    .map(
      (result) => `
      <tr class="compare-row">
        <td><code>${escapeHtml(result.provider)}</code></td>
        <td>${result.averageScore}</td>
        <td>${result.passed}</td>
        <td>${result.failed}</td>
        <td><code>${escapeHtml(result.failureModes.join(", "))}</code></td>
        <td><span class="status-pill ${
          result.failed === 0 ? "passed" : "failed"
        }">${result.failed === 0 ? "PASSED" : "FAILED"}</span></td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ShadowBench Compare Report</title>
    <style>
      :root {
        --bg: #ffffff;
        --ink: #101014;
        --muted: #646674;
        --border: #e8e8ef;
        --accent: #6656d8;
        --warn: #7a2a2a;
        --ok-bg: #f1f0ff;
        --ok-ink: #4d3fbd;
        --bad-bg: #fbf1f1;
        --bad-ink: #7a2a2a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 32px 20px 48px;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        color: var(--ink);
        background: var(--bg);
        line-height: 1.45;
      }
      .wrap { max-width: 1080px; margin: 0 auto; }
      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 18px;
        margin-bottom: 20px;
        border-bottom: 1px solid var(--border);
      }
      .brand { display: flex; align-items: center; gap: 14px; }
      .logo-mark { width: 30px; height: 30px; background: var(--ink); position: relative; }
      .logo-mark::before {
        content: "";
        position: absolute;
        right: 0;
        bottom: 0;
        width: 11px;
        height: 11px;
        background: var(--bg);
      }
      .logo-mark::after {
        content: "";
        position: absolute;
        right: -7px;
        bottom: -7px;
        width: 6px;
        height: 6px;
        background: var(--accent);
      }
      .brand h1 { margin: 0; font-size: 24px; letter-spacing: -0.02em; }
      .brand-label {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-top: 2px;
      }
      .topbar-meta { color: var(--muted); font-size: 12px; text-align: right; }
      .hero, .card, .context, .interp {
        border: 1px solid var(--border);
        border-radius: 14px;
        background: #fff;
      }
      .hero { padding: 24px; margin-bottom: 12px; }
      .eyebrow {
        margin: 0 0 10px;
        color: var(--accent);
        font-size: 12px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-weight: 600;
      }
      .hero h2 { margin: 0 0 8px; font-size: 34px; letter-spacing: -0.03em; line-height: 1.1; }
      .hero p { margin: 0 0 10px; color: var(--muted); font-size: 15px; max-width: 820px; }
      .manifesto { margin: 0; color: var(--ink); font-size: 14px; }
      .summary-strip {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px;
        margin-bottom: 16px;
      }
      .metric {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 10px;
      }
      .metric-label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
      .metric-value { font-size: 22px; font-weight: 640; letter-spacing: -0.02em; }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1.4fr;
        gap: 14px;
        margin-bottom: 18px;
      }
      .card { padding: 16px; }
      .card h3 { margin: 0 0 10px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
      .top-value { font-size: 34px; line-height: 1; letter-spacing: -0.02em; margin-bottom: 8px; }
      .top-meta { color: var(--muted); font-size: 13px; }
      .providers { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
      .provider-card {
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px;
      }
      .provider-card.failed { border-color: #e7cccc; background: #fef8f8; }
      .provider-card.passed { border-color: #ddd8ff; background: #fbfaff; }
      .provider-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .provider-score { font-size: 28px; letter-spacing: -0.02em; margin-bottom: 8px; }
      .provider-metrics { display: flex; gap: 10px; color: var(--muted); font-size: 13px; margin-bottom: 7px; }
      .provider-modes { font-size: 12px; }
      .status-pill {
        display: inline-block;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        border-radius: 999px;
        padding: 4px 9px;
        border: 1px solid transparent;
      }
      .status-pill.passed { background: var(--ok-bg); color: var(--ok-ink); border-color: #d5cdf7; }
      .status-pill.failed { background: var(--bad-bg); color: var(--bad-ink); border-color: #efcaca; }
      table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        border: 1px solid var(--border);
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 16px;
      }
      th, td {
        border-bottom: 1px solid var(--border);
        text-align: left;
        padding: 12px 13px;
        font-size: 13px;
        vertical-align: top;
      }
      tbody tr:last-child td { border-bottom: none; }
      th {
        color: var(--muted);
        background: #fbfbfe;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .compare-row:hover td { background: #fafafa; }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size: 12px;
      }
      .context, .interp { padding: 15px; margin-bottom: 14px; }
      .context h3, .interp h3 { margin: 0 0 8px; font-size: 16px; }
      .context p, .interp p { margin: 0 0 10px; color: var(--muted); font-size: 14px; }
      .provider-evidence { margin-bottom: 16px; }
      .provider-evidence h3 { margin: 0 0 10px; font-size: 16px; }
      .provider-evidence-card {
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px;
        margin-bottom: 10px;
        background: #fff;
      }
      .provider-evidence-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .provider-evidence-head h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }
      .provider-evidence-meta {
        margin: 0 0 10px;
        color: var(--muted);
        font-size: 13px;
      }
      .labels { display: flex; flex-wrap: wrap; gap: 8px; }
      .label {
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
      }
      footer {
        margin-top: 18px;
        color: var(--muted);
        font-size: 12px;
        border-top: 1px solid var(--border);
        padding-top: 12px;
        display: flex;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
      }
      @media (max-width: 900px) {
        .summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 640px) {
        body { padding: 20px 12px 28px; }
        .topbar { align-items: flex-start; flex-direction: column; gap: 10px; }
        .topbar-meta { text-align: left; }
        .hero h2 { font-size: 28px; }
        .summary-strip { grid-template-columns: 1fr; }
        th, td { padding: 10px 9px; font-size: 12px; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header class="topbar">
        <div class="brand">
          <div class="logo-mark" aria-hidden="true"></div>
          <div>
            <h1>ShadowBench</h1>
            <div class="brand-label">Model Compare Report</div>
          </div>
        </div>
        <div class="topbar-meta">
          <div>Report ID: ${escapeHtml(report.runId)}</div>
          <div>${escapeHtml(report.timestamp)}</div>
        </div>
      </header>

      <section class="hero">
        <p class="eyebrow">${escapeHtml(`${report.suite} Compare`.toUpperCase())}</p>
        <h2>Model comparison across hostile web tasks</h2>
        <p>ShadowBench compares model behavior across prompt injection, secret leakage, hallucination, unsafe action, and source-confusion traps.</p>
        <p class="manifesto">Agent demos are controlled. Reality is not.</p>
      </section>

      <section class="summary-strip">
        <div class="metric"><span class="metric-label">Providers tested</span><span class="metric-value">${providerCount}</span></div>
        <div class="metric"><span class="metric-label">Best score</span><span class="metric-value">${bestScore}/100</span></div>
        <div class="metric"><span class="metric-label">Total tasks</span><span class="metric-value">${totalTasks}</span></div>
        <div class="metric"><span class="metric-label">Total failures</span><span class="metric-value">${totalFailures}</span></div>
      </section>

      <section class="grid">
        <article class="card">
          <h3>${topResultTitle}</h3>
          <div class="top-value">${isTie ? "Tie" : escapeHtml(winners[0]?.provider ?? "-")}</div>
          <div class="top-meta">${escapeHtml(topProviderLine)}</div>
          <div class="top-meta">Score: ${bestScore}/100</div>
          <div class="top-meta">Passed: ${
            isTie ? winners.map((winner) => winner.passed).join(", ") : winners[0]?.passed ?? 0
          }</div>
          <div class="top-meta">Failed: ${
            isTie ? winners.map((winner) => winner.failed).join(", ") : winners[0]?.failed ?? 0
          }</div>
          <div class="top-meta">Failure modes: ${escapeHtml(topFailureModes || "none")}</div>
        </article>
        <article class="card">
          <h3>Provider Cards</h3>
          <div class="providers">${providerCardsHtml}</div>
        </article>
      </section>

      <section>
        <h3 style="margin: 0 0 10px; font-size: 16px;">Comparison Table</h3>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Score</th>
            <th>passed</th>
            <th>failed</th>
            <th>Failure Modes</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}
        </tbody>
      </table>
      </section>

      <section class="provider-evidence">
        <h3>Provider Evidence Summary</h3>
        ${providerEvidenceHtml}
      </section>

      <section class="context">
        <h3>Benchmark Context</h3>
        <p>The Web Chaos Suite tests whether models and agents can operate in hostile web-like environments without following hidden instructions, leaking secrets, inventing unsupported commands, confirming unsafe actions, or trusting lower-priority sources.</p>
        <div class="labels">
          <span class="label">Prompt Injection</span>
          <span class="label">Secret Leakage</span>
          <span class="label">Unsafe Action</span>
          <span class="label">Hallucination</span>
          <span class="label">Source Confusion</span>
        </div>
      </section>

      <section class="interp">
        <h3>Interpretation</h3>
        <p>A comparison report does not claim that one provider is universally safer or better. It shows how each tested provider behaved on the defined ShadowBench task set at the time of the run. Passing means the provider did not trigger the defined failure modes in this suite. Failing means one or more task-level failure criteria were triggered and should be inspected.</p>
      </section>

      <footer>
        <span>ShadowBench is experimental and early-stage. Results are meant for reproducible evaluation, not absolute claims.</span>
        <span>Generated by ShadowBench Core</span>
      </footer>
    </div>
  </body>
</html>`;
}

function buildHtml(report: ReportInput): string {
  if (isComparisonReport(report)) {
    return buildComparisonHtml(report);
  }

  const rows = asRows(report);
  const averageScore = Math.round(
    rows.reduce((sum, row) => sum + row.score, 0) / rows.length
  );
  const overallStatus = rows.every((row) => row.status === "passed")
    ? "passed"
    : "failed";
  const failureCount = rows.filter((row) => row.status === "failed").length;
  const passedCount = rows.filter((row) => row.status === "passed").length;
  const breakdown = buildFailureBreakdown(rows);
  const failureModesTriggered = FAILURE_MODE_ORDER.filter(
    (mode) => mode !== "none" && breakdown[mode] > 0
  ).length;
  const hasRealFailures = failureModesTriggered > 0;

  const suiteName = rows[0]?.suite ?? "Unknown Suite";
  const heroTitle =
    overallStatus === "passed"
      ? "Agent survived hostile web tasks"
      : "Agent failed hostile web tasks";
  const verdictText =
    overallStatus === "passed"
      ? "Verdict: The agent completed the Web Chaos Suite without triggering defined failure modes."
      : "Verdict: The agent triggered one or more defined failure modes and should not be considered production-stable for this suite.";
  const scoreBarColor = overallStatus === "passed" ? "var(--accent)" : "var(--ink)";

  const tableRowsHtml = rows
    .map(
      (row) => `
        <tr class="summary-row">
          <td><code>${escapeHtml(row.task)}</code></td>
          <td>${row.score}</td>
          <td><span class="status-pill ${row.status}">${row.status.toUpperCase()}</span></td>
          <td><code>${escapeHtml(row.failureMode)}</code></td>
          <td>${escapeHtml(row.verdict)}</td>
        </tr>`
    )
    .join("");

  const summaryStripHtml = `
    <section class="summary-strip">
      <div class="summary-metric"><span class="metric-label">Tasks tested</span><span class="metric-value">${rows.length}</span></div>
      <div class="summary-metric"><span class="metric-label">Passed</span><span class="metric-value">${passedCount}</span></div>
      <div class="summary-metric"><span class="metric-label">Failed</span><span class="metric-value">${failureCount}</span></div>
      <div class="summary-metric"><span class="metric-label">Failure modes triggered</span><span class="metric-value">${failureModesTriggered}</span></div>
    </section>`;

  const tileCardsHtml = rows
    .map(
      (row) => `
      <article class="task-tile ${row.status === "failed" ? "task-failed" : "task-passed"}">
        <div class="tile-task"><code>${escapeHtml(row.task)}</code></div>
        <div class="tile-score">${row.score}/100</div>
        <div class="tile-meta">
          <span class="status-pill ${row.status}">${row.status.toUpperCase()}</span>
          <code>${escapeHtml(row.failureMode)}</code>
        </div>
      </article>`
    )
    .join("");

  const evidenceCardsHtml = rows
    .map(
      (row) => `
      <article class="evidence-card ${row.status === "failed" ? "failed" : "passed"}">
        <div class="evidence-head">
          <div class="evidence-task"><code>${escapeHtml(row.task)}</code></div>
          <span class="status-pill ${row.status}">${row.status.toUpperCase()}</span>
        </div>
        <div class="evidence-meta">
          <span>Score: ${row.score}/100</span>
          <span>Failure mode: <code>${escapeHtml(row.failureMode)}</code></span>
        </div>
        <div class="evidence-block">
          <div class="evidence-label">Expected answer</div>
          <div class="expected-box">${escapeHtml(row.expected)}</div>
        </div>
        <div class="evidence-block">
          <div class="evidence-label">Actual answer</div>
          <div class="actual-box">${escapeHtml(row.actual)}</div>
        </div>
        <div class="evidence-block">
          <div class="evidence-label">Verdict</div>
          <div class="verdict-box">${escapeHtml(row.verdict)}</div>
        </div>
      </article>`
    )
    .join("");

  const breakdownBarsHtml = FAILURE_MODE_ORDER.map(
    (mode) => {
      const count = breakdown[mode];
      let fillColor = "#d8d8e2";
      if (mode === "none") {
        fillColor = "var(--accent)";
      } else if (count > 0) {
        fillColor = "var(--warn)";
      } else if (hasRealFailures) {
        fillColor = "#ececf2";
      }

      return `
      <div class="breakdown-item">
        <div class="breakdown-head">
          <code>${mode}</code>
          <span>${count}</span>
        </div>
        <div class="breakdown-track">
          <div class="breakdown-fill" style="width: ${
            rows.length === 0 ? 0 : (breakdown[mode] / rows.length) * 100
          }%; background: ${fillColor};"></div>
        </div>
      </div>`;
    }
  ).join("");

  const mode = isCombinedReport(report)
    ? report.mode ?? "-"
    : isComparisonReport(report)
      ? "compare"
      : "-";
  const provider = isCombinedReport(report)
    ? report.provider ?? "-"
    : isComparisonReport(report)
      ? report.providers.join(", ")
      : "-";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ShadowBench Report</title>
    <style>
      :root {
        --bg: #ffffff;
        --ink: #101014;
        --muted: #646674;
        --border: #e8e8ef;
        --border-strong: #d8d8e2;
        --accent: #6656d8;
        --warn: #7a2a2a;
        --ok-bg: #eef8f1;
        --ok-ink: #165330;
        --bad-bg: #fbf1f1;
        --bad-ink: #7a2a2a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 32px 20px 52px;
        background: var(--bg);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.45;
      }
      .container { max-width: 1080px; margin: 0 auto; }
      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 18px;
        margin-bottom: 20px;
        border-bottom: 1px solid var(--border);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .logo-mark {
        width: 30px;
        height: 30px;
        background: var(--ink);
        position: relative;
      }
      .logo-mark::before {
        content: "";
        position: absolute;
        right: 0;
        bottom: 0;
        width: 11px;
        height: 11px;
        background: var(--bg);
      }
      .logo-mark::after {
        content: "";
        position: absolute;
        right: -7px;
        bottom: -7px;
        width: 6px;
        height: 6px;
        background: var(--accent);
      }
      .brand h1 {
        margin: 0;
        font-size: 24px;
        letter-spacing: -0.02em;
      }
      .brand-label {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-top: 2px;
      }
      .topbar-meta {
        color: var(--muted);
        font-size: 12px;
        text-align: right;
      }
      .hero,
      .card,
      .method-strip {
        border: 1px solid var(--border);
        border-radius: 14px;
        background: #fff;
      }
      .hero {
        padding: 24px;
        margin-bottom: 12px;
      }
      .eyebrow {
        margin: 0 0 10px;
        color: var(--accent);
        font-size: 12px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-weight: 600;
      }
      .hero-title {
        margin: 0 0 8px;
        font-size: 34px;
        letter-spacing: -0.03em;
        line-height: 1.1;
      }
      .hero-subtitle {
        margin: 0 0 10px;
        max-width: 780px;
        color: var(--muted);
        font-size: 15px;
      }
      .hero-manifesto {
        margin: 0;
        font-size: 14px;
        color: var(--ink);
        letter-spacing: 0.01em;
      }
      .summary-strip {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px;
        margin-bottom: 16px;
      }
      .summary-metric {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 10px;
        background: #fff;
      }
      .metric-label {
        display: block;
        font-size: 12px;
        color: var(--muted);
        margin-bottom: 4px;
      }
      .metric-value {
        font-size: 22px;
        font-weight: 640;
        letter-spacing: -0.02em;
      }
      .grid {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 16px;
        margin-bottom: 16px;
      }
      .card { padding: 18px; }
      .section-title {
        margin: 0 0 10px;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }
      .meta-row {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 8px;
        margin: 5px 0;
        font-size: 14px;
      }
      .meta-key { color: var(--muted); }
      .score {
        font-size: 66px;
        font-weight: 700;
        line-height: 0.95;
        color: var(--accent);
        margin: 4px 0 14px;
      }
      .score-meta {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }
      .score-label {
        margin: 0 0 6px;
        font-size: 12px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .status-pill {
        display: inline-block;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.06em;
        border-radius: 999px;
        padding: 4px 10px;
        border: 1px solid transparent;
      }
      .status-pill.passed { background: var(--ok-bg); color: var(--ok-ink); border-color: #d2e9da; }
      .status-pill.failed { background: var(--bad-bg); color: var(--bad-ink); border-color: #f1cccc; }
      .tech-labels {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 12px 0 8px;
      }
      .tech-label {
        font-size: 11px;
        color: var(--muted);
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 3px 8px;
      }
      .score-track {
        margin-top: 12px;
        width: 100%;
        height: 6px;
        border-radius: 999px;
        background: #ececf2;
        overflow: hidden;
      }
      .score-fill {
        height: 100%;
        width: ${averageScore}%;
        background: ${scoreBarColor};
      }
      .verdict {
        border: 1px solid var(--border-strong);
        border-radius: 12px;
        padding: 14px 16px;
        margin-bottom: 16px;
        font-size: 14px;
      }
      .verdict strong { font-weight: 600; }
      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 10px;
        margin-bottom: 20px;
      }
      .task-tile {
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px;
        min-height: 102px;
      }
      .task-tile.task-failed {
        border-color: #e7cccc;
        background: #fef8f8;
      }
      .tile-task { font-size: 13px; margin-bottom: 8px; }
      .tile-score { font-size: 26px; font-weight: 650; margin-bottom: 8px; letter-spacing: -0.02em; }
      .tile-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size: 12px;
      }
      h2 {
        margin: 0 0 10px;
        font-size: 16px;
        letter-spacing: -0.01em;
      }
      table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        border: 1px solid var(--border);
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 20px;
      }
      th, td {
        border-bottom: 1px solid var(--border);
        text-align: left;
        padding: 12px 13px;
        font-size: 13px;
        vertical-align: top;
      }
      tbody tr:last-child td { border-bottom: none; }
      th {
        color: var(--muted);
        font-weight: 600;
        background: #fafaff;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .summary-row:hover td { background: #fafafa; }
      .breakdown {
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 18px;
      }
      .breakdown-item + .breakdown-item { margin-top: 10px; }
      .breakdown-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        margin-bottom: 5px;
      }
      .breakdown-track {
        width: 100%;
        height: 6px;
        border-radius: 999px;
        background: #ececf2;
        overflow: hidden;
      }
      .breakdown-fill {
        height: 100%;
        background: var(--accent);
      }
      .method-strip {
        padding: 15px;
        margin-bottom: 18px;
      }
      .evidence-section { margin-bottom: 18px; }
      .evidence-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 10px;
      }
      .evidence-card {
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px;
        background: #fff;
      }
      .evidence-card.failed {
        border-color: #e7cccc;
        background: #fef8f8;
      }
      .evidence-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 7px;
      }
      .evidence-task { font-size: 13px; }
      .evidence-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        font-size: 12px;
        color: var(--muted);
        margin-bottom: 10px;
      }
      .evidence-block + .evidence-block { margin-top: 8px; }
      .evidence-label {
        font-size: 12px;
        color: var(--muted);
        margin-bottom: 4px;
      }
      .expected-box,
      .actual-box,
      .verdict-box {
        border: 1px solid var(--border);
        border-radius: 9px;
        padding: 8px 9px;
        font-size: 13px;
      }
      .expected-box { color: var(--muted); background: #fcfcff; }
      .actual-box { white-space: pre-wrap; word-break: break-word; background: #fff; }
      .verdict-box { background: #fcfcff; }
      .method-strip p {
        margin: 0 0 10px;
        color: var(--muted);
        font-size: 14px;
      }
      .method-labels {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .method-label {
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
      }
      footer {
        margin-top: 20px;
        color: var(--muted);
        font-size: 12px;
        border-top: 1px solid var(--border);
        padding-top: 12px;
        display: flex;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
      }
      body.overall-failed .score { color: var(--warn); }
      body.overall-failed .score-fill { background: var(--warn); }
      body.overall-failed .verdict {
        border-color: #ddb8b8;
        background: #fef7f7;
      }
      body.overall-failed .summary-strip {
        border-color: #e5d2d2;
      }
      @media (max-width: 860px) {
        .grid { grid-template-columns: 1fr; }
        .hero-title { font-size: 28px; }
        .summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 640px) {
        body { padding: 20px 12px 30px; }
        .topbar { align-items: flex-start; gap: 10px; flex-direction: column; }
        .topbar-meta { text-align: left; }
        .score { font-size: 52px; }
        th, td { padding: 10px 9px; font-size: 12px; }
        .summary-strip { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body class="overall-${overallStatus}">
    <div class="container">
      <header class="topbar">
        <div class="brand">
          <div class="logo-mark" aria-hidden="true"></div>
          <div>
            <h1>ShadowBench</h1>
            <div class="brand-label">Agent Crash-Test Report</div>
          </div>
        </div>
        <div class="topbar-meta">
          <div>Report ID: ${escapeHtml(rows[0]?.runId ?? "-")}</div>
          <div>${escapeHtml(rows[0]?.timestamp ?? "-")}</div>
        </div>
      </header>

      <section class="hero">
        <p class="eyebrow">${escapeHtml(suiteName.toUpperCase())}</p>
        <h2 class="hero-title">${heroTitle}</h2>
        <p class="hero-subtitle">ShadowBench evaluates agent behavior under prompt injection, secret leakage, hallucination, unsafe action, and source-confusion traps.</p>
        <p class="hero-manifesto">Agent demos are controlled. Reality is not.</p>
      </section>
      ${summaryStripHtml}

      <div class="grid">
        <section class="card">
          <h2 class="section-title">Metadata</h2>
          <div class="meta-row"><div class="meta-key">runId</div><div>${escapeHtml(
            rows[0]?.runId ?? "-"
          )}</div></div>
          <div class="meta-row"><div class="meta-key">timestamp</div><div>${escapeHtml(
            rows[0]?.timestamp ?? "-"
          )}</div></div>
          <div class="meta-row"><div class="meta-key">suite</div><div>${escapeHtml(
            rows[0]?.suite ?? "-"
          )}</div></div>
          <div class="meta-row"><div class="meta-key">mode</div><div>${escapeHtml(mode)}</div></div>
          <div class="meta-row"><div class="meta-key">provider</div><div>${escapeHtml(
            provider
          )}</div></div>
        </section>

        <section class="card">
          <h2 class="section-title">Score Card</h2>
          <p class="score-label">Overall Score</p>
          <div class="score">${averageScore}/100</div>
          <div class="score-meta">
            <span class="status-pill ${overallStatus}">${overallStatus.toUpperCase()}</span>
            <span style="font-size: 13px; color: var(--muted);">Failure count: ${failureCount}</span>
          </div>
          <div class="tech-labels">
            <span class="tech-label">mode: ${escapeHtml(mode)}</span>
            <span class="tech-label">provider: ${escapeHtml(provider)}</span>
          </div>
          <div class="score-track"><div class="score-fill"></div></div>
        </section>
      </div>

      <section class="verdict"><strong>${escapeHtml(verdictText)}</strong></section>

      <section>
        <h2>Task Cards</h2>
        <div class="tiles">${tileCardsHtml}</div>
      </section>

      <section>
        <h2>Summary</h2>
        <table>
          <thead>
            <tr>
              <th>task</th>
              <th>score</th>
              <th>status</th>
              <th>failure mode</th>
              <th>verdict</th>
            </tr>
          </thead>
          <tbody>${tableRowsHtml}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Failure Breakdown</h2>
        <div class="breakdown">${breakdownBarsHtml}</div>
      </section>

      <section class="evidence-section">
        <h2>Evidence Trace</h2>
        <div class="evidence-cards">${evidenceCardsHtml}</div>
      </section>

      <section class="method-strip">
        <h2>Benchmark Context</h2>
        <p>The Web Chaos Suite tests whether an agent can operate in hostile web-like environments without following hidden instructions, leaking secrets, inventing unsupported commands, confirming unsafe actions, or trusting lower-priority sources.</p>
        <div class="method-labels" style="margin-bottom: 12px;">
          <span class="method-label">Prompt Injection</span>
          <span class="method-label">Secret Leakage</span>
          <span class="method-label">Unsafe Action</span>
          <span class="method-label">Hallucination</span>
          <span class="method-label">Source Confusion</span>
        </div>
        <h2>Methodology</h2>
        <p>Each ShadowBench task defines a visible source of truth, hostile distractions, expected behavior, and failure criteria. Results are generated from reproducible task definitions and saved as JSON reports.</p>
        <div class="method-labels">
          <span class="method-label">Source of truth</span>
          <span class="method-label">Hostile condition</span>
          <span class="method-label">Failure scoring</span>
          <span class="method-label">Traceable report</span>
        </div>
      </section>

      <footer>
        <span>ShadowBench is experimental and early-stage. Results are meant for reproducible evaluation, not absolute claims.</span>
        <span>Generated by ShadowBench Core</span>
      </footer>
    </div>
  </body>
</html>`;
}

export function generateHtmlReport(reportPathArg: string): string {
  const jsonPath = path.resolve(process.cwd(), reportPathArg);
  const raw = readFileSync(jsonPath, "utf-8");
  const parsed = JSON.parse(raw) as ReportInput;

  const html = buildHtml(parsed);
  const reportsDir = path.resolve(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });

  const baseName = path.basename(jsonPath, path.extname(jsonPath));
  const outPath = path.join(reportsDir, `${baseName}.html`);
  writeFileSync(outPath, html, "utf-8");

  return outPath;
}
