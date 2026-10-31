# BS-DB-01 — Dual Database Architecture, Admin-Controlled Switching, Neon Primary and SQLite Emergency Failover

**Project:** Bishnu Studio  
**Repository:** `C:\dev\Antigravity\bishnu-studio`  
**Branch:** `main`  
**Milestone:** `BS-DB-01`  
**Date:** October 31, 2026  
**Status:** Completed & Verified (All 32 test suites / 377 automated tests PASS; 60 Next.js routes built cleanly)

---

## 1. Existing Database Architecture

Prior to milestone `BS-DB-01`, Bishnu Studio had:
1. **Dialect Schemas:**
   - SQLite schema (`src/db/schema.sqlite.ts`) with 26 tables.
   - PostgreSQL schema (`src/db/schema.pg.ts`) with 26 tables.
   - Static re-export file `src/db/schema.ts` that evaluated `DATABASE_URL` once upon process initialization.
2. **Database Client Initialization (`src/db/index.ts`):**
   - Statically created either a Neon PostgreSQL client (`@neondatabase/serverless` via `drizzle-orm/neon-http`) or a LibSQL client (`@libsql/client` via `drizzle-orm/libsql`).
   - If `DATABASE_URL` pointed to a `file:` URL while `process.env.VERCEL` was set in production, an error was thrown at startup.
3. **Limitations:**
   - No dynamic runtime provider switching; changing databases required altering environment variables and restarting the entire process.
   - No fencing token protection to prevent split-brain writes across concurrent serverless instances.
   - No durable outbox log to capture mutations during an emergency fallback window.
   - No non-blind synchronization engine to detect conflicts on financial and customer records during recovery.
   - No dedicated admin panel console for database health diagnostics, failover control, or outbox monitoring.

---

## 2. Current Local and Production Database Behavior

| Environment | Authoritative Engine | Active Driver | Connection URL | Durability & Multi-Instance Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Local Development** | SQLite / LibSQL | `@libsql/client` | `file:./data/bishnu.db` | Single host machine. Durable on physical disk. Instant query response (<1ms). |
| **Production (Vercel / Cloud)** | Neon Serverless PostgreSQL | `@neondatabase/serverless` (HTTP Driver) | `postgresql://neondb_owner:***@ep-***.ap-southeast-1.aws.neon.tech/neondb` | Authoritative cloud database with connection pooling, multi-AZ high availability, and Point-In-Time Recovery (PITR). |
| **Emergency Fallback** | Remote LibSQL / Turso | `@libsql/client` | `libsql://...` (with Auth Token) | Accessible across all serverless lambda instances. Mutations recorded transactionally to `db_sync_outbox`. |
| **Maintenance Mode** | Read-Only Primary or Standby | Dynamic Proxy | Read-only queries | Write mutations (`insert`, `update`, `delete`) throw `MaintenanceModeError` (HTTP 503) to protect financial data integrity. |

---

## 3. Hosting Compatibility Assessment (Vercel Serverless Reality)

> [!CRITICAL]
> **Hosting Reality & Ephemeral Filesystem Boundary**
> Vercel executes Next.js application routes within serverless micro-VM containers (AWS Lambda micro-instances). Each micro-VM has an isolated, ephemeral filesystem:
> - Container `/tmp` is wiped when micro-VMs freeze or recycle.
> - Multiple concurrent requests hit different micro-VM instances with separate non-shared memory and disk.
> 
> Therefore, **a local SQLite file (`file:./data/bishnu.db`) CANNOT safely serve as a production fallback on Vercel**. Doing so causes immediate silent data loss and severe split-brain between user requests.

### Enforced Protection Rules in `DatabaseProviderManager`:
1. **Serverless Safety Check (`isFallbackPersistentAndSafe`):**
   - In production or when `process.env.VERCEL` is active:
     - If `FALLBACK_DATABASE_URL` starts with `file:`, fallback is categorized as **"Ephemeral / Unsafe on Vercel"**.
     - An admin switch to `emergency_fallback` is **STRICTLY BLOCKED**, with an explicit error instructing the administrator to configure a remote LibSQL endpoint or transition to Maintenance mode.
   - In local development (`process.env.NODE_ENV !== "production"`):
     - Local SQLite file is durable on the developer's computer disk and is safely permitted.

---

## 4. Architecture Diagram

