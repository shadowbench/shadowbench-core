# GitHub Actions Example

This example shows how to run ShadowBench in CI and enforce a minimum benchmark score.

It performs:

- repository checkout
- Node.js setup
- dependency install + build
- startup of the local example agent server
- threshold-gated benchmark run

Workflow file: `examples/github-action/shadowbench.yml`

## How To Use

1. Copy `examples/github-action/shadowbench.yml` into your repository at `.github/workflows/shadowbench.yml`.
2. Commit and push.
3. The workflow runs on `push` and `pull_request`.

## Threshold Behavior (`--fail-under`)

`--fail-under` sets the minimum accepted average score (0-100) across Web Chaos tasks.

- If average score is below the threshold, ShadowBench exits with code `1` and CI fails.
- If average score meets or exceeds the threshold, ShadowBench exits successfully.

This example uses `--fail-under 20` because the bundled example agent intentionally returns failing answers. A higher threshold (for example `80`) is recommended for real agents.

## Use Your Own Agent Endpoint

Replace:

`http://localhost:3000/shadowbench`

with your agent URL, for example:

`https://your-agent.example.com/shadowbench`

Then tune `--fail-under` to your required quality bar.
