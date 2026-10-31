# BS-FINAL-05 — Neon-First Database Architecture, Safe Operating Mode Switching & Complete Database Compatibility

**Project:** Bishnu Studio  
**Repository:** `C:\dev\Antigravity\bishnu-studio`  
**Branch:** `main`  
**Milestone:** `BS-FINAL-05`  
**Date:** October 31, 2026  
**Status:** Completed & Fully Verified (All 33 test suites / 386 automated tests PASS; 60 Next.js routes built cleanly)

---

## 1. What Was Present Before the Implementation

Prior to milestone `BS-FINAL-05`, the repository possessed:
1. **Initial Dual Database Setup (`BS-DB-01`):**
   - SQLite dialect schema (`src/db/schema.sqlite.ts`) and PostgreSQL dialect schema (`src/db/schema.pg.ts`) with 28 matching models each.
   - Initial provider manager (`src/lib/db-provider.ts`) and outbox engine (`src/lib/db-sync.ts`).
   - Dedicated admin settings page at `/admin/settings/database`.
   - Migration files `0014_database_provider_and_sync_outbox.sql` (SQLite) and `0004_dual_database_and_sync_outbox.sql` (PostgreSQL).
2. **Dynamic Table Proxies:**
   - Proxied table references in `src/db/schema.ts` allowing queries to bind dynamically to the active provider dialect.

---

## 2. What Was Incorrect or Missing

During the pre-flight investigation, the following critical gaps and safety vulnerabilities were identified:
1. **Mode C Guard in Production:**
   - Although local development mode (`local_development`) was restricted in theory, the control-plane state did not strictly prohibit Mode C from being selected or retained if configured in production. An accidental configuration could have exposed an empty local SQLite database in a deployed container.
2. **Missing Maintenance Mode Transaction Guard:**
   - Write-blocking in `src/db/index.ts` checked `insert`, `update`, and `delete` calls, but did not guard direct calls to `db.transaction(...)`. A caller starting a multi-statement transaction in maintenance mode could execute before an inner mutation threw.
3. **Lack of Consequence Transparency in Admin UI:**
   - The `/admin/settings/database` page lacked explicit contextual consequence explanations for each operating mode, leaving administrators without guidance on the operational impact of switching to Mode B, C, or D.
4. **Vercel Ephemeral Storage Disclosure:**
   - The fallback storage badge did not sufficiently emphasize that a local `file:` URL on Vercel is completely ephemeral across serverless lambda containers.
5. **Incomplete Parity Documentation:**
   - Permanent database parity rules were not yet formally enshrined in `AGENTS.md` and `README.md`.

---

## 3. What Was Changed

1. **Enforced Neon-First Default in Production:**
   - Updated `getControlPlaneState()` to enforce Mode A (`neon_primary`) as the mandatory default in production environments (`NODE_ENV === "production"` or `VERCEL`).
   - Added a strict guard in `switchOperatingMode()` that immediately rejects switching to Mode C (`local_development`) in production or Vercel environments.
2. **Hardened Maintenance Mode Guard:**
   - Added `prop === "transaction"` to the dynamic proxy in `src/db/index.ts`, ensuring that all transaction attempts during Maintenance Mode immediately throw `MaintenanceModeError` (HTTP 503).
3. **Enhanced Admin Database Settings Interface (`/admin/settings/database`):**
   - Added an **Authoritative Database** status row and a dynamic **Write Status** badge (`Writes Enabled` vs `Writes Blocked (Maintenance)`).
   - Added a **Last Switch Audit Banner** displaying timestamp, administrator ID, and justification.
   - Added an interactive **Consequence Explanation Box** in the mode switching dialog that updates dynamically based on the selected target mode.
   - Disabled options in the UI that are unsafe for the current hosting environment (e.g., Mode C in production, Mode B on Vercel when fallback is a local file).
4. **Updated Documentation & Contributor Rules:**
   - Updated `README.md` with sections detailing the 4 operating modes, outbox synchronization, conflict detection, and planned cost-based migration.
   - Updated `AGENTS.md` with the permanent 10-point Dual-Database Parity Protocol.
5. **Added Test Suite:**
   - Created `tests/neon-first-and-complete-parity.test.ts` with 9 comprehensive tests covering production defaults, safety rejections, maintenance mode write-blocking, outbox sanitization, and real database connectivity.

---

## 4. Exact Files Created, Modified and Deleted

### Files Created:
- `tests/neon-first-and-complete-parity.test.ts`: Automated test suite for production defaults, mode switching, outbox sanitization, and dual-database parity.
- `BS-FINAL-05-report.md`: This comprehensive engineering report.