```mermaid
flowchart TD
    subgraph ClientLayer ["Client & Admin Interfaces"]
        CustomerUI["Customer Storefront & Checkout"]
        AdminUI["Admin Settings & Database Console (/admin/settings/database)"]
    end

    subgraph AppRouter ["Next.js 14 App Router API & Server Actions"]
        API["API Routes (/api/orders, /api/payments, etc.)"]
        DBProxy["Dynamic Database Client Proxy (src/db/index.ts)"]
        SchemaProxy["Dynamic Schema Proxy (src/db/schema.ts)"]
    end

    subgraph ControlPlaneLayer ["Central Control Plane (src/lib/db-provider.ts)"]
        CPManager["DatabaseProviderManager Singleton"]
        StateStore[("data/db-control-plane.json + ENV Override")]
        FencingEngine["Fencing Token Engine (Monotonically Increasing)"]
        SafetyEngine["Vercel Serverless Storage Validator"]
        HealthCache["Cached Health Check (30s TTL, 3500ms Ping)"]
    end

    subgraph OutboxSyncLayer ["Durable Synchronization Engine (src/lib/db-sync.ts)"]
        OutboxWriter["queueSyncOutboxEvent()"]
        OutboxTable[("db_sync_outbox Table")]
        ConflictDetector["Non-Blind Conflict Detector"]
        ReplayEngine["Deterministic Dependency Replayer"]
        SyncHistoryTable[("db_sync_history Table")]
    end

    subgraph DatabaseEngines [" Authoritative Storage Engines "]
        NeonPG[("Neon PostgreSQL Primary\n(@neondatabase/serverless)\nAuthoritative Production Mode A")]
        LibSQL[("SQLite / LibSQL Standby\n(@libsql/client)\nFallback Mode B / Local Mode C")]
    end

    CustomerUI --> API
    AdminUI --> API
    API --> DBProxy
    API --> SchemaProxy
    DBProxy --> CPManager
    SchemaProxy --> CPManager
    CPManager <--> StateStore
    CPManager --> FencingEngine
    CPManager --> SafetyEngine
    CPManager --> HealthCache

    DBProxy -- "Mode A: Neon Primary" --> NeonPG
    DBProxy -- "Mode B: Fallback (Writes to Outbox)" --> LibSQL
    LibSQL --> OutboxWriter --> OutboxTable
    DBProxy -- "Mode C: Local Dev" --> LibSQL
    DBProxy -- "Mode D: Maintenance" --> BlockWrites["Throws MaintenanceModeError (503)"]

    AdminUI -- "Trigger Recovery Sync" --> ReplayEngine
    ReplayEngine --> OutboxTable
    ReplayEngine --> ConflictDetector
    ConflictDetector <--> NeonPG
    ReplayEngine -- "Idempotent Replay" --> NeonPG
    ReplayEngine --> SyncHistoryTable
```

---

## 5. Provider-Selection Design

The database provider selection operates through a unified central proxy architecture:
1. **Dynamic DB Proxy (`src/db/index.ts`):**
   - `export const db = new Proxy(...)` dynamically delegates all query builder invocations (`select`, `insert`, `update`, `delete`, `transaction`, `run`, `execute`) to `manager.getActiveDb()`.
   - All 59 existing files across `src/` retain their exact `import { db } from "@/db"` syntax without breaking changes or call-site churn.
2. **Dynamic Table Proxies (`src/db/schema.ts`):**
   - All 28 table models (`users`, `orders`, `payments`, `dbSyncOutbox`, etc.) are proxied via `createTableProxy(pgTable, sqTable)`.
   - When active provider is `"neon-postgres"`, queries automatically bind to the PostgreSQL dialect table.
   - When active provider is `"sqlite-libsql"`, queries automatically bind to the SQLite dialect table.
   - Types are typed to match schema definitions, avoiding TypeScript intersection errors during production builds.

---

## 6. Control-Plane Design & Split-Brain Prevention

To avoid single-point failure (storing operating mode only inside a database that may be unreachable):
1. **Multi-Layer State Storage:**
   - **Environment Override:** `DATABASE_OPERATING_MODE` (`neon_primary`, `emergency_fallback`, `local_development`, `maintenance`).
   - **File State Store:** `data/db-control-plane.json` written atomically via temp-file write and rename.
   - **In-Memory Cache:** Cached with a 2-second TTL for rapid request processing without filesystem overhead.
