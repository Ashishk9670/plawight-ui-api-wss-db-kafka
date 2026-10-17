# Instructions for AI agents (GitHub Copilot, Claude Code, others)

This repo is a Playwright + TypeScript framework testing the AUT in `aut/`
(UI + REST + GraphQL + WebSocket + Postgres + Kafka). Follow these conventions when you add or change tests.

## Layout (path aliases are defined in tsconfig.json)
- `tests/<layer>/` where layer is `ui`, `api/rest`, `api/graphql`, `websocket`, `messaging`, `db`, `e2e`
- `pages/` and `components/`: page and component objects. Locators live there, never in specs
- `clients/`: protocol clients. `services/`: API wrappers built on the clients
- `fixtures/base.fixture.ts`: always `import { test, expect } from '@fixtures/base.fixture'`
- `schemas/`: zod schemas for payloads. Validate with `validate()` from `@utils/schema-validator`

## Rules
1. Locators: `getByTestId` first (the AUT exposes `data-testid`), then role/text. No CSS/XPath chains.
2. No `waitForTimeout`. Use web-first assertions, `expect.poll`, `waitFor`, or the clients' `waitFor*` helpers.
3. Tests are independent and parallel-safe: create data with `makeProduct`, never rely on stock or ids of seed data
   being unchanged, and match events and messages by `orderId`, because other tests share the user and the topic.
4. Cleanup goes through the `cleanup` fixture (or `makeProduct`), so it also runs when the test fails.
5. Tag tests: `@smoke` for the fast critical set, plus a layer tag (`@api @graphql @ws @kafka @db @e2e`).
6. Credentials and URLs come from `config/env.ts`. Never hard-code them.
7. UI tests reuse the saved login session. Logged-out tests must use `test.use({ storageState: { cookies: [], origins: [] } })`.
8. Run `npm run typecheck` and the relevant project (`npm run test:<layer>`) before saying a change is done.

## Using Playwright MCP
The `playwright` MCP server (`.mcp.json`, `.vscode/mcp.json`) drives a real browser against the running AUT at
http://localhost:3000 (`npm run aut:up`). Use it to explore the app and to find real `data-testid` values and
behaviour before writing a test. Never invent locators. Prompts are in `ai/prompts/`.
AI-written tests are drafts: a human reviews them before they are committed.
