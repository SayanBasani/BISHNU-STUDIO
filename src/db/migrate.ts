import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db, isPostgres } from "./index";
import path from "path";
import { execSync } from "child_process";

async function runMigrations() {
  console.log(`[Database Migration] Running migrations (Active engine: ${isPostgres ? "Neon PostgreSQL" : "SQLite/LibSQL"})...`);

  try {
    if (isPostgres) {
      console.log(`[Database Migration] Applying PostgreSQL migrations via Drizzle Kit...`);
      execSync("npx drizzle-kit migrate", { stdio: "inherit", cwd: process.cwd() });
      console.log("[Database Migration] Neon PostgreSQL migrations verified and applied successfully.");
    } else {
      const { migrate } = await import("drizzle-orm/libsql/migrator");
      const migrationsFolder = path.resolve(process.cwd(), "src/db/migrations");
      console.log(`[Database Migration] Applying SQLite migrations from: ${migrationsFolder}`);
      await migrate(db as any, { migrationsFolder });
      console.log("[Database Migration] SQLite database migrations applied successfully.");
    }
  } catch (error: any) {
    console.error("[Database Migration] Migration failed:", error?.message || error);
    process.exit(1);
  }
}

runMigrations();
