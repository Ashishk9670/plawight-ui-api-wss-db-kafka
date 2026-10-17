# Explore the AUT (exploratory testing with Playwright MCP)

Prerequisite: the AUT is running (`npm run aut:up`) and the `playwright` MCP server is enabled.

Prompt:

> Using the Playwright MCP tools, open http://localhost:3000 and explore the app as `user@shop.test` /
> `Password123!`. Cover login, product search, the cart, and placing an order. For each screen list the interactive
> elements with their `data-testid`, the visible states (empty, error, success), and anything that looks like a bug
> or an untested edge case (empty cart, search with no result, rapid double clicks, reload mid-flow).
> Output a table: screen, element/testid, observed behaviour, suggested test, risk (high/medium/low).
> Do not modify any files and do not place more than three orders.

Use the result as input for `generate-test.md`.
