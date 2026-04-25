# Amazon Price Drop Monitor

A TypeScript take-home project that monitors a configured set of Amazon product URLs for price drops. The app is designed around a compliant default workflow: it parses local Amazon-like HTML fixtures, stores durable price history in SQLite, detects meaningful price drops, writes console notifications, and exposes a simple Fastify dashboard.

The goal is not to provide production Amazon scraping. The goal is to show clean boundaries, configuration, persistence, scheduling, logging, failure handling, tests, and a reviewer-friendly way to verify the flow end to end.

## Legal And Ethical Note

This project does not scrape live Amazon pages by default. Live Amazon scraping can violate Amazon's terms of service and is intentionally avoided here.

Configured products include Amazon-style URLs because that is the project domain, but the default `PriceSource` reads local fixture HTML files. The product URLs are stored as product identifiers and shown in notifications/dashboard output; the app does not fetch those URLs.

I also avoided making the default workflow depend on a paid, trial-limited, or approval-gated product API. That would make the reviewer sign up for an external service, manage API keys, and potentially burn quota just to verify the take-home. A production version should replace the fixture provider with an approved API or licensed third-party data provider behind the same `PriceSource` interface.

## Tech Stack

- TypeScript and Node.js
- `tsx` for local execution
- Vitest for tests
- Fastify for the dashboard and JSON API
- SQLite via `better-sqlite3`
- Cheerio for fixture HTML parsing
- Zod and `yaml` for validated configuration
- Pino for structured logs
- `p-limit` for bounded concurrent checks

## Project Structure

```text
src/
  cli/           CLI entry points
  config/        YAML loading and Zod validation
  logging/       Pino logger setup
  monitor/       price-drop detection, monitor workflow, scheduler
  notification/  notifier interface and console notifier
  price-source/  PriceSource interface and fixture HTML provider
  storage/       SQLite migrations and repository
  types/         shared domain/config types
  web/           Fastify dashboard and history API
test/            focused unit and integration-style tests
fixtures/        local Amazon-like HTML fixtures
data/            local runtime data, ignored by git
```

## Install

Requires Node.js 20 or newer.

```bash
npm install
```

## Configure

The app reads `config.example.yaml` by default. To make local changes without editing the example:

```bash
cp config.example.yaml config.yaml
```

Configurable values include:

- SQLite database path
- price source type, currently `fixture-html`
- scheduler interval, startup behavior, and max concurrency
- price-drop thresholds
- notification type, `console` or `file`
- dashboard port
- product list

Adding or removing products is a config change. Each product has an `id`, `name`, Amazon-style `url`, and local `fixturePath`.

For the default fixture-backed provider, adding a product also means adding a local HTML fixture file and pointing `fixturePath` at it. That fixture is sample input data for the compliant demo provider, not application code. Product IDs must be unique, and at least 3 products must be configured.

To use your copied config, pass it after `--`:

```bash
npm run check:once -- config.yaml
npm run dev -- config.yaml
npm run db:init -- config.yaml
```

## Initialize The Database

```bash
npm run db:init
```

This creates or updates the SQLite schema at the configured `database.path`. By default that is:

```text
data/price-history.sqlite
```

SQLite runtime files under `data/` are ignored by git.

## Run Tests

```bash
npm test
```

Type-check the project:

```bash
npm run build
```

## Notification Methods

Two zero-setup notification methods are available:

```yaml
notification:
  type: console
```

or:

```yaml
notification:
  type: file
  filePath: data/notifications.log
```

`console` prints the notification during the check. `file` appends the same readable notification to the configured local file.

## Run One Check

```bash
npm run check:once
```

This loads config, initializes the database schema, checks all configured products once, records each price check, detects drops against the previous successful check, sends console notifications when needed, logs structured events, and exits.

## Run The Scheduler And Dashboard

```bash
npm run dev
```

This starts:

- the in-process scheduler
- the Fastify dashboard

By default the scheduler runs once at startup and then every `scheduler.intervalSeconds`.

Open the dashboard at:

```text
http://127.0.0.1:3000
```

Stop the app with `Ctrl+C`. The app handles shutdown by stopping the scheduler, closing the web server, and closing SQLite.

## Simulate A Price Drop

The deterministic demo flow uses a local fixture override. No external services or API keys are required.

From a clean baseline:

```bash
npm run demo:reset
npm run check:once
npm run demo:drop
npm run check:once
```

What happens:

1. `npm run demo:reset` removes any prior local fixture override.
2. The first check records the baseline keyboard price from `fixtures/keyboard.html`.
3. `npm run demo:drop` writes `data/demo-fixture-state.json`, overriding the keyboard product to use `fixtures/demo/keyboard-drop.html`.
4. The second check reads the lower keyboard fixture and emits a console notification.

The demo command defaults to the keyboard product:

```bash
npm run demo:drop
```

Equivalent explicit form:

```bash
npm run demo:drop -- keyboard
```

To reset the demo state, use:

```bash
npm run demo:reset
```

This removes the generated local fixture override. Then run `npm run check:once` again to record fixture prices from the default config. Existing SQLite history remains unless you delete or reinitialize the local database.

## View Price History

Dashboard:

```text
http://127.0.0.1:3000
```

Product history page:

```text
http://127.0.0.1:3000/products/example-1/history
```

JSON API:

```text
http://127.0.0.1:3000/api/products/example-1/history
```

## End-To-End Verification Path

For the clearest reviewer flow:

```bash
npm install
npm run db:init
npm run demo:reset
npm run check:once
npm run demo:drop
npm run check:once
npm run dev
```

Verify:

- The second `check:once` prints a console notification for the keyboard price drop.
- Structured logs include price check and notification events.
- `data/price-history.sqlite` contains durable history.
- The dashboard at `http://127.0.0.1:3000` shows configured products and latest status.
- The keyboard history page shows multiple checks over time.
- The JSON API returns recorded price history.

## Known Limitations

- The default implementation does not scrape live Amazon pages.
- Only the fixture-backed `PriceSource` is implemented; no compliant live product-data provider is wired in.
- Notification methods are intentionally simple: console output or local file append.
- The scheduler is in-process, so it is not suitable for multi-instance deployments.
- There is no authentication on the local dashboard.
- Duplicate notification prevention across multiple running processes is not implemented.
- The HTML dashboard is intentionally simple and server-rendered.
- SQLite is appropriate for this local take-home scope, but it is not the storage choice I would assume for a larger distributed system.

## Future Work

I intentionally stopped at the core requirements rather than adding partial stretch goals. Given more time, the next additions I would consider are:

- Compliant live price source: add an API-backed `PriceSource` with credentials loaded from environment variables, source-specific rate limits, caching, retries, and clear provider terms review.
- Concurrency correctness across workers: add idempotency keys and database constraints so two app instances cannot send duplicate notifications for the same product/drop event.
- Deployability: add Docker Compose for the app and persistent SQLite volume, plus a CI workflow that runs tests and type-checking.
- Live-updating dashboard: stream monitor results to the browser with Server-Sent Events or WebSockets after the basic dashboard/API contract is stable.
