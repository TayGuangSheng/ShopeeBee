import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config/env.js";

export function sqlitePathFromDatabaseUrl(databaseUrl: string): string | undefined {
  if (!databaseUrl.startsWith("file:")) {
    return undefined;
  }

  const withoutPrefix = databaseUrl.slice("file:".length);
  const [filePath] = withoutPrefix.split("?");

  if (!filePath || filePath === ":memory:") {
    return undefined;
  }

  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.resolve("prisma", filePath);
}

export async function ensureRuntimeDirectories(config: AppConfig): Promise<void> {
  const databaseFile = sqlitePathFromDatabaseUrl(config.databaseUrl);
  const directories = [databaseFile ? path.dirname(databaseFile) : undefined].filter(
    (entry): entry is string => Boolean(entry) && entry !== "."
  );

  await Promise.all(
    directories.map((directory) => mkdir(path.resolve(directory), { recursive: true }))
  );
}
