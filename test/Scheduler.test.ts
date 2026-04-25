import type { Logger } from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Scheduler } from "../src/monitor/Scheduler.js";

describe("Scheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs immediately when runOnStartup is true", async () => {
    vi.useFakeTimers();
    const runOnce = vi.fn().mockResolvedValue(undefined);
    const scheduler = new Scheduler({
      monitor: { runOnce },
      intervalSeconds: 60,
      runOnStartup: true,
      logger: createTestLogger(),
    });

    scheduler.start();
    await vi.runAllTicks();

    expect(runOnce).toHaveBeenCalledTimes(1);

    await scheduler.stop();
  });

  it("runs on the configured interval", async () => {
    vi.useFakeTimers();
    const runOnce = vi.fn().mockResolvedValue(undefined);
    const scheduler = new Scheduler({
      monitor: { runOnce },
      intervalSeconds: 5,
      runOnStartup: false,
      logger: createTestLogger(),
    });

    scheduler.start();

    expect(runOnce).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5_000);

    expect(runOnce).toHaveBeenCalledTimes(1);

    await scheduler.stop();
  });

  it("skips ticks while a previous run is still active", async () => {
    vi.useFakeTimers();
    let resolveRun: (() => void) | undefined;
    const runOnce = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        }),
    );
    const logger = createTestLogger();
    const scheduler = new Scheduler({
      monitor: { runOnce },
      intervalSeconds: 1,
      runOnStartup: true,
      logger,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "scheduler_tick_skipped",
        reason: "previous_run_still_active",
      }),
      "Scheduler tick skipped because previous run is still active",
    );

    resolveRun?.();
    await scheduler.stop();
  });
});

function createTestLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger;
}