### Files Modified:
- `src/lib/db-provider.ts`: Hardened production-first mode resolution, Mode C production prohibition, and authoritative database state tracking.
- `src/lib/db-sync.ts`: Added `@next/env` loading in CLI/test contexts and optimized dry-run preview inspection.
- `src/db/index.ts`: Added transaction guarding in the dynamic database proxy for maintenance mode.
- `src/app/api/admin/database/status/route.ts`: Exposed `authoritativeDatabase` and `writesEnabled` fields.
- `src/app/admin/settings/database/page.tsx`: Enhanced UI with authoritative DB indicators, write status badges, consequence explanations, and Vercel storage disclosures.
- `README.md`: Updated architecture documentation covering dual database engines, operating modes, and planned provider migrations.
- `AGENTS.md`: Enshrined permanent dual-database parity rules.

### Files Deleted:
- None.

---

## 5. Actual Database Architecture After Changes

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   NEXT.JS APP ROUTER                                    │
│       59 Call Sites: import { db } from "@/db"; import { ... } from "@/db/schema";       │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │
                   ┌─────────────────────────▼─────────────────────────┐
                   │           DYNAMIC DATABASE CLIENT PROXY           │
                   │               (src/db/index.ts)                   │
                   └─────────────────────────┬─────────────────────────┘
                                             │
                   ┌─────────────────────────▼─────────────────────────┐
                   │       DATABASE PROVIDER MANAGER (CONTROL PLANE)   │
                   │               (src/lib/db-provider.ts)            │
                   └───────┬─────────────────────────┬─────────────────┘
                           │                         │
             Mode A (Production Default)       Mode B / C (Fallback / Dev)
                           │                         │
                           ▼                         ▼
┌─────────────────────────────────────────┐   ┌──────────────────────────────────────────┐
│      Neon Serverless PostgreSQL         │   │            SQLite / LibSQL               │
│      (@neondatabase/serverless)         │   │           (@libsql/client)               │
│ - Authoritative Production Engine       │   │ - Local: ./data/bishnu.db                │
│ - Multi-AZ High Availability            │   │ - Standby: libsql://... (Turso Remote)   │
│ - Point-In-Time Recovery (PITR)         │   │ - Outbox: db_sync_outbox logging         │
└─────────────────────────────────────────┘   └──────────────────────────────────────────┘
```

---

## 6. Actual Default Production Operating Mode

- **Default Production Mode:** **Mode A — Neon Primary (Authoritative Production)**.
- **Provider:** Neon PostgreSQL via `@neondatabase/serverless` HTTP driver.
- **Fail-Safe Guarantee:** If deployed in production and Neon PostgreSQL credentials are not configured, the application **fails safely** with an explicit configuration error. It **never** silently falls back to an empty or ephemeral SQLite file.

---

## 7. Status of Operating Modes A, B, C and D

| Mode | Identifier | Status | Real Capabilities |
| :--- | :--- | :--- | :--- |
| **Mode A** | `neon_primary` | **Fully Functional** | Default production engine. Authoritative for all reads and writes. Monitored with live health checks. |
| **Mode B** | `emergency_fallback` | **Fully Functional (when persistent standby configured) / Protected on Vercel** | When paired with a remote LibSQL endpoint (`libsql://...`), accepts writes and logs mutations into `db_sync_outbox`. When using an ephemeral local `file:` on Vercel, switching is **strictly blocked** to prevent data loss. |
| **Mode C** | `local_development` | **Fully Functional for Local Dev / Strictly Blocked in Production** | Uses `file:./data/bishnu.db`. Durable on host machine disk. Blocked from running or being selected in production. |
| **Mode D** | `maintenance` | **Fully Functional** | Halts all mutations (`insert`, `update`, `delete`, `transaction`) on the backend with HTTP 503. Preserves read access where safe. |

---

## 8. Fallback Storage Persistence Assessment

> [!CRITICAL]
> **Honest Storage Reality:**
> - A local SQLite file on a Windows development machine (`./data/bishnu.db`) is persistent **only for local development**.
> - In Vercel serverless production, container `/tmp` and local disks are ephemeral. **A local SQLite file CANNOT serve as a production fallback on Vercel.**
> - For production fallback, the administrator must supply a persistent remote LibSQL/Turso URL in `FALLBACK_DATABASE_URL`. The UI accurately displays "Ephemeral SQLite (Unsafe on Vercel)" unless a verified remote endpoint is configured.

---

## 9. Server-Side Fencing Protection

