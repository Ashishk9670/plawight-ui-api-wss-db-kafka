# AI layer

    AI agent -> Playwright MCP -> browser -> AUT -> human-reviewed Playwright tests

| File | Purpose |
|---|---|
| `../.mcp.json` | Playwright MCP for Claude Code and other MCP clients |
| `../.vscode/mcp.json` | Same server for VS Code / GitHub Copilot agent mode |
| `../.github/copilot-instructions.md` | Repo conventions every agent must follow |
| `prompts/explore-app.md` | Exploratory run of the AUT, producing a scenario table |
| `prompts/generate-test.md` | Turn a scenario into a spec using the framework's fixtures |
| `prompts/triage-failure.md` | Classify a failure (product bug, bad test, data, infra) with evidence |

AI complements the deterministic suite: it explores and drafts, and the CI suite stays plain Playwright, so it
is reproducible. Generated tests go through code review like any other change.
