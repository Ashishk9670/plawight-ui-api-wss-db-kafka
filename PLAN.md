# Playwright Framework Plan: UI + REST + GraphQL + WebSocket + Kafka + DB + E2E + Agentic AI

Reference: https://products.iffsolutionacademy.com/ and the walkthrough video (mV0Ke4D3nBM).
Sources: product page text and video description only. The video transcript was not accessible, so the folder
layout below follows the page's published structure and the details are my own design.

## 1. Goal
One Playwright + TypeScript repo that tests a single Application Under Test (AUT) at every layer, and connects
the layers in E2E tests:

    UI -> REST / GraphQL -> Database -> WebSocket / Kafka event -> UI validation

Plus CI/CD (GitHub Actions) and an AI layer (Playwright MCP, Copilot agent).

## 2. Key decision: the AUT
The reference sells a bundled AUT. You do not have it, so build or pick one. Recommended: a small AUT of our own,
run via docker-compose, so every layer has something real to test.

| Layer | AUT component |
|---|---|
| UI | React/Next (or any) app with `data-testid` attributes: login, product list, cart, order |
| REST | Node/Express (or FastAPI) `/auth`, `/products`, `/orders`, `/users` |
| GraphQL | `/graphql` for products and orders (queries and mutations) |
| WebSocket | `/ws` order-status pushes |
| Kafka | order service publishes `order.created` / `order.updated` to a topic |
| DB | Postgres (orders, users, products) |

The user will need to confirm whether to build this AUT or point at an existing one. See "Open questions".

## 3. Tech stack
- Playwright Test + TypeScript (strict)
- `dotenv` for environments (`.env.dev|qa|stg`), `zod` for config and response schemas (or `ajv` for JSON schema)
- `graphql-request` or plain `request` for GraphQL; native `ws` for WebSocket
- `kafkajs` for Kafka; `pg` for Postgres
- `winston` or `pino` for logging; `@faker-js/faker` for test data
- ESLint + Prettier + Husky; Allure or the Playwright HTML reporter
- Docker Compose for the AUT, Kafka, and DB; GitHub Actions for CI

## 4. Folder structure
```
.
├── playwright.config.ts          # projects: ui-chromium/firefox/webkit, api, ws, messaging, e2e
├── .env.example  config/{dev,qa,stg}.ts
├── tests/
│   ├── ui/            api/rest/   api/graphql/   websocket/   messaging/   e2e/
├── pages/             # Page Objects (LoginPage, ProductsPage, CartPage, OrderPage)
├── components/        # Component Objects (Header, Table, Modal, Toast)
├── clients/           # RestClient, GraphQLClient, WebSocketClient, KafkaClient
├── services/          # AuthService, ProductService, OrderService, UserService (wrap clients)
├── fixtures/          # base.fixture.ts (merges auth, db, kafka, services, pages)
├── utils/             # db-client, schema-validator, event-validator, logger, wait, data-factory
├── test-data/         # json/csv + builders
├── schemas/           # zod / JSON schemas
├── ai/                # MCP config, Copilot agent instructions, prompt library
├── docker/            # docker-compose.yml (aut, postgres, kafka)
└── .github/workflows/ # ci.yml
```

## 5. Phases

**Phase 0: Setup (0.5 day)**
Init the repo, install Playwright and TypeScript, set up lint/format, `.env` handling, a typed `config` loader,
and the logger.

**Phase 1: AUT and infrastructure (1-2 days)**
Build or choose the AUT, write `docker-compose` (app, Postgres, Kafka), and add health checks and a seed script.
Add `globalSetup` that waits for services and seeds the DB.

**Phase 2: Core framework (1-2 days)**
- `BasePage` with wrapped actions (click, fill, expect) plus logging and `data-testid` locator helpers
- Component objects
- Fixtures: `authenticatedPage` using `storageState` (login once per worker), `apiContext`, `db`, `kafka`, `services`
- Tagging (`@smoke @regression @api @e2e`) and parallel/retry/trace config

**Phase 3: UI tests (1-2 days)**
Login positive and negative, product search and filter, cart, checkout form validation, data-driven cases, and
a cross-browser smoke run.

**Phase 4: REST API tests (1-2 days)**
CRUD with `request` fixture, auth token handling, headers, status codes, schema validation, API chaining
(create -> get -> update -> delete), negative cases.

**Phase 5: GraphQL (1 day)**
Queries, mutations, variables, error responses (`errors[]`), schema/data validation.

**Phase 6: WebSocket (1 day)**
`WebSocketClient` with a promise-based `waitForMessage(predicate, timeout)`; tests for connect, send, receive,
and event payload validation.

**Phase 7: Kafka / messaging (1-2 days)**
Producer and consumer helpers, a consumer that starts before the action, `waitForEvent` with a correlation id
and timeout, and payload schema checks. Isolate with unique consumer-group ids and unique keys.

**Phase 8: DB validation (1 day)**
`DbClient` with parameterized queries, a polling helper (`expect.poll`), and UI/API vs DB comparisons. Use
read-only DB access for verification.

**Phase 9: E2E (1-2 days)**
Business flow: create an order through the UI -> assert the REST/GraphQL response -> assert the DB row -> assert
the Kafka event and WebSocket status push -> assert the UI status. Cleanup in fixture teardown.

**Phase 10: Reporting and CI/CD (1 day)**
HTML plus Allure reports, trace/video on failure, and a GitHub Actions workflow: lint -> start docker
services -> run shards (matrix by project) -> upload reports. Smoke on PR, full regression on nightly schedule.

**Phase 11: Agentic AI + MCP (1-2 days)**
- Add Playwright MCP server config (`npx @playwright/mcp@latest`) for VS Code / Claude Code / Copilot
- Agent instructions file (conventions: POM, `data-testid`, fixtures, no hard waits)
- Workflows: exploratory run of the AUT, test-scenario generation, draft tests that a human reviews and
  commits, and failing-test triage using traces
- Principle (stated in the video description too): AI complements deterministic tests, it does not replace them

**Phase 12: Docs and hardening (0.5 day)**
README (setup, run commands, architecture diagram), contribution guide, and a flakiness pass (3x repeat run).

Rough total: 12-18 working days solo. Phases 3-8 can be built independently once Phases 1-2 are done.

## 6. Conventions
- Web-first assertions only, no `waitForTimeout`
- Tests are independent: each creates and cleans up its own data
- Selectors: `getByTestId`/role first
- Secrets only from env or CI secrets
- Every client call logs method, URL, and status

## 7. Open questions
1. Build our own AUT, or test an existing app or API you already have?
2. Which backends: Postgres or MySQL? Node or Java AUT?
3. Is Kafka needed locally in Docker (heavy), or is a mock acceptable to start?
4. CI target: GitHub Actions only?
5. Is this for learning or a portfolio project, or for a real product team? That affects how much of Phase 11 to build.

## 8. Note on the reference
The reference is a paid product (about 10.7k INR) with its own AUT. This plan rebuilds the same architecture
from the public description. It does not copy their code.
