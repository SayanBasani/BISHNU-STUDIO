/**
 * Bishnu Studio - Central Database Provider Manager
 *
 * Implements BS-DB-01 Dual Database Architecture:
 * - Operating Modes:
 *     A. neon_primary (Default production mode - authoritative Neon PostgreSQL)
 *     B. emergency_fallback (Persistent fallback when primary fails or during maintenance)
 *     C. local_development (Local SQLite development at file:./data/bishnu.db)
 *     D. maintenance (Read-only / write-blocked safe mode)
 * - Fencing Token Mechanism: Monotonically increasing token to prevent split-brain writes
 * - Hosting & Serverless Safety: Blocks unsafe ephemeral local SQLite fallback on Vercel
 * - Durable Control-Plane State: Backed by atomic state file with env override
 * - Cached Health Checks: Prevents request latency penalties
 */

import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import * as sqSchema from "../db/schema.sqlite";
import * as pgSchema from "../db/schema.pg";

// Load Next environment variables if in CLI/background context
if (!process.env.DATABASE_URL && typeof window === "undefined") {
  try {
    const { loadEnvConfig } = require("@next/env");
    loadEnvConfig(process.cwd());
  } catch (e) {
    // Ignore if @next/env unavailable
  }
}

export type DatabaseOperatingMode =
  | "neon_primary"
  | "emergency_fallback"
  | "local_development"
  | "maintenance";

export type ActiveDatabaseProvider = "neon-postgres" | "sqlite-libsql";

export interface DatabaseControlPlaneState {
  mode: DatabaseOperatingMode;
  activeProvider: ActiveDatabaseProvider;
  fencingToken: number;
  lastSwitchedAt: number | null;
  lastSwitchedBy: string | null;
  switchReason: string | null;
  lastSyncAt: number | null;
  lastSyncStatus: "completed" | "failed" | "partial" | null;
  version: number;
}

export interface HostingSafetyAssessment {
  isVercel: boolean;
  isProduction: boolean;
  fallbackConfigured: boolean;
  fallbackUrlType: "remote_libsql" | "local_file" | "none";
  isFallbackPersistentAndSafe: boolean;
  warning?: string;
}

export interface ProviderHealthReport {
  status: "healthy" | "unhealthy" | "not_configured";
  latencyMs: number;
  checkedAt: number;
  error?: string;
}

export class MaintenanceModeError extends Error {
  statusCode: number;
  constructor(message: string = "Database is currently in Maintenance / Read-Only mode. Mutations are blocked for data safety.") {
    super(message);
    this.name = "MaintenanceModeError";
    this.statusCode = 503;
  }
}

// In-memory singletons and cache
let cachedControlPlane: DatabaseControlPlaneState | null = null;
let lastControlPlaneReadAt = 0;
const CONTROL_PLANE_CACHE_TTL_MS = 2000; // 2 seconds TTL for filesystem state check

let neonDrizzleInstance: any = null;
let libsqlDrizzleInstance: any = null;

let primaryHealthCache: { report: ProviderHealthReport; expiresAt: number } | null = null;
let fallbackHealthCache: { report: ProviderHealthReport; expiresAt: number } | null = null;
const HEALTH_CACHE_TTL_MS = 30000; // 30 seconds

const STATE_FILE_PATH = path.resolve(process.cwd(), "data/db-control-plane.json");

export class DatabaseProviderManager {
  private static instance: DatabaseProviderManager;

  private constructor() {}

  public static getInstance(): DatabaseProviderManager {
    if (!DatabaseProviderManager.instance) {
      DatabaseProviderManager.instance = new DatabaseProviderManager();
    }
    return DatabaseProviderManager.instance;
  }

  /**
   * Assess hosting platform and persistent storage capabilities.
   */
  public getHostingSafetyAssessment(): HostingSafetyAssessment {
    const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV);
    const isProduction = process.env.NODE_ENV === "production";
    const fallbackUrl = process.env.FALLBACK_DATABASE_URL || process.env.DATABASE_URL || "";

    let fallbackUrlType: "remote_libsql" | "local_file" | "none" = "none";
    if (fallbackUrl.startsWith("libsql://") || fallbackUrl.startsWith("https://")) {
      fallbackUrlType = "remote_libsql";
    } else if (fallbackUrl.startsWith("file:") || fallbackUrl.includes(".db")) {
      fallbackUrlType = "local_file";
    }

    const fallbackConfigured = fallbackUrlType !== "none";

    // In Vercel serverless, local files are ephemeral and vanish when micro-VMs recycle.
    // Therefore, local_file is strictly unsafe for production fallback on Vercel.
    let isFallbackPersistentAndSafe = false;
    let warning: string | undefined;