2. **Fencing Token Protection:**
   - Every mode switch increments `fencingToken` by +1 (e.g., Token #1 &rarr; Token #2).
   - In fallback mode, all outbox records stamp the active fencing token.
   - Any stale serverless instance or out-of-order write from a previous generation is immediately fenced out.

---

## 7. Failover Procedure

### Switching to Mode B: Emergency Fallback
1. **Authorization:** Super-admin session required.
2. **Pre-flight Health Check:** Fallback database is queried with `SELECT 1` (3000ms timeout).
3. **Safety Verification:** Validates that storage is persistent (blocks `file:` URLs on Vercel).
4. **Transition:**
   - Fencing token incremented.
   - Active provider switched to `"sqlite-libsql"`.
   - Audit log recorded in `audit_logs` table.
   - Admin UI reflects "Mode B: Emergency Fallback".
5. **Mutation Outbox Activated:** New writes are queued into `db_sync_outbox`.

---

## 8. Synchronization & Conflict-Resolution Design

When Neon PostgreSQL Primary is restored:
1. **Pre-Flight Connectivity:** Verifies Neon connection. If unavailable, aborts without modifying records.
2. **Deterministic Entity Dependency Order:**
   - `users` &rarr; `product_categories` &rarr; `products` &rarr; `services` &rarr; `user_addresses` &rarr; `orders` &rarr; `order_items` &rarr; `payments` &rarr; `payment_submissions` &rarr; `order_returns` &rarr; `order_return_items` &rarr; `order_status_history` &rarr; `notifications` &rarr; `audit_logs`.
3. **Non-Blind Conflict Detection:**
   - **Insert Conflicts:** If record already exists in Neon with different data, flagged as conflict.
   - **Update Conflicts:** If `updatedAt` in Neon is newer than fallback mutation timestamp, flagged as conflict. Never blindly overwrite with "last write wins".
   - **Financial Protection:** If an order was already marked `paid` in Neon, refusing any fallback write attempting to downgrade payment status.
4. **Verification & Audit:**
   - Successfully synced records updated to `status: 'synced'`.
   - Conflicted records marked `status: 'conflict'` with detailed mismatch payload stored in `conflict_details`.
   - Batch summary logged in `db_sync_history`.
   - Mode switched back to `neon_primary` only after admin reviews and verifies reconciliation totals.

---

## 9. Schema and Migration Compatibility

Full schema parity is established across both database engines with 28 matching models:
- **SQLite Migrations:** `src/db/migrations/0014_database_provider_and_sync_outbox.sql`
- **PostgreSQL Migrations:** `src/db/migrations-pg/0004_dual_database_and_sync_outbox.sql`

### Synchronized Models:
1. `users`
2. `user_addresses`
3. `sessions`
4. `verification_tokens`
5. `product_categories`
6. `products`
7. `product_images`
8. `services`
9. `service_options`
10. `service_prices`
11. `orders`
12. `order_items`
13. `order_files`
14. `payments`
15. `audit_logs`
16. `authentication_events`
17. `shop_settings`
18. `payment_submissions`
19. `order_status_history`
20. `account_appeals`
21. `product_reviews`
22. `shop_upi_accounts`
23. `developer_profile`
24. `order_returns`
25. `order_return_items`
26. `notifications`
27. `db_sync_outbox`
28. `db_sync_history`

---

## 10. Backup and Disaster Recovery Design

1. **Neon PostgreSQL Primary:**
   - Automated cloud backups managed by Neon with Point-in-Time Restore (PITR) across a 7-day retention window.
   - Direct connection via `DIRECT_URL` for external pg_dump routines.
2. **Fallback Database:**
   - LibSQL/Turso cloud standby supports point-in-time branch replication.
   - Local development SQLite file backed up via atomic file copy to `./backups/` directory during test resets.
3. **Synchronization Recovery:**
   - Failed or partial synchronization runs do not discard outbox events. Pending and conflicted records remain durable in `db_sync_outbox` for safe replay after administrator inspection.

---

## 11. Automated Test Results (PASS / FAIL / NOT RUN / BLOCKED)

All 32 test suites in the repository passed with a 100% success rate:

| Test Suite | Tests | Result | Duration |
| :--- | :--- | :--- | :--- |
| `tests/dual-database-provider-and-sync.test.ts` | 10 | **PASS** | 310ms |
| `tests/admin-database-api.test.ts` | 3 | **PASS** | 135ms |
| `tests/admin-notifications-and-payment-methods.test.ts` | 25 | **PASS** | 108ms |
| `tests/blocking-reviews-gallery.test.ts` | 10 | **PASS** | 614ms |
| `tests/returns-and-refunds.test.ts` | 13 | **PASS** | 161ms |
| `tests/cart-gallery-tracking.test.ts` | 16 | **PASS** | 9ms |
| `tests/order-state-machine-and-tracking.test.ts` | 20 | **PASS** | 190ms |
| `tests/order-management-and-performance.test.ts` | 8 | **PASS** | 228ms |
| `tests/universal-fulfillment-and-return-exchange.test.ts` | 17 | **PASS** | 7ms |
| `tests/orders-fit-pagination-inventory-products.test.ts` | 25 | **PASS** | 6ms |
| `tests/sidebar-cleanup-reviews-theme.test.ts` | 8 | **PASS** | 441ms |
| `tests/unified-return-refund-timeline.test.ts` | 12 | **PASS** | 6ms |
| `tests/profile-and-security.test.ts` | 11 | **PASS** | 1033ms |
| `tests/auth-hydration-avatars-and-performance.test.ts` | 18 | **PASS** | 12ms |
| `tests/performance-and-latency.test.ts` | 11 | **PASS** | 174ms |
| `tests/admin-and-addresses.test.ts` | 9 | **PASS** | 380ms |
| `tests/business-config-and-availability.test.ts` | 14 | **PASS** | 164ms |
| `tests/orders-table-payment-products-devcleanup.test.ts` | 19 | **PASS** | 5ms |
| `tests/notifications-system-and-security.test.ts` | 5 | **PASS** | 186ms |
| `tests/admin-credentials-and-session-invalidation.test.ts` | 4 | **PASS** | 460ms |
| `tests/neon-postgres-and-homepage.test.ts` | 11 | **PASS** | 57ms |
| `tests/session-management-and-blocking.test.ts` | 5 | **PASS** | 278ms |
| `tests/final-predelivery-quality-gate.test.ts` | 11 | **PASS** | 5ms |
| `tests/pricing.test.ts` | 5 | **PASS** | 141ms |
| `tests/theme-scrollbar.test.ts` | 9 | **PASS** | 5ms |
| `tests/orders.test.ts` | 2 | **PASS** | 155ms |
| `tests/storage-pdf.test.ts` | 5 | **PASS** | 16ms |
| `tests/auth.test.ts` | 3 | **PASS** | 400ms |
| `tests/cart-buynow-selection-services.test.ts` | 17 | **PASS** | 235ms |
| `tests/upi-history-and-developer-credits.test.ts` | 18 | **PASS** | 224ms |
| `tests/payment-and-timeline.test.ts` | 12 | **PASS** | 322ms |
| `tests/system-config-pricing-homepage.test.ts` | 21 | **PASS** | 204ms |
| **TOTAL** | **377** | **100% PASS** | **30.81s** |

---

## 12. Manual Disaster-Recovery Simulation Results

1. **Simulation A: Outage on Primary During Order Processing**
   - Primary database connection temporarily blocked.
   - Administrator switches to `emergency_fallback` (with reason and "CONFIRM").
   - Fencing token increments.
   - Subsequent customer orders write to fallback and record `INSERT` events in `db_sync_outbox`.
   - Verified that customer secrets and passwords are stripped from outbox payloads.
2. **Simulation B: Recovery & Synchronization to Neon**
   - Primary connectivity restored.
   - Admin triggers `runSynchronizationToPrimary()`.
   - Outbox events replayed in entity dependency order.
   - Zero conflicts detected; orders, users, and audit records verified in Neon.
   - Status marked `completed` in `db_sync_history`.
   - Mode safely restored to `neon_primary`.
3. **Simulation C: Simulated Conflicting Modification**
   - Record modified in Neon with newer timestamp than fallback outbox event.
   - Replay engine correctly flagged event as `status: 'conflict'`.
   - Mutation was not blindly overwritten, protecting data integrity.

---

## 13. Remaining Infrastructure Recommendations

1. **For Production Deployment on Vercel:**
   - Configure a persistent LibSQL/Turso database URL for `FALLBACK_DATABASE_URL` (`libsql://...`) along with `FALLBACK_AUTH_TOKEN`.
   - This provides a globally distributed, durable standby instance across all Vercel serverless lambda containers.
2. **Durable Edge Configuration:**
   - In ultra-high availability multi-region setups, pair the control plane state with Vercel Edge Config or Upstash Redis to achieve sub-millisecond mode propagation across globally distributed edge nodes.

---

## 14. Git Commit & Push Summary

- **Branch:** `main`
- **Remote:** `https://github.com/SayanBasani/BISHNU-STUDIO.git`
- **Protected Files:** `.env.local` untracked, `z-requirement.md` untracked & preserved.
- **Commit Subject:** `feat: BS-DB-01 dual database architecture with neon primary, libsql fallback, and outbox sync`
