import { ConsoleNotifier } from "./ConsoleNotifier.js";
import { FileNotifier } from "./FileNotifier.js";
import type { Notifier } from "./Notifier.js";
import type { NotificationConfig } from "../types/domain.js";

export function createNotifier(config: NotificationConfig): Notifier {
  switch (config.type) {
    case "console":
      return new ConsoleNotifier();
    case "file":
      return new FileNotifier(config.filePath ?? "data/notifications.log");
  }
}
