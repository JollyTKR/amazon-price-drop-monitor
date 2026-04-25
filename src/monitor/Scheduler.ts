import type { Logger } from "pino";

export interface RunnableMonitor {
  runOnce(): Promise<unknown>;
}

export interface SchedulerOptions {
  monitor: RunnableMonitor;
  intervalSeconds: number;
  runOnStartup: boolean;
  logger: Logger;
}

export class Scheduler {
  private interval: ReturnType<typeof setInterval> | null = null;
  private currentRun: Promise<void> | null = null;

  constructor(private readonly options: SchedulerOptions) {}

  start(): void {
    if (this.interval !== null) {
      return;
    }

    const intervalMilliseconds = this.options.intervalSeconds * 1000;

    this.options.logger.info(
      {
        event: "scheduler_started",
        interval_seconds: this.options.intervalSeconds,
        run_on_startup: this.options.runOnStartup,
      },
      "Scheduler started",
    );

    if (this.options.runOnStartup) {
      this.tick("startup");
    }

    this.interval = setInterval(() => {
      this.tick("interval");
    }, intervalMilliseconds);
  }

  async stop(): Promise<void> {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (this.currentRun !== null) {
      await this.currentRun;
    }

    this.options.logger.info(
      {
        event: "scheduler_stopped",
      },
      "Scheduler stopped",
    );
  }

  isRunning(): boolean {
    return this.currentRun !== null;
  }

  private tick(trigger: "startup" | "interval"): void {
    if (this.currentRun !== null) {
      this.options.logger.warn(
        {
          event: "scheduler_tick_skipped",
          trigger,
          reason: "previous_run_still_active",
        },
        "Scheduler tick skipped because previous run is still active",
      );
      return;
    }

    const startedAt = new Date().toISOString();

    this.currentRun = this.options.monitor
      .runOnce()
      .then(() => {
        this.options.logger.info(
          {
            event: "scheduler_tick_completed",
            trigger,
            started_at: startedAt,
            completed_at: new Date().toISOString(),
          },
          "Scheduler tick completed",
        );
      })
      .catch((error: unknown) => {
        this.options.logger.error(
          {
            event: "scheduler_tick_failed",
            trigger,
            started_at: startedAt,
            error_message: getErrorMessage(error),
          },
          "Scheduler tick failed",
        );
      })
      .finally(() => {
        this.currentRun = null;
      });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
