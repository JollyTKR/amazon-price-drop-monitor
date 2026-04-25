# Design

This project is a local TypeScript price drop monitor for a small configured set of Amazon product URLs. It demonstrates the core workflow without live Amazon scraping: load validated YAML config, fetch a price from a `PriceSource`, persist every check in SQLite, compare against the latest successful check, notify on meaningful drops, log structured events, and show history in a simple Fastify dashboard.

## Architecture Overview

The app is split into small layers:

- `config`: loads YAML and validates it with Zod.
- `price-source`: owns the `PriceSource` interface and the fixture-backed HTML implementation.
- `storage`: owns SQLite migrations and repository methods.
- `monitor`: coordinates checks, bounded concurrency, failure isolation, and pure price-drop detection.
- `notification`: owns the notifier interface and console notifier.
- `web`: serves dashboard/history pages and a JSON history API.
- `logging`: creates the Pino logger.
- `cli` and `app.ts`: wire the application together.

The monitor checks all configured products with `p-limit`, uses `Promise.allSettled`, records failed checks where possible, and keeps one product failure from stopping the rest of the run.

## PriceSource Abstraction

`PriceSource` exposes `getCurrentPrice(product)`. The monitor does not know whether the price came from local HTML, an approved product API, or another licensed provider.

The default implementation is `FixtureHtmlPriceSource`, which reads Amazon-like local fixtures and parses realistic selectors such as `.a-price .a-offscreen`, `#priceblock_ourprice`, and `#priceblock_dealprice`. Missing or malformed prices return controlled failure results instead of throwing through the app. This is intentional because live Amazon scraping is not implemented.

With this default provider, changing the monitored product set is still configuration-driven: a reviewer can add or remove products in YAML, and new products point at new local fixture files. Those fixture files are treated as demo input data. Config validation requires at least 3 products and unique product IDs so history does not collide.

The fixture-backed source is a scope decision, not a claim that fixture data is equivalent to live Amazon data. Live scraping would be legally risky, and requiring an external API would make local review depend on credentials, third-party account setup, and quota. The implemented boundary keeps price acquisition replaceable while making the core monitor workflow fully runnable with no secrets.

## Storage Schema

SQLite stores two tables:

- `price_checks`: one row per check, including product id/name/url, checked timestamp, nullable price/currency, status, error message, and source.
- `notifications`: one row per notification attempt, including product id/name, previous/current prices, drop amount, drop percent, sent timestamp, status, and error message.

Every successful check is persisted, and expected product-level failures are also persisted as failed `price_checks` when possible. This makes the dashboard and logs useful for debugging.

## Scheduling Approach

The scheduler is in-process and uses `setInterval`. It supports a configurable interval, optional startup run, and overlap prevention. If a run is still active when the next tick arrives, the scheduler logs `scheduler_tick_skipped` and does not start another run.

This keeps the project easy to run locally. It is not intended to provide distributed scheduling or exactly-once semantics.

## Notification Approach

The app supports two zero-setup notifiers: `ConsoleNotifier` and `FileNotifier`. Both produce a readable notification with product name, previous price, current price, drop amount, and drop percent. Console output is the default because it is easiest to see while running `check:once`; file output is available when a reviewer wants a durable local notification artifact without external services.

Notification results are recorded in SQLite. A thrown notification error is converted into a failed notification result so the monitor can continue.

## Tradeoffs

Fixture-backed HTML vs live Amazon scraping/API provider: I chose local fixtures to respect the brief's legal and ethical constraints while still showing parsing, failure handling, and price-drop behavior. I did not make the default path depend on a paid, trial-limited, or approval-gated API because that would make review harder and less deterministic. The tradeoff is that this does not prove robustness against live Amazon page changes or a real provider's rate limits. A production version should add a compliant API-backed `PriceSource`.

SQLite vs Postgres: SQLite keeps setup simple and durable for a local review. There is no separate database service, and the schema is easy to inspect. At higher scale, I would move to Postgres for concurrent writers, operational tooling, richer query patterns, and stronger multi-process behavior.

Console/file/dashboard notification vs email/SMS/Slack: Console and file notifications plus the dashboard are easy to verify locally. They avoid secrets and external dependencies. The tradeoff is that they are not real user delivery channels. Email, SMS, or Slack could be added behind the notifier interface.

In-process scheduler vs external scheduler: `setInterval` is enough for a single local process and keeps the implementation readable. It would not be my choice for multiple workers or production reliability. At larger scale, I would use a job queue or external scheduler with leases/idempotency.

## What Would Change At 10x Scale

At 10x product count or beyond, I would replace SQLite with Postgres, introduce a queue-backed worker model, add per-source rate limiting, add retry/backoff policies, and store stronger idempotency keys for checks and notifications. I would also add a compliant API provider, dashboard pagination, duplicate notification protection across workers, and operational metrics beyond logs.

The current project intentionally favors a small, understandable local implementation over production infrastructure.

## Stretch Goals Deferred

I stopped after the core requirements plus a small JSON history API because broad stretch work would reduce confidence in the reviewer flow. The most useful next stretch goals would be:

- Add a compliant API-backed `PriceSource`, keeping credentials out of git and documenting provider-specific quota behavior.
- Add duplicate-notification protection for multiple workers with database idempotency keys.
- Add Docker Compose and CI once the local commands are stable.
- Add live dashboard updates after the static dashboard/API remains reliable.