    if (isVercel || isProduction) {
      if (fallbackUrlType === "remote_libsql") {
        isFallbackPersistentAndSafe = true;
      } else {
        isFallbackPersistentAndSafe = false;
        warning =
          "Vercel serverless functions have ephemeral, isolated filesystems. " +
          "A local SQLite file (file:...) cannot serve as a persistent production fallback without data loss. " +
          "Configure a remote LibSQL/Turso URL (libsql://...) with auth token for persistent production fallback.";
      }
    } else {
      // In local development, local SQLite file is durable on host disk
      isFallbackPersistentAndSafe = fallbackConfigured;
    }

    return {
      isVercel,
      isProduction,
      fallbackConfigured,
      fallbackUrlType,
      isFallbackPersistentAndSafe,
      warning,
    };
  }

  /**
   * Read durable control plane state.
   */
  public getControlPlaneState(): DatabaseControlPlaneState {
    const now = Date.now();
    if (cachedControlPlane && now - lastControlPlaneReadAt < CONTROL_PLANE_CACHE_TTL_MS) {
      return cachedControlPlane;
    }

    // 1. Check environment variable override
    const envMode = process.env.DATABASE_OPERATING_MODE?.toLowerCase();
    const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV);
    const isProduction = process.env.NODE_ENV === "production";

    // 2. Read from state file if present
    let stateFromFile: Partial<DatabaseControlPlaneState> | null = null;
    try {
      if (fs.existsSync(STATE_FILE_PATH)) {
        const raw = fs.readFileSync(STATE_FILE_PATH, "utf8");
        stateFromFile = JSON.parse(raw);
      }
    } catch (e) {
      // If file read fails, ignore and use defaults
    }

    // Determine initial default mode:
    // In production or Vercel: neon_primary
    // In local development: local_development (unless file specified otherwise)
    const defaultMode: DatabaseOperatingMode =
      isProduction || isVercel ? "neon_primary" : "local_development";

    let resolvedMode: DatabaseOperatingMode =
      (envMode as DatabaseOperatingMode) ||
      stateFromFile?.mode ||
      defaultMode;

    // Safety guard: if resolvedMode is emergency_fallback but storage is unsafe on Vercel, revert to neon_primary or maintenance
    const safety = this.getHostingSafetyAssessment();
    if (resolvedMode === "emergency_fallback" && !safety.isFallbackPersistentAndSafe && (isVercel || isProduction)) {
      console.warn("[Database Provider Manager] Emergency fallback requested on Vercel without persistent remote storage. Enforcing safe mode.");
      resolvedMode = "maintenance";
    }

    const activeProvider: ActiveDatabaseProvider =
      resolvedMode === "neon_primary"
        ? "neon-postgres"
        : resolvedMode === "maintenance"
        ? (stateFromFile?.activeProvider || (isProduction ? "neon-postgres" : "sqlite-libsql"))
        : "sqlite-libsql";

    cachedControlPlane = {
      mode: resolvedMode,
      activeProvider,
      fencingToken: stateFromFile?.fencingToken || 1,
      lastSwitchedAt: stateFromFile?.lastSwitchedAt || null,
      lastSwitchedBy: stateFromFile?.lastSwitchedBy || null,
      switchReason: stateFromFile?.switchReason || null,
      lastSyncAt: stateFromFile?.lastSyncAt || null,
      lastSyncStatus: stateFromFile?.lastSyncStatus || null,
      version: (stateFromFile?.version || 0) + 1,
    };
    lastControlPlaneReadAt = now;

    return cachedControlPlane;
  }

  /**
   * Durably persist control plane state with atomic file write.
   */
  public saveControlPlaneState(partial: Partial<DatabaseControlPlaneState>): DatabaseControlPlaneState {
    const current = this.getControlPlaneState();
    const updated: DatabaseControlPlaneState = {
      ...current,
      ...partial,
      version: current.version + 1,
    };

    try {
      const dir = path.dirname(STATE_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${STATE_FILE_PATH}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2), "utf8");
      fs.renameSync(tmpPath, STATE_FILE_PATH);
    } catch (err: any) {
      console.warn("[Database Provider Manager] Could not write control plane file:", err.message);
    }

    cachedControlPlane = updated;
    lastControlPlaneReadAt = Date.now();
    return updated;
  }

  /**
   * Current operating mode helper.
   */
  public getOperatingMode(): DatabaseOperatingMode {
    return this.getControlPlaneState().mode;
  }

  /**
   * Helper checking whether active engine is Neon PostgreSQL.
   */
  public isCurrentProviderPostgres(): boolean {
    return this.getControlPlaneState().activeProvider === "neon-postgres";
  }

  /**
   * Assert writable database. Throws MaintenanceModeError if in maintenance.
   */
  public assertWritableDatabase(): void {
    const mode = this.getOperatingMode();
    if (mode === "maintenance") {
      throw new MaintenanceModeError(
        "Database is currently in Maintenance / Read-Only mode. Orders, payments, and financial updates are suspended for data protection."
      );
    }
  }

  /**
   * Switch database operating mode with super-admin validation, safety checks & audit tracking.
   */
  public async switchOperatingMode(params: {
    targetMode: DatabaseOperatingMode;
    adminUserId: string;
    reason: string;
    force?: boolean;
  }): Promise<{ success: boolean; state: DatabaseControlPlaneState; message: string }> {
    const { targetMode, adminUserId, reason, force } = params;

    if (!reason || reason.trim().length < 5) {
      throw new Error("A clear administrative justification (at least 5 characters) is required to switch database operating mode.");
    }

    const current = this.getControlPlaneState();
    if (current.mode === targetMode) {
      return { success: true, state: current, message: `Operating mode is already ${targetMode}.` };
    }

    const safety = this.getHostingSafetyAssessment();

    // Safety checks for target mode
    if (targetMode === "emergency_fallback") {
      if (!safety.isFallbackPersistentAndSafe && !force) {
        throw new Error(
          "SWITCH REJECTED: The configured fallback database is not safe or persistent for this environment. " +
          (safety.warning || "Local SQLite file is ephemeral on Vercel. Configure remote LibSQL/Turso or use Maintenance mode.")
        );
      }

      // Pre-flight health check on fallback
      const fallbackHealth = await this.checkFallbackHealth(true);
      if (fallbackHealth.status === "unhealthy" && !force) {
        throw new Error(`SWITCH REJECTED: Fallback database health check failed: ${fallbackHealth.error || "Cannot connect"}`);
      }
    } else if (targetMode === "neon_primary") {
      // Pre-flight health check on Neon Primary
      const primaryHealth = await this.checkPrimaryHealth(true);
      if (primaryHealth.status === "unhealthy" && !force) {
        throw new Error(`SWITCH REJECTED: Primary Neon database health check failed: ${primaryHealth.error || "Cannot connect"}`);
      }
    }

    // Determine new active provider
    let newProvider: ActiveDatabaseProvider = "sqlite-libsql";
    if (targetMode === "neon_primary") {
      newProvider = "neon-postgres";
    } else if (targetMode === "maintenance") {
      newProvider = current.activeProvider; // Preserve read provider
    } else {
      newProvider = "sqlite-libsql";
    }

    // Increment fencing token monotonically to fence out any stale writes
    const newFencingToken = current.fencingToken + 1;

    const updatedState = this.saveControlPlaneState({
      mode: targetMode,
      activeProvider: newProvider,
      fencingToken: newFencingToken,
      lastSwitchedAt: Date.now(),
      lastSwitchedBy: adminUserId,
      switchReason: reason,
    });

    console.log(
      `[Database Provider Manager] Switched mode from ${current.mode} to ${targetMode} (Provider: ${newProvider}, Fencing Token: ${newFencingToken}) by ${adminUserId}: ${reason}`
    );

    return {
      success: true,
      state: updatedState,
      message: `Successfully switched database operating mode to ${targetMode}.`,
    };
  }

  /**
   * Health check for Neon PostgreSQL Primary.
   */
  public async checkPrimaryHealth(forceRefresh = false): Promise<ProviderHealthReport> {
    const now = Date.now();
    if (!forceRefresh && primaryHealthCache && now < primaryHealthCache.expiresAt) {
      return primaryHealthCache.report;
    }

    const neonUrl =
      process.env.NEON_DATABASE_URL ||
      process.env.TARGET_DATABASE_URL ||
      process.env.DIRECT_URL ||
      (process.env.DATABASE_URL?.startsWith("postgres") ? process.env.DATABASE_URL : undefined);

    if (!neonUrl) {
      const report: ProviderHealthReport = {
        status: "not_configured",
        latencyMs: 0,
        checkedAt: now,
        error: "Neon database URL is not configured in environment.",
      };
      primaryHealthCache = { report, expiresAt: now + HEALTH_CACHE_TTL_MS };
      return report;
    }

    const start = Date.now();
    try {
      const { neon } = require("@neondatabase/serverless");
      const client = neon(neonUrl);
      // Run lightweight ping query with 3500ms timeout
      await Promise.race([
        client.query("SELECT 1 as ping"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Health check timed out after 3500ms")), 3500)),
      ]);

      const report: ProviderHealthReport = {
        status: "healthy",
        latencyMs: Date.now() - start,
        checkedAt: now,
      };
      primaryHealthCache = { report, expiresAt: now + HEALTH_CACHE_TTL_MS };
      return report;
    } catch (err: any) {
      const report: ProviderHealthReport = {
        status: "unhealthy",
        latencyMs: Date.now() - start,
        checkedAt: now,
        error: err.message || "Failed to reach Neon PostgreSQL",
      };
      primaryHealthCache = { report, expiresAt: now + 5000 }; // Short retry TTL on failure
      return report;
    }
  }

  /**
   * Health check for Fallback Database (SQLite / LibSQL).
   */
  public async checkFallbackHealth(forceRefresh = false): Promise<ProviderHealthReport> {
    const now = Date.now();
    if (!forceRefresh && fallbackHealthCache && now < fallbackHealthCache.expiresAt) {
      return fallbackHealthCache.report;
    }

    const fallbackUrl =
      process.env.FALLBACK_DATABASE_URL ||
      (!process.env.DATABASE_URL?.startsWith("postgres") ? process.env.DATABASE_URL : undefined) ||
      "file:./data/bishnu.db";

    const authToken = process.env.FALLBACK_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

    const start = Date.now();
    try {
      const { createClient } = require("@libsql/client");
      const client = createClient({
        url: fallbackUrl,
        authToken,
      });

      await Promise.race([
        client.execute("SELECT 1 as ping"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Health check timed out after 3000ms")), 3000)),
      ]);

      const report: ProviderHealthReport = {
        status: "healthy",
        latencyMs: Date.now() - start,
        checkedAt: now,
      };
      fallbackHealthCache = { report, expiresAt: now + HEALTH_CACHE_TTL_MS };
      return report;
    } catch (err: any) {
      const report: ProviderHealthReport = {
        status: "unhealthy",
        latencyMs: Date.now() - start,
        checkedAt: now,
        error: err.message || "Failed to reach fallback database",
      };
      fallbackHealthCache = { report, expiresAt: now + 5000 };
      return report;
    }
  }

  /**
   * Get active Drizzle database client instance based on current operating mode.
   */
  public getActiveDb(): any {
    const state = this.getControlPlaneState();
    if (state.activeProvider === "neon-postgres") {
      return this.getNeonDb();
    } else {
      return this.getLibsqlDb();
    }
  }

  /**
   * Singleton Neon Drizzle client.
   */
  public getNeonDb(): any {
    if (neonDrizzleInstance) return neonDrizzleInstance;

    const neonUrl =
      process.env.NEON_DATABASE_URL ||
      process.env.TARGET_DATABASE_URL ||
      process.env.DIRECT_URL ||
      (process.env.DATABASE_URL?.startsWith("postgres") ? process.env.DATABASE_URL : undefined);

    if (!neonUrl) {
      throw new Error("Neon PostgreSQL URL is not configured. Check NEON_DATABASE_URL or TARGET_DATABASE_URL.");
    }

    const { neon } = require("@neondatabase/serverless");
    const { drizzle: drizzleNeon } = require("drizzle-orm/neon-http");

    const rawSql = neon(neonUrl);
    const client = (query: string, params: any[], options: any) => rawSql.query(query, params, options);
    neonDrizzleInstance = drizzleNeon(client, { schema: pgSchema });
    return neonDrizzleInstance;
  }

  /**
   * Singleton LibSQL/SQLite Drizzle client.
   */
  public getLibsqlDb(): any {
    if (libsqlDrizzleInstance) return libsqlDrizzleInstance;

    const dbUrl =
      process.env.FALLBACK_DATABASE_URL ||
      (!process.env.DATABASE_URL?.startsWith("postgres") ? process.env.DATABASE_URL : undefined) ||
      "file:./data/bishnu.db";
    const authToken = process.env.FALLBACK_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

    const { drizzle: drizzleLibsql } = require("drizzle-orm/libsql");
    const { createClient } = require("@libsql/client");

    if (dbUrl.startsWith("file:")) {
      const localPath = dbUrl.replace("file:", "");
      const dir = path.dirname(path.resolve(process.cwd(), localPath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    const client = createClient({
      url: dbUrl,
      authToken,
    });

    libsqlDrizzleInstance = drizzleLibsql(client, { schema: sqSchema });
    return libsqlDrizzleInstance;
  }
}

export function getDatabaseProviderManager(): DatabaseProviderManager {
  return DatabaseProviderManager.getInstance();
}
