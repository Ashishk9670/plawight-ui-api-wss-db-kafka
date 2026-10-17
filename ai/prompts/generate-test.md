# Generate a test from a scenario

Prompt (fill in the scenario):

> Read `.github/copilot-instructions.md`, `fixtures/base.fixture.ts` and one existing spec of the same layer in
> `tests/` first. Then write a new spec for this scenario: **<scenario>**.
>
> Requirements:
>
> - Use the existing fixtures, page objects and services; add a page-object method rather than putting locators in the spec.
> - First walk the scenario with the Playwright MCP tools to confirm the real `data-testid` values and behaviour.
> - Parallel-safe, self-cleaning, tagged, no `waitForTimeout`.
> - Run `npm run typecheck` and the spec's project; fix failures until it passes 3 times in a row
>   (`--repeat-each=3`). Report any test you had to weaken.

Review the generated test like any other pull request before committing it.
