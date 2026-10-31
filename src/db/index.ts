import { sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { getDatabaseProviderManager, MaintenanceModeError } from "../lib/db-provider";
import * as schema from "./schema";

// Ensure local environment files (.env.local, .env) are loaded in non-Next CLI/test contexts
if (!process.env.DATABASE_URL && typeof window === "undefined") {
  try {
    const { loadEnvConfig } = require("@next/env");
    loadEnvConfig(process.cwd());
  } catch (e) {
    // Ignore if @next/env is unavailable
  }
}

const manager = getDatabaseProviderManager();

// Dynamic proxy delegating all query builder calls to the active provider
const dbProxy = new Proxy({} as any, {
  get(_target, prop, receiver) {
    const activeDb = manager.getActiveDb();
    const value = Reflect.get(activeDb, prop, receiver);
    if (typeof value === "function") {
      return function (...args: any[]) {
        // Enforce maintenance mode write-blocking
        if (prop === "insert" || prop === "update" || prop === "delete") {
          manager.assertWritableDatabase();
        }
        return value.apply(activeDb, args);
      };
    }
    return value;
  },
});

export const db = dbProxy as LibSQLDatabase<typeof schema>;
export { schema };

// Compatibility with existing code checking isPostgres
const dbUrl = process.env.DATABASE_URL || "";
export const isPostgres = dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");

export function getIsPostgres(): boolean {
  return manager.isCurrentProviderPostgres();
}

/**
 * Health check & readiness function for the active database.
 * Confirms connectivity with a lightweight ping query without revealing secrets or credentials.
 */
export async function checkDatabaseReadiness(): Promise<{
  ok: boolean;
  provider: "neon-postgres" | "local-sqlite";
  latencyMs: number;
  error?: string;
}> {
  const isPg = manager.isCurrentProviderPostgres();
  const health = isPg
    ? await manager.checkPrimaryHealth(true)
    : await manager.checkFallbackHealth(true);

  return {
    ok: health.status === "healthy",
    provider: isPg ? "neon-postgres" : "local-sqlite",
    latencyMs: health.latencyMs,
    error: health.error,
  };
}
