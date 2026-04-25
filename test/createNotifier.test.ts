import { describe, expect, it } from "vitest";

import { ConsoleNotifier } from "../src/notification/ConsoleNotifier.js";
import { FileNotifier } from "../src/notification/FileNotifier.js";
import { createNotifier } from "../src/notification/createNotifier.js";

describe("createNotifier", () => {
  it("creates a console notifier", () => {
    expect(createNotifier({ type: "console" })).toBeInstanceOf(ConsoleNotifier);
  });

  it("creates a file notifier", () => {
    expect(createNotifier({ type: "file", filePath: "data/test-notifications.log" })).toBeInstanceOf(
      FileNotifier,
    );
  });
});
