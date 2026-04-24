# Amazon Price Drop Monitor

Draft README for a TypeScript take-home project that monitors configured Amazon product URLs for price drops.

The default implementation is intentionally fixture-backed. It reads local Amazon-like HTML fixtures instead of scraping live Amazon pages, so the project can demonstrate the monitoring workflow without violating Amazon's terms of service. The fetching/parsing boundary is isolated behind a `PriceSource` abstraction so a compliant product data API or licensed third-party provider could be added later.

## Planned Features

- Monitor multiple configured product URLs.
- Run periodic price checks on a configurable interval.
- Store every price check in SQLite so history survives restarts.
- Detect meaningful price drops using configurable thresholds.
- Send console notifications first, because they are easy for reviewers to verify locally.
- Serve a simple Fastify dashboard/history view.
- Log price checks, notification events, and failures with enough context to debug issues.
- Keep failures isolated so one bad product check does not stop the monitor.
- Include focused tests for configuration, price parsing/source behavior, storage, comparison, notification, and web/API behavior as those layers are built.

## Stack

- TypeScript
- Node.js
- tsx for local development
- Vitest for tests
- Fastify for the web UI/API
- better-sqlite3 for durable local storage
- Cheerio for parsing fixture HTML
- Zod and yaml for configuration
- Pino for structured logging
- p-limit for bounded concurrent checks

## Project Structure

```text
src/
  cli/           CLI entry points
  config/        configuration loading and validation
  logging/       logger setup
  monitor/       scheduling and check orchestration
  notification/  notification providers
  price-source/  fixture-backed price source and parser boundary
  storage/       SQLite schema and repositories
  types/         shared TypeScript types
  web/           Fastify dashboard/history routes
test/            focused tests
fixtures/        local Amazon-like HTML fixtures
data/            local SQLite database files
```

## Setup

Install dependencies:

```bash
npm install
```

Copy the example config before running once configuration loading is implemented:

```bash
cp config.example.yaml config.yaml
```

## Planned Commands

These scripts are scaffolded now and will be wired up as the implementation is completed:

```bash
npm run dev
npm run check:once
npm run db:init
npm run test
npm run build
```

## Compliance Note

This project does not implement live Amazon scraping. The default price source uses local fixture files that resemble product pages for demonstration and testing. A production version would use a compliant data provider behind the same `PriceSource` interface.

## Status

This repository is being built in small, commit-sized steps. The current docs are drafts and will be finalized after the core application flow is implemented and verified end to end.