- Every transition of the operating mode atomically increments an integer `fencingToken` (e.g. Token #1 &rarr; Token #2).
- During Mode B (Emergency Fallback), all mutations written to `db_sync_outbox` stamp the active `fencingToken`.
- In-memory state caches have a strict 2-second TTL, ensuring rapid propagation of mode changes across application instances.
- Stale serverless lambda instances holding an outdated fencing token are fenced out from accepting writes.

---

## 10. Outbox & Synchronization Engine Verification

- **Outbox Persistence:** Tested with `queueSyncOutboxEvent()`. Mutations are durably stored with unique event IDs, sequence tokens, entity types, and timestamps.
- **Credential Sanitization:** Tested and verified that `passwordHash`, `sessionToken`, and `tokenHash` are stripped before writing to outbox logs.
- **Non-Blind Conflict Detection:** Replay logic checks target records in Neon. If a record was modified in Neon more recently than the fallback event, it is flagged as a conflict (`status: 'conflict'`) and never blindly overwritten.
- **Verified Payment Protection:** If an order was already marked `paid` in Neon, the synchronization engine refuses any fallback mutation attempting to downgrade its status.
- **Dry-Run Validation:** Tested and verified that `dryRun: true` inspects pending outbox records and returns an accurate preview without modifying database state.

---

## 11. SQLite & PostgreSQL Compatibility Results

Both database engines have **100% schema parity** across 28 matching tables:
- **SQLite Migrations:** Applied through `src/db/migrations/0014_database_provider_and_sync_outbox.sql`.
- **PostgreSQL Migrations:** Applied through `src/db/migrations-pg/0004_dual_database_and_sync_outbox.sql`.
- **Query Compatibility:** Tested identical query syntax across dialect proxies for:
  - Users, Orders, Order Items, Payments, Payment Submissions, Returns, Return Items.
  - Audit Logs, Notifications, Shop Settings, Developer Profile.
  - `db_sync_outbox` and `db_sync_history`.
- **Data Type Parity:** Booleans (`integer mode: boolean` in SQLite vs `boolean` in PG), BigInt/Timestamps (`unixepoch() * 1000` vs `extract(epoch from now()) * 1000`), Floats/Decimals (`real` vs `doublePrecision`).

---

## 12. Security Review

1. **Authorization:** Operating mode switching and synchronization execution are strictly restricted to authenticated administrators with role `admin` (`getAuthSession()`).
2. **CSRF & Confirmation Protection:** Mode switching requires an explicit confirmation phrase (`"CONFIRM"`) or administrator password re-verification.
3. **Zero Credential Leakage:** Database connection strings (`DATABASE_URL`, `NEON_DATABASE_URL`, `DIRECT_URL`), passwords, and tokens are evaluated strictly server-side and are never returned in API payloads or rendered in HTML attributes.
4. **Sanitized Logs:** Audit logs and outbox payloads record entity IDs, operations, and metadata without recording plaintext passwords or session tokens.
5. **Backend Maintenance Guard:** Maintenance mode write-blocking is enforced on the backend dynamic database proxy, guaranteeing that API requests cannot bypass frontend UI disables.

---

## 13. Actual Measured Database Health Timings

Measured from live connectivity checks:
- **Local SQLite Ping (`SELECT 1`):** `< 1 ms` (0.35ms – 0.55ms)
- **Neon Serverless PostgreSQL Ping (`SELECT 1`):** `2852 ms` (Initial cold start wake-up) &rarr; `42 ms – 65 ms` (Warm pooler HTTP latency)
- **Primary Health Status:** `healthy` (PostgreSQL 18.6 on AWS aarch64)
- **Fallback Health Status:** `healthy` (LibSQL Client 0.14)

---

## 14. Automated Test Results (PASS / FAIL / NOT RUN / BLOCKED)

All 33 test suites in the repository passed with a **100% success rate**:

| Test Suite | Tests | Result | Duration |
| :--- | :--- | :--- | :--- |
| `tests/neon-first-and-complete-parity.test.ts` | 9 | **PASS** | 172ms |
| `tests/dual-database-provider-and-sync.test.ts` | 10 | **PASS** | 159ms |
| `tests/admin-database-api.test.ts` | 3 | **PASS** | 145ms |
| `tests/admin-notifications-and-payment-methods.test.ts` | 25 | **PASS** | 98ms |
| `tests/blocking-reviews-gallery.test.ts` | 10 | **PASS** | 551ms |
| `tests/returns-and-refunds.test.ts` | 13 | **PASS** | 166ms |
| `tests/cart-gallery-tracking.test.ts` | 16 | **PASS** | 10ms |
| `tests/order-state-machine-and-tracking.test.ts` | 20 | **PASS** | 146ms |
| `tests/order-management-and-performance.test.ts` | 8 | **PASS** | 187ms |
| `tests/universal-fulfillment-and-return-exchange.test.ts` | 17 | **PASS** | 8ms |
| `tests/orders-fit-pagination-inventory-products.test.ts` | 25 | **PASS** | 6ms |
| `tests/sidebar-cleanup-reviews-theme.test.ts` | 8 | **PASS** | 364ms |
| `tests/unified-return-refund-timeline.test.ts` | 12 | **PASS** | 6ms |
| `tests/profile-and-security.test.ts` | 11 | **PASS** | 971ms |
| `tests/auth-hydration-avatars-and-performance.test.ts` | 18 | **PASS** | 13ms |
| `tests/performance-and-latency.test.ts` | 11 | **PASS** | 168ms |
| `tests/admin-and-addresses.test.ts` | 9 | **PASS** | 376ms |
| `tests/business-config-and-availability.test.ts` | 14 | **PASS** | 149ms |
| `tests/orders-table-payment-products-devcleanup.test.ts` | 19 | **PASS** | 5ms |
| `tests/notifications-system-and-security.test.ts` | 5 | **PASS** | 187ms |
| `tests/admin-credentials-and-session-invalidation.test.ts` | 4 | **PASS** | 485ms |
| `tests/neon-postgres-and-homepage.test.ts` | 11 | **PASS** | 66ms |
| `tests/session-management-and-blocking.test.ts` | 5 | **PASS** | 294ms |
| `tests/final-predelivery-quality-gate.test.ts` | 11 | **PASS** | 5ms |
| `tests/pricing.test.ts` | 5 | **PASS** | 160ms |
| `tests/theme-scrollbar.test.ts` | 9 | **PASS** | 7ms |
| `tests/orders.test.ts` | 2 | **PASS** | 150ms |
| `tests/storage-pdf.test.ts` | 5 | **PASS** | 15ms |
| `tests/auth.test.ts` | 3 | **PASS** | 380ms |
| `tests/cart-buynow-selection-services.test.ts` | 17 | **PASS** | 151ms |
| `tests/upi-history-and-developer-credits.test.ts` | 18 | **PASS** | 232ms |
| `tests/payment-and-timeline.test.ts` | 12 | **PASS** | 314ms |
| `tests/system-config-pricing-homepage.test.ts` | 21 | **PASS** | 195ms |
| **TOTAL** | **386** | **100% PASS** | **29.53s** |

---

## 15. Production Build Result

Next.js 14 production build (`npm run build`) succeeded without errors:
- **Routes Compiled:** 60 static and dynamic routes.
- **Static Pages Generated:** 60/60.
- **TypeScript & Lint Validation:** 0 errors.

---

## 16. Manual Browser Testing Instructions

1. **Log in as Administrator:**
   - Navigate to `/admin/login` and log in with your administrator credentials.
2. **Access Database Management:**
   - Go to `/admin/settings` and click on **Database & Storage Architecture** (or navigate directly to `/admin/settings/database`).
3. **Verify Diagnostic Cards:**
   - Confirm that **Operating Mode** shows `Mode A: Neon Primary (Authoritative Production)` or current active mode.
   - Confirm that **Write Status** shows `Writes Enabled`.
   - Confirm that **Neon PostgreSQL Primary** shows `Connected` with measured latency.
   - Confirm that **Fallback Database** indicates its actual storage reality (`Local File (Dev Only)` or `Persistent Remote LibSQL`).
4. **Test Operating Mode Dialog:**
   - Click **Switch Operating Mode**.
   - Select **Mode D: Maintenance (Read-Only / Writes Blocked)**.
   - Read the consequence explanation card.
   - Type an operational reason (e.g. `Routine health inspection and write-safety test`).
   - Type `CONFIRM` into the verification input.
   - Click **Confirm Mode Switch**.
   - Observe that the dashboard updates to Mode D with `Writes Blocked`.
5. **Verify Write Protection:**
   - Try to place an order or update an item. The backend will return HTTP 503 (`MaintenanceModeError`).
6. **Restore Mode A:**
   - Open the modal again, select **Mode A: Neon Primary**, provide justification, type `CONFIRM`, and restore normal operations.

---

## 17. Remaining Limitations & Required Infrastructure

1. **Production Fallback Database (Vercel):**
   - For a production deployment on Vercel to safely offer Mode B (Emergency Fallback), a persistent remote LibSQL endpoint (`libsql://...` or Turso database) must be provisioned and configured in `FALLBACK_DATABASE_URL` with `FALLBACK_AUTH_TOKEN`.
   - Without this, Mode B remains intentionally protected and blocked on Vercel to guarantee zero data loss.
2. **Persistent File Upload Storage:**
   - Local disk storage (`./uploads/`) is durable on development servers but ephemeral on Vercel. For deployed production environments, AWS S3, Cloudflare R2, or Vercel Blob should be paired with `src/lib/storage.ts`.

---

## 18. Git Commit & Remote Push Status

- **Branch:** `main`
- **Remote:** `https://github.com/SayanBasani/BISHNU-STUDIO.git`
- **Protected Untracked Files:** `.env.local` untracked, `z-requirement.md` untracked and preserved.
- **Commit SHA:** *(Generated upon staging)*
- **Commit Subject:** `feat: BS-FINAL-05 neon-first database architecture and complete parity`
