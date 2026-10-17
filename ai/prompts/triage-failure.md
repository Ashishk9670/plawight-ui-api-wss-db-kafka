# Triage a failing test

Prompt (give the test title or the path to `test-results/<test>/`):

> This test fails: **<title>**. Read `test-results/<test>/error-context.md` and the trace
> (`npx playwright show-trace`), then the spec and the page objects it uses.
> Decide which it is and show the evidence: (a) a product bug in the AUT, (b) a bad test or locator,
> (c) test-data or parallelism interference, (d) infrastructure (Kafka/DB/AUT not healthy; check
> `docker compose -f docker/docker-compose.yml logs`).
> For (b) and (c) propose the smallest fix and apply it. For (a) do not change the test to hide it: write up the bug.
> Never fix a failure by adding sleeps or loosening assertions.
