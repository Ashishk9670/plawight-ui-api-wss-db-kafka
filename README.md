# Playwright framework: UI + REST + GraphQL + WebSocket + Kafka + DB

See [PLAN.md](PLAN.md) for the roadmap. Phases 0-2 are scaffolded.

## Layout
- `aut/`: the Application Under Test (Express + Postgres + Kafka + WebSocket + GraphQL + static UI)
- `docker/docker-compose.yml`: Postgres, Kafka (KRaft), AUT
- `config/env.ts`, `env/.env.<TEST_ENV>`: zod-validated config
- `clients/`: REST, GraphQL, WebSocket, Kafka
- `services/`: Auth, Product, Order
- `pages/`, `components/`: page and component objects (`data-testid` locators)
- `fixtures/base.fixture.ts`: pages, services, db, kafka, graphql, authenticated socket
- `utils/`: logger, db client, waitFor, data factory
- `tests/`: `auth.setup.ts`, `ui/`, `api/rest/` (smoke tests; later phases add `api/graphql`, `websocket`, `messaging`, `e2e`)

## Run
```bash
npm install && npx playwright install
npm run aut:up        # needs Docker; UI at http://localhost:3000, GraphQL at /graphql, WS at /ws
npm test              # all projects
npm run test:smoke    # @smoke only
npm run aut:down
```

Seed logins: `user@shop.test` / `Password123!`, `admin@shop.test` / `Admin123!`.
Kafka (host): `localhost:9094`, topic `orders`. Postgres (host): `localhost:5433`.
