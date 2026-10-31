/**
 * Upload Migration Utility: Local Disk -> Cloudflare R2 / S3 Object Storage
 *
 * Usage:
 *   npx tsx scripts/migrate-uploads-to-cloud.ts --dry-run
 *   npx tsx scripts/migrate-uploads-to-cloud.ts --execute
 *   npx tsx scripts/migrate-uploads-to-cloud.ts --execute --concurrency=4
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "../src/db";
import { orderFiles } from "../src/db/schema";
import { R2StorageAdapter } from "../src/lib/storage/r2-adapter";
import { LocalStorageAdapter } from "../src/lib/storage/local-adapter";

interface MigrationRecord {
  fileId: string;
  storageKey: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  sha256?: string;
  status: "pending" | "already_present" | "migrated" | "failed" | "missing_on_disk";
  error?: string;
  migratedAt?: string;
}

interface MigrationState {
  startedAt: string;
  lastUpdatedAt: string;
  dryRun: boolean;
  totalFiles: number;
  totalBytes: number;
  alreadyPresentCount: number;
  migratedCount: number;
  failedCount: number;
  missingCount: number;
  files: Record<string, MigrationRecord>;
}

const STATE_FILE_PATH = path.resolve(process.cwd(), "data/storage-migration-state.json");

function loadMigrationState(): MigrationState | null {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const data = fs.readFileSync(STATE_FILE_PATH, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn("Could not load previous migration state:", err);
  }
  return null;
}

function saveMigrationState(state: MigrationState) {
  try {
    const dir = path.dirname(STATE_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save migration state file:", err);
  }
}

function calculateFileSha256(filePath: string): string {
  const hash = crypto.createHash("sha256");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run") || !args.includes("--execute");
  const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
  const concurrency = concurrencyArg ? parseInt(concurrencyArg.split("=")[1], 10) : 3;

  console.log("==================================================================");
  console.log(" Bishnu Studio — Cloud File Storage Migration Utility");
  console.log("==================================================================");
  console.log(` Mode:        ${isDryRun ? "DRY-RUN (No files will be uploaded)" : "EXECUTE (Uploading to Cloud Object Storage)"}`);
  console.log(` Concurrency: ${concurrency}`);
  console.log("------------------------------------------------------------------");

  // Validate R2 configuration before execution
  let r2Adapter: R2StorageAdapter | null = null;
  try {
    r2Adapter = new R2StorageAdapter();
    console.log(` Target: Cloudflare R2 (Bucket: ${process.env.R2_BUCKET_NAME})`);
  } catch (err: any) {
    if (!isDryRun) {
      console.error("\n❌ Cannot execute migration: Cloudflare R2 credentials are not configured or invalid.");
      console.error(`   Details: ${err.message}`);
      console.error("   Please set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.\n");
      process.exit(1);
    } else {
      console.log(` [Notice] R2 credentials not configured. Dry-run will inspect local files only.`);
    }
  }

  const localAdapter = new LocalStorageAdapter();

  // 1. Fetch file records from database
  console.log("\n[1/4] Querying active database for registered files...");
  const dbRecords = await db.select().from(orderFiles);
  console.log(`      Found ${dbRecords.length} registered file records in database.`);

  // 2. Scan physical ./uploads/ directory
  console.log("\n[2/4] Scanning local uploads directory for stored files...");
  const previousState = loadMigrationState();
  const state: MigrationState = previousState || {
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    dryRun: isDryRun,
    totalFiles: dbRecords.length,
    totalBytes: 0,
    alreadyPresentCount: 0,
    migratedCount: 0,
    failedCount: 0,
    missingCount: 0,
    files: {},
  };

  let totalBytes = 0;
  const pendingFiles: MigrationRecord[] = [];

  for (const record of dbRecords) {
    const fullDiskPath = localAdapter.getFullDiskPath(record.storageKey);
    const existsLocally = fs.existsSync(fullDiskPath);

    let sha256 = "";
    let actualSize = record.fileSize;

    if (existsLocally) {
      const stats = fs.statSync(fullDiskPath);
      actualSize = stats.size;
      totalBytes += actualSize;
      sha256 = calculateFileSha256(fullDiskPath);
    }

    const existingEntry = state.files[record.id];
    const itemStatus = !existsLocally
      ? "missing_on_disk"
      : existingEntry?.status === "already_present" || existingEntry?.status === "migrated"
      ? existingEntry.status
      : "pending";

    const item: MigrationRecord = {
      fileId: record.id,
      storageKey: record.storageKey,
      originalFilename: record.originalFilename,
      fileSize: actualSize,
      mimeType: record.mimeType,
      sha256: sha256 || undefined,
      status: itemStatus,
      migratedAt: existingEntry?.migratedAt,
    };

    state.files[record.id] = item;
    if (existsLocally && item.status !== "already_present" && item.status !== "migrated") {
      pendingFiles.push(item);
    }
  }

  state.totalFiles = dbRecords.length;
  state.totalBytes = totalBytes;
  state.missingCount = Object.values(state.files).filter((f) => f.status === "missing_on_disk").length;

  console.log(`      Total local bytes: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB across ${dbRecords.length} files.`);
  if (state.missingCount > 0) {
    console.warn(`      ⚠️  ${state.missingCount} records in DB are missing on disk storage.`);
  }

  // 3. Dry run or execute cloud transfer
  console.log(`\n[3/4] ${isDryRun ? "Simulating transfer & checking cloud presence..." : "Executing transfer to cloud storage..."}`);

  let processedCount = 0;
  const chunk = async (item: MigrationRecord) => {
    const fullDiskPath = localAdapter.getFullDiskPath(item.storageKey);
    try {
      if (r2Adapter) {
        const alreadyInCloud = await r2Adapter.fileExists(item.storageKey);
        if (alreadyInCloud) {
          item.status = "already_present";
          return;
        }

        if (!isDryRun) {
          const buffer = fs.readFileSync(fullDiskPath);
          const isPublic = item.storageKey.startsWith("public/");
          await r2Adapter.uploadFile(buffer, item.storageKey, item.mimeType, isPublic);

          // Verify upload
          const verified = await r2Adapter.fileExists(item.storageKey);
          if (!verified) {
            throw new Error("Verification failed: object not found in bucket after upload");
          }

          item.status = "migrated";
          item.migratedAt = new Date().toISOString();
        } else {
          item.status = "pending";
        }
      }
    } catch (err: any) {
      item.status = "failed";
      item.error = err.message || String(err);
      console.error(`      ❌ [${item.fileId}] ${item.storageKey}: ${item.error}`);
    } finally {
      processedCount++;
      state.files[item.fileId] = item;
      if (processedCount % 5 === 0) {
        state.lastUpdatedAt = new Date().toISOString();
        saveMigrationState(state);
      }
    }
  };

  // Run with bounded concurrency
  for (let i = 0; i < pendingFiles.length; i += concurrency) {
    const batch = pendingFiles.slice(i, i + concurrency);
    await Promise.all(batch.map((item) => chunk(item)));
  }

  // Update summary counts
  state.alreadyPresentCount = Object.values(state.files).filter((f) => f.status === "already_present").length;
  state.migratedCount = Object.values(state.files).filter((f) => f.status === "migrated").length;
  state.failedCount = Object.values(state.files).filter((f) => f.status === "failed").length;
  state.lastUpdatedAt = new Date().toISOString();
  saveMigrationState(state);

  // 4. Report
  console.log("\n[4/4] Migration Summary Report:");
  console.log("------------------------------------------------------------------");
  console.log(` Total database file records: ${state.totalFiles}`);
  console.log(` Total payload size:          ${(state.totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(` Already in cloud:            ${state.alreadyPresentCount}`);
  console.log(` Newly migrated:              ${state.migratedCount}`);
  console.log(` Failed migrations:           ${state.failedCount}`);
  console.log(` Missing from disk:           ${state.missingCount}`);
  console.log("------------------------------------------------------------------");
  console.log(` Migration state saved to:    ${STATE_FILE_PATH}`);
  if (isDryRun) {
    console.log("\n💡 Dry run completed successfully. To execute live migration, run:");
    console.log("   npx tsx scripts/migrate-uploads-to-cloud.ts --execute\n");
  } else {
    console.log("\n✅ Migration execution finished.\n");
  }
}

main().catch((err) => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
