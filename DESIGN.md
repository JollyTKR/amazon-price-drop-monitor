# Design Notes

Draft design document for the Amazon price drop monitor take-home project.

## Goal

Build a small local application that monitors a configured set of Amazon product URLs, records price checks over time, detects price drops, and makes those drops visible to a reviewer.

The application should demonstrate configuration, scheduling, storage, comparison, notification, logging, failure handling, and tests without depending on live Amazon scraping.

## Language Choice

I am using TypeScript because it is my strongest language. For a time-boxed take-home project, that lets me spend more effort on design, correctness, tests, and documentation instead of fighting the language or tooling.

TypeScript also works well for this project because the app has several boundaries where explicit types help: parsed config, product definitions, price source results, database rows, comparison decisions, notification payloads, and web responses.

## Compliance Approach

The project accepts configured Amazon product URLs, but the default implementation will not fetch live Amazon pages. Instead, it will map configured products to local Amazon-like HTML fixtures and parse those fixtures.

That keeps the project reviewer-friendly while respecting the brief's legal and ethical constraint. The code should make this boundary explicit so it is clear where a compliant production data source would be added.

## Architecture

The app is organized around separate layers:

- `config`: load and validate YAML configuration with Zod.
- `price-source`: define a `PriceSource` interface and implement a fixture-backed provider.
- `storage`: initialize SQLite schema and persist price check history.
- `monitor`: coordinate scheduled checks across configured products.
- `notification`: send price-drop notifications, starting with console output.
- `logging`: provide structured logging with Pino.
- `web`: serve a simple Fastify dashboard/history view.
- `cli`: expose local commands such as one-time checks, database initialization, and development server startup.

The intended check flow is:

1. Load validated configuration.
2. For each configured product, ask the `PriceSource` for the current price.
3. Read the most recent stored price for that product.
4. Compare the previous and current prices using configured threshold rules.
5. Persist the new price check regardless of whether there is a drop.
6. Send a notification if the comparison detects a meaningful drop.
7. Log successful checks, failures, and notification outcomes.

## Price Source Boundary

`PriceSource` is the key compliance and extensibility boundary. The monitor should not know whether prices came from a local fixture, an approved API, or another licensed provider.

The first implementation will be fixture-backed. A future implementation could add a provider that calls a compliant product data API while keeping the monitor, storage, comparison, notification, and web layers mostly unchanged.

## Storage

SQLite is the initial storage choice because it is durable, local, easy for reviewers to run, and sufficient for a small set of products. `better-sqlite3` keeps the implementation simple and avoids requiring a separate database server.

The storage layer should persist every check, including enough metadata to distinguish successful checks from failures when appropriate. The final schema will be documented once implemented.

At larger scale, I would revisit this choice and consider Postgres, a queue-backed worker model, and stronger idempotency guarantees around checks and notifications.

## Scheduling

The app will use a configurable interval for periodic checks. The first version can use an in-process scheduler because the project is intended to run locally and be easy to inspect.

This is simpler than introducing a job queue or external scheduler for a small take-home project. The tradeoff is that in-process scheduling is not ideal for multi-instance deployments or strict exactly-once behavior.

## Notification Strategy

Console notification is the first notification method because it is easy for a reviewer to verify without credentials, accounts, webhooks, or paid services.

The notification layer should still use an interface so another provider, such as email, Slack, or SMS, can be added later without changing comparison or monitoring logic.

## Web View

Fastify will serve a simple dashboard/history view showing product price history over time. The goal is usability and transparency, not visual polish.

The web layer should read from storage and avoid owning monitoring logic.

## Failure Handling

The monitor should treat each product check independently. A fixture parse failure, missing product, storage error, or notification failure should be logged with useful context and should not crash the entire run unless startup configuration is invalid.

The first implementation will focus on understandable behavior over complex retry machinery. Retries and dead-letter handling are better treated as later production hardening.

## Testing Strategy

The project should include at least one meaningful test per important layer as implementation is added:

- Config validation catches invalid product and threshold settings.
- Price parsing catches fixture markup changes.
- Storage persists and reads price history.
- Comparison logic detects meaningful drops and ignores insignificant changes.
- Notification provider emits the expected payload.
- Web/API route returns history in a reviewer-friendly format.

## Known Tradeoffs To Document Later

- SQLite versus Postgres or another server database.
- In-process scheduling versus an external scheduler or job queue.
- Console notification versus email, Slack, SMS, or desktop notifications.
- Fixture-backed HTML parsing versus a compliant paid API provider.
- How much failure metadata to store for failed checks.
- How to prevent duplicate notifications if multiple workers run concurrently.
- How much dashboard polish is worth adding inside the time box.
