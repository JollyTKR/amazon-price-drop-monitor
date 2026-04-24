import { readFile } from "node:fs/promises";

import { parse as parseYaml } from "yaml";
import { ZodError } from "zod";

import { appConfigSchema } from "./config.schema.js";
import type { AppConfig } from "../types/domain.js";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export async function loadConfig(configPath = "config.example.yaml"): Promise<AppConfig> {
  let fileContents: string;

  try {
    fileContents = await readFile(configPath, "utf8");
  } catch (error) {
    throw new ConfigError(`Unable to read config file at ${configPath}: ${getErrorMessage(error)}`);
  }

  let parsedYaml: unknown;

  try {
    parsedYaml = parseYaml(fileContents);
  } catch (error) {
    throw new ConfigError(`Invalid YAML in ${configPath}: ${getErrorMessage(error)}`);
  }

  const result = appConfigSchema.safeParse(parsedYaml);

  if (!result.success) {
    throw new ConfigError(`Invalid config in ${configPath}:\n${formatZodError(result.error)}`);
  }

  return result.data;
}

export function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "config";
      return `- ${path}: ${issue.message}`;
    })
    .join("\n");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
