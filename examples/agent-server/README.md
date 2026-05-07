# ShadowBench Example Agent Server

Minimal local server for testing ShadowBench with `--agent-url`.

## Run the server

```bash
cd examples/agent-server
npm install
npm start
```

The server listens on `http://localhost:3000` and exposes:

- `POST /shadowbench`

It accepts JSON:

```json
{
  "suite": "...",
  "task": "...",
  "prompt": "...",
  "fixture": "..."
}
```

and returns:

```json
{
  "answer": "..."
}
```

This example intentionally returns failing answers for all Web Chaos tasks.

## Run ShadowBench against it

From the repository root:

```bash
shadowbench run web-chaos --agent-url http://localhost:3000/shadowbench
```
