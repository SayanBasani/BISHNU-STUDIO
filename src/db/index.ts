import { sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import fs from "fs";
import path from "path";

// Ensure local environment files (.env.local, .env) are loaded in non-Next CLI/test contexts
if (!process.env.DATABASE_URL && typeof window === "undefined") {
  try {
    const { loadEnvConfig } = require("@next/env");
    loadEnvConfig(process.cwd());
  } catch (e) {
    // Ignore if @next/env is unavailable
  }
}

import * as schema from "./schema";

// Verify environment in production
const isProduction = process.env.NODE_ENV === "production";
const isVercel = !!process.env.VERCEL;
const dbUrl = process.env.DATABASE_URL || "file:./data/bishnu.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

export const isPostgres = dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");

if (isProduction && isVercel && dbUrl.startsWith("file:")) {
  throw new Error(
    "CRITICAL CONFIGURATION ERROR: Vercel serverless environment detected with local SQLite file URL. " +
    "A persistent Neon PostgreSQL database URL (e.g. postgresql://... from https://console.neon.tech/) " +
    "must be provided in production to ensure data persistence across serverless invocations."
  );
}

let dbInstance: any;

if (isPostgres) {
  // 1. Neon PostgreSQL Integration (HTTP Driver for Serverless / Next.js)
  const { neon } = require("@neondatabase/serverless");
  const { drizzle: drizzleNeon } = require("drizzle-orm/neon-http");
  
  const rawSql = neon(dbUrl);
  // Bridge compatibility between @neondatabase/serverless v1.x (sql.query) and Drizzle HTTP driver
  const client = (query: string, params: any[], options: any) => rawSql.query(query, params, options);
  dbInstance = drizzleNeon(client, { schema });
} else {
  // 2. Local SQLite / LibSQL Fallback
  const { drizzle: drizzleLibsql } = require("drizzle-orm/libsql");
  const { createClient } = require("@libsql/client");

  // Ensure local directory exists when running file: SQLite
  if (dbUrl.startsWith("file:")) {
    const localPath = dbUrl.replace("file:", "");
    const dir = path.dirname(path.resolve(process.cwd(), localPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const client = createClient({
    url: dbUrl,
    authToken: authToken,
  });

  dbInstance = drizzleLibsql(client, { schema });
}

export const db = dbInstance as LibSQLDatabase<typeof schema>;
export { schema };

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
  const start = Date.now();
  try {
    const pingSql = sql`SELECT 1 as ping`;
    if (isPostgres) {
      await (dbInstance as any).execute(pingSql);
    } else {
      await (dbInstance as any).run(pingSql);
    }
    return {
      ok: true,
      provider: isPostgres ? "neon-postgres" : "local-sqlite",
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      ok: false,
      provider: isPostgres ? "neon-postgres" : "local-sqlite",
      latencyMs: Date.now() - start,
      error: "Database connectivity check failed. Check DATABASE_URL and network configuration.",
    };
  }
}
