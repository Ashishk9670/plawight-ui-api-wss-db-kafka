# Playwright framework: UI + REST + GraphQL + WebSocket + Kafka + DB + E2E + AI

Roadmap and rationale: [PLAN.md](PLAN.md).

## What is covered

| Area                  | Where                                                     | Notes                                                                   |
| --------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| UI (POM + components) | `tests/ui`                                                | Chromium full run, Firefox/WebKit/mobile smoke, shared login session    |
| REST                  | `tests/api/rest`                                          | CRUD, auth, negative cases, chaining                                    |
| GraphQL               | `tests/api/graphql`                                       | queries, mutations, variables, error handling                           |
| Contract              | `tests/api/contract`                                      | responses validated against `aut/openapi.json`; GraphQL schema snapshot |
| Security              | `tests/api/security`, `tests/ui/security.spec.ts`         | JWT tampering, injection, XSS, rate limit, headers                      |
| Concurrency           | `tests/api/concurrency.spec.ts`                           | parallel orders never oversell                                          |
| WebSocket             | `tests/websocket`, `tests/ui/websocket-reconnect.spec.ts` | auth, ping/echo, per-user pushes, UI reconnect and resync               |
| Kafka                 | `tests/messaging`                                         | event payloads, ordering, no event on rejection                         |
| Database              | `tests/db`                                                | persistence, rollback, stock, referential integrity                     |
| E2E                   | `tests/e2e`                                               | UI -> REST/GraphQL -> DB -> Kafka -> WebSocket -> UI                    |
| Accessibility         | `tests/ui/a11y.spec.ts`                                   | axe, WCAG 2.1 AA, keyboard-only login                                   |
| Opt-in suites         | `tests/perf`, `tests/visual`, `tests/chaos`               | run with their own scripts (below)                                      |

## Layout

- `aut/`: Application Under Test (Express + Postgres + Kafka + WebSocket + GraphQL + static UI). Also serves
  `openapi.json`, a test-only seeding API (`ENABLE_TEST_API=true`) and an opt-in login rate limiter.
- `docker/docker-compose.yml`: Postgres, Kafka (KRaft), AUT
- `config/env.ts`, `env/.env.<TEST_ENV>`: zod-validated config (real env vars win, so CI secrets override)
- `clients/`: REST, GraphQL (+ `graphql-operations.ts`), WebSocket, Kafka listener
- `services/`: Auth, Product, Order, Seed. Types come from `schemas/api.generated.ts`
- `pages/`, `components/`: page and component objects (`data-testid` locators)
- `fixtures/base.fixture.ts`: pages, services, per-role GraphQL/WebSocket clients, `db`, `kafka`, `seed`, `cleanup`, `makeProduct`
- `schemas/`: zod schemas, plus generated OpenAPI and GraphQL types (`npm run gen`)
- `utils/`: logger, db client, `waitFor`, data factory, schema and OpenAPI validators
- `ai/`, `specs/`, `.claude/agents/`, `.mcp.json`: Playwright MCP, planner/generator/healer agents, prompts
- `.github/workflows/`: CI (shards, merged report, PR summary, Allure) and optional AI triage

## Run

```bash
npm install && npx playwright install
npm run aut:up            # needs Docker (CI uses aut:up:ci with a pre-built image). UI http://localhost:3000, GraphQL /graphql, WS /ws, spec /openapi.json
npm test                  # every default project
npm run test:smoke        # @smoke tier
npm run test:regression   # everything except @smoke and @slow
npm run test:ui | test:api | test:ws | test:kafka | test:db | test:e2e | test:mobile
npm run test:contract | test:security | test:a11y | test:concurrency
npm run test:perf         # latency budgets (single worker)
npm run test:visual       # screenshot comparison; test:visual:update to accept new baselines
npm run test:chaos        # stops and restarts the Kafka container, takes a few minutes
npm run report            # HTML report
npm run allure:generate && npm run allure:open   # Allure (needs Java)
npm run lint | typecheck | format
npm run gen               # regenerate API and GraphQL types after changing openapi.json / schema.graphql
npm run aut:down
```

Seed logins: `user@shop.test` / `Password123!`, `admin@shop.test` / `Admin123!`.
Kafka (host): `localhost:9094`, topic `orders`. Postgres (host): `localhost:5433`.

## Tag tiers

`@smoke` is the fast critical set (runs on every PR). Everything untagged is regression and runs nightly.
`@slow` marks long tests (chaos). Layer tags (`@api @graphql @ws @kafka @db @e2e @contract @security @a11y
@concurrency @perf @visual @chaos`) select a slice.

## Conventions

See [.github/copilot-instructions.md](.github/copilot-instructions.md). Tests must be parallel-safe: create data with
`makeProduct` or `seed`, match Kafka and WebSocket messages by order id, and clean up through fixtures. A pre-commit
hook (Husky) runs lint-staged and the typecheck.

## Bugs these tests found in the AUT (all fixed)

- Stored XSS in product names (`tests/ui/security.spec.ts`).
- Toast colour contrast below WCAG AA (`tests/ui/a11y.spec.ts`).
- With Kafka down, `POST /api/orders` committed the order and then returned 500, so a client retry created a duplicate.
  The AUT now compensates (stock restored, order removed) and answers 503; a failed status update is reverted.
  Regression tests: `tests/chaos/kafka-outage.spec.ts`.
- The Kafka producer hung requests for minutes during an outage; it now fails within seconds.
- The UI never reconnected its WebSocket and missed updates; it now reconnects and resyncs
  (`tests/ui/websocket-reconnect.spec.ts`).

## Limits to know about

- Firefox cannot be launched from some sandboxed shells ("Could not find profile folder"). It runs fine in CI;
  run `npm run test:ui -- --project=ui-firefox` from a normal terminal.
- CI caches npm, Playwright browsers and the AUT image layers. The Postgres and Kafka images are pulled on every job.
- The Pages report (`ENABLE_PAGES=true`) and the AI triage workflow (`ENABLE_AI_TRIAGE=true` plus the
  `ANTHROPIC_API_KEY` secret) are opt-in and need repository settings only you can change.
