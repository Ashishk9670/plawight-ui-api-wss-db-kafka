# AI layer

    AI agent -> Playwright MCP -> browser -> AUT -> human-reviewed Playwright tests

| File                                  | Purpose                                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `../.mcp.json`, `../.vscode/mcp.json` | MCP servers: `playwright` (drive a browser) and `playwright-test` (list, run and debug tests)                   |
| `../.claude/agents/`                  | Playwright's **planner**, **generator** and **healer** agents (from `npx playwright init-agents --loop=claude`) |
| `../tests/ui/seed.spec.ts`            | Seed the agents start from: the logged-in shop page, using our fixtures                                         |
| `../specs/`                           | Test plans written by the planner (reviewed before generating tests)                                            |
| `../.github/copilot-instructions.md`  | Repo conventions every agent must follow                                                                        |
| `prompts/explore-app.md`              | Exploratory run of the AUT producing a scenario table                                                           |
| `prompts/generate-test.md`            | Turn a scenario into a spec using the framework's fixtures                                                      |
| `prompts/triage-failure.md`           | Classify a failure (AUT bug, bad test, data, infra) with evidence                                               |
| `prompts/jira-to-spec.md`             | Acceptance criteria from Jira/Confluence to a reviewed plan                                                     |
| `../.github/workflows/ai-triage.yml`  | Optional CI triage comment on failed `main` runs (disabled by default, see the header)                          |

## Agent workflow

1. **Planner**: explores the AUT from the seed and writes `specs/<feature>.md`.
2. **You** review and edit the plan.
3. **Generator**: turns each scenario into a spec under `tests/`, verifying selectors live in the browser.
4. **Healer**: runs failing tests, debugs, and patches them. Review its diffs. A healer that edits an assertion to
   make a test pass may be hiding a product bug.

AI complements the deterministic suite: it explores and drafts, while the CI suite stays plain Playwright, so it
is reproducible. Generated tests go through code review like any other change.
