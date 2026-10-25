import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.pg.ts",
  out: "./src/db/migrations-pg",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
