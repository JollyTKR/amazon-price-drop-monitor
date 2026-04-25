import { rm } from "node:fs/promises";

const statePath = "data/demo-fixture-state.json";

try {
  await rm(statePath, { force: true });

  console.log("Demo fixture state reset.");
  console.log("Default configured fixtures will be used on the next check.");
  console.log(`Removed state file if present: ${statePath}`);
} catch (error) {
  console.error(`Unable to reset demo fixture state at ${statePath}: ${getErrorMessage(error)}`);
  process.exit(1);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
