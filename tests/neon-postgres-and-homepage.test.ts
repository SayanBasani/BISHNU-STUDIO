import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { checkDatabaseReadiness, isPostgres, db } from "../src/db";
import * as pgSchema from "../src/db/schema.pg";
import { GET as getDbHealth } from "../src/app/api/health/db/route";

describe("Bishnu Studio — Neon PostgreSQL Integration & Homepage Redesign", () => {
  // =========================================================================
  // 1. Database Connection & Readiness Check
  // =========================================================================
  describe("1. Database Readiness & Health API", () => {
    it("should perform a successful ping check without exposing credentials", async () => {
      const readiness = await checkDatabaseReadiness();
      expect(readiness).toBeDefined();
      expect(readiness.ok).toBe(true);
      expect(readiness.provider).toMatch(/neon-postgres|local-sqlite/);
      expect(typeof readiness.latencyMs).toBe("number");
      expect((readiness as any).password).toBeUndefined();
      expect((readiness as any).url).toBeUndefined();
    });

    it("should respond from the /api/health/db endpoint with status 200", async () => {
      const res = await getDbHealth();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("healthy");
      expect(data.provider).toMatch(/neon-postgres|local-sqlite/);
      expect(typeof data.latencyMs).toBe("number");
      expect(data.timestamp).toBeDefined();
    });
  });

  // =========================================================================
  // 2. PostgreSQL Schema & DDL Migration Files
  // =========================================================================
  describe("2. PostgreSQL Schema & DDL Migration Generation", () => {
    it("should have all 23 application tables defined in PostgreSQL schema", () => {
      expect(pgSchema.users).toBeDefined();
      expect(pgSchema.userAddresses).toBeDefined();
      expect(pgSchema.sessions).toBeDefined();
      expect(pgSchema.verificationTokens).toBeDefined();
      expect(pgSchema.productCategories).toBeDefined();
      expect(pgSchema.products).toBeDefined();
      expect(pgSchema.productImages).toBeDefined();
      expect(pgSchema.services).toBeDefined();
      expect(pgSchema.serviceOptions).toBeDefined();
      expect(pgSchema.servicePrices).toBeDefined();
      expect(pgSchema.orders).toBeDefined();
      expect(pgSchema.orderItems).toBeDefined();
      expect(pgSchema.orderFiles).toBeDefined();
      expect(pgSchema.payments).toBeDefined();
      expect(pgSchema.auditLogs).toBeDefined();
      expect(pgSchema.authenticationEvents).toBeDefined();
      expect(pgSchema.shopSettings).toBeDefined();
      expect(pgSchema.paymentSubmissions).toBeDefined();
      expect(pgSchema.orderStatusHistory).toBeDefined();
      expect(pgSchema.accountAppeals).toBeDefined();
      expect(pgSchema.productReviews).toBeDefined();
      expect(pgSchema.shopUpiAccounts).toBeDefined();
      expect(pgSchema.developerProfile).toBeDefined();
    });

    it("should have generated PostgreSQL migration SQL file with standard DDL", () => {
      const migrationsDir = path.resolve(process.cwd(), "src/db/migrations-pg");
      expect(fs.existsSync(migrationsDir)).toBe(true);

      const files = fs.readdirSync(migrationsDir);
      const sqlFiles = files.filter((f) => f.endsWith(".sql"));
      expect(sqlFiles.length).toBeGreaterThan(0);

      const sqlContent = fs.readFileSync(path.join(migrationsDir, sqlFiles[0]), "utf8");
      expect(sqlContent).toContain('CREATE TABLE "users"');
      expect(sqlContent).toContain('CREATE TABLE "orders"');
      expect(sqlContent).toContain('CREATE TABLE "payments"');
      expect(sqlContent).toContain('CREATE TABLE "shop_upi_accounts"');
      expect(sqlContent).toContain('CREATE TABLE "developer_profile"');
      expect(sqlContent).toContain('double precision');
      expect(sqlContent).toContain('bigint');
    });

    it("should have configured drizzle.config.ts with postgresql dialect", () => {
      const configPath = path.resolve(process.cwd(), "drizzle.config.ts");
      expect(fs.existsSync(configPath)).toBe(true);
      const configContent = fs.readFileSync(configPath, "utf8");
      expect(configContent).toContain('dialect: "postgresql"');
      expect(configContent).toContain("migrations-pg");
      expect(configContent).toContain("schema.pg.ts");
    });
  });

  // =========================================================================
  // 3. SQLite to Neon Data Migration Tooling
  // =========================================================================
  describe("3. SQLite to Neon Data Migration Tool", () => {
    const migratorPath = path.resolve(process.cwd(), "scripts/migrate-sqlite-to-neon.ts");

    it("should have the migration tool script in place", () => {
      expect(fs.existsSync(migratorPath)).toBe(true);
      const scriptContent = fs.readFileSync(migratorPath, "utf8");
      expect(scriptContent).toContain("TABLE_DEPENDENCY_ORDER");
      expect(scriptContent).toContain("isDryRun");
      expect(scriptContent).toContain("onConflictDoNothing");
      expect(scriptContent).toContain("maskUrl");
    });

    it("should protect passwords and connection secrets from being logged", () => {
      const scriptContent = fs.readFileSync(migratorPath, "utf8");
      expect(scriptContent).toContain("maskUrl");
      expect(scriptContent).not.toContain("console.log(process.env.DATABASE_URL)");
    });
  });

  // =========================================================================
  // 4. Redesigned Editorial Commerce Homepage
  // =========================================================================
  describe("4. Redesigned Editorial Commerce Homepage", () => {
    const homePagePath = path.resolve(process.cwd(), "src/app/page.tsx");

    it("should exist and contain editorial layout components", () => {
      expect(fs.existsSync(homePagePath)).toBe(true);
      const content = fs.readFileSync(homePagePath, "utf8");
      expect(content).toContain("HomePage");
      expect(content).toContain("Specialized Print Services");
      expect(content).toContain("Featured Stationery Supplies");
      expect(content).toMatch(/The (\{effectiveShopName\}|Bishnu Studio) Standard/);
      expect(content).toContain("Track Your Print Job or Order Status");
    });

    it("should link to all four actual supported printing services with working routes", () => {
      const content = fs.readFileSync(homePagePath, "utf8");
      expect(content).toContain("/services/pvc-card");
      expect(content).toContain("/services/document-printing");
      expect(content).toContain("/services/photo-printing");
      expect(content).toContain("/services/lamination");
    });

    it("should integrate database service starting rates dynamically", () => {
      const content = fs.readFileSync(homePagePath, "utf8");
      expect(content).toContain("servicePrices");
      expect(content).toContain("serviceRatesMap");
    });

    it("should not contain fake testimonials, fake review counts, or fabricated claims", () => {
      const content = fs.readFileSync(homePagePath, "utf8");
      expect(content).not.toContain("10,000+ Happy Customers");
      expect(content).not.toContain("5-Star Rated by 5000+ Users");
      expect(content).not.toContain("testimonial");
    });
  });
});
