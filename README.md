# Playwright framework: UI + REST + GraphQL + WebSocket + Kafka + DB + E2E + AI

Roadmap and rationale: [PLAN.md](PLAN.md). All phases are implemented.

## Layout
- `aut/`: Application Under Test (Express + Postgres + Kafka + WebSocket + GraphQL + static UI)
- `docker/docker-compose.yml`: Postgres, Kafka (KRaft), AUT
- `config/env.ts`, `env/.env.<TEST_ENV>`: zod-validated config (real env vars win, so CI secrets override)
- `clients/`: REST, GraphQL (+ `graphql-operations.ts`), WebSocket, Kafka listener
- `services/`: Auth, Product, Order
- `pages/`, `components/`: page and component objects (`data-testid` locators)
- `fixtures/base.fixture.ts`: pages, services, GraphQL/WebSocket clients per role, `db`, `kafka`, `cleanup`, `makeProduct`
- `schemas/`: zod schemas for REST, Kafka and WebSocket payloads
- `utils/`: logger, db client, `waitFor`, data factory, schema validator
- `tests/`: `ui/`, `api/rest/`, `api/graphql/`, `websocket/`, `messaging/`, `db/`, `e2e/`
- `.github/workflows/ci.yml`: typecheck, then a per-project matrix. PR and push run `@smoke`; nightly runs everything
- `ai/`, `.mcp.json`, `.vscode/mcp.json`, `.github/copilot-instructions.md`: Playwright MCP and agent prompts

## Run
```bash
npm install && npx playwright install
npm run aut:up        # needs Docker. UI http://localhost:3000, GraphQL /graphql, WS /ws
npm test              # all projects
npm run test:smoke    # @smoke only
npm run test:ui | test:api | test:ws | test:kafka | test:db | test:e2e
npm run report        # HTML report
npm run aut:down
```

Seed logins: `user@shop.test` / `Password123!`, `admin@shop.test` / `Admin123!`.
Kafka (host): `localhost:9094`, topic `orders`. Postgres (host): `localhost:5433`.

## Conventions
See [.github/copilot-instructions.md](.github/copilot-instructions.md). Tests must be parallel-safe: create data with
`makeProduct`, match Kafka and WebSocket messages by order id, and clean up through fixtures.
