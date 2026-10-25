import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { neon } from "@neondatabase/serverless";
import { createClient as createLibsqlClient } from "@libsql/client";
import { sql } from "drizzle-orm";

function maskUrl(url?: string): string {
  if (!url) return "[NOT CONFIGURED]";
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username}:****@${parsed.host}${parsed.pathname}`;
  } catch {
    return "[MALFORMED_URL]";
  }
}

async function checkDatabase() {
  console.log("===============================================================================");
  console.log("       BISHNU STUDIO — DATABASE CONNECTIVITY & HEALTH CHECK                    ");
  console.log("===============================================================================");

  const dbUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  const isPostgres = dbUrl?.startsWith("postgres://") || dbUrl?.startsWith("postgresql://");
  const isSqlite = dbUrl?.startsWith("file:") || !dbUrl;

  console.log(`DATABASE_URL Configured : ${Boolean(dbUrl)} [${maskUrl(dbUrl)}]`);
  console.log(`DIRECT_URL Configured   : ${Boolean(directUrl)} [${maskUrl(directUrl)}]`);
  console.log(`Active Provider         : ${isPostgres ? "Neon PostgreSQL (Cloud Serverless)" : "SQLite / LibSQL (Local Embedded)"}`);
  console.log("-------------------------------------------------------------------------------");

  if (!dbUrl && !isSqlite) {
    console.error("[✕] ERROR: DATABASE_URL environment variable is missing.");
    console.error("    Please configure DATABASE_URL in .env.local.");
    process.exit(1);
  }

  // 1. PostgreSQL Connectivity Check
  if (isPostgres) {
    console.log("Initiating bounded ping test against Neon PostgreSQL (Timeout: 5000ms)...");
    const startTime = Date.now();

    try {
      // Enforce 5-second timeout promise race
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timed out after 5000ms.")), 5000)
      );

      const client = neon(dbUrl!);
      const pingPromise = client`SELECT 1 as ping`;

      await Promise.race([pingPromise, timeoutPromise]);
      const latencyMs = Date.now() - startTime;

      console.log(`[✓] SUCCESS: Connected to Neon PostgreSQL! Ping latency: ${latencyMs} ms`);

      // Inspect tables in public schema
      const tables = await client`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `;

      console.log(`[i] Schema Status: ${tables.length} tables present in 'public' schema.`);
      if (tables.length === 0) {
        console.log("    Notice: Database is currently EMPTY. Run 'npm run db:migrate' to create schema.");
      } else {
        console.log(`    Tables: ${tables.map((t: any) => t.table_name).join(", ")}`);
      }

      console.log("===============================================================================");
      console.log("Database connectivity check PASSED.");
      process.exit(0);
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      console.error(`[✕] FAILED: Could not connect to Neon PostgreSQL (${latencyMs} ms).`);
      console.error(`    Reason: ${err.message || "Unknown error"}`);
      console.error("    Check your network connection, SSL settings (?sslmode=require), and credentials.");
      console.log("===============================================================================");
      process.exit(1);
    }
  }

  // 2. Local SQLite Connectivity Check
  const effectiveSqliteUrl = dbUrl || "file:./data/bishnu.db";
  console.log(`Testing local SQLite database: ${effectiveSqliteUrl}...`);
  try {
    const client = createLibsqlClient({ url: effectiveSqliteUrl });
    const startTime = Date.now();
    await client.execute("SELECT 1 as ping;");
    const latencyMs = Date.now() - startTime;

    console.log(`[✓] SUCCESS: Connected to local SQLite file! Ping latency: ${latencyMs} ms`);
    console.log("===============================================================================");
    console.log("Database connectivity check PASSED (Local SQLite).");
    process.exit(0);
  } catch (err: any) {
    console.error(`[✕] FAILED: Could not read local SQLite database: ${err.message}`);
    console.log("===============================================================================");
    process.exit(1);
  }
}

checkDatabase().catch((err) => {
  console.error("Unexpected error during database check:", err.message);
  process.exit(1);
});
