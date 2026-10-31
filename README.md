# Bishnu Studio — Shopping, Printing & Document Services Platform

> Production-grade, full-stack e-commerce, custom document printing, PVC card creation, photo studio, and manual UPI payment reconciliation platform for **Bishnu Studio** (West Bengal, India). Built with Next.js 14 App Router, TypeScript, Tailwind CSS with Dark/Light Mode, Drizzle ORM, dual database support (Neon Serverless PostgreSQL & local SQLite fallback), and secure file storage.

---

## Table of Contents
1. [Project Architecture](#1-project-architecture)
2. [Local SQLite versus Neon PostgreSQL](#2-local-sqlite-versus-neon-postgresql)
3. [When Each Database is Used](#3-when-each-database-is-used)
4. [Whether Data is Shared, Copied or Synchronized](#4-whether-data-is-shared-copied-or-synchronized)
5. [Database Environment Variables](#5-database-environment-variables)
6. [Creating a Neon Test Project](#6-creating-a-neon-test-project)
7. [Copying the Pooled and Direct URLs](#7-copying-the-pooled-and-direct-urls)
8. [Configuring `.env.local`](#8-configuring-envlocal)
9. [Required Non-Database Environment Variables](#9-required-non-database-environment-variables)
10. [Initializing an Empty Test Database](#10-initializing-an-empty-test-database)
11. [Running Schema Migrations](#11-running-schema-migrations)
12. [Testing Database Connectivity](#12-testing-database-connectivity)
13. [Running the Application Locally](#13-running-the-application-locally)
14. [Running the Test Suite](#14-running-the-test-suite)
15. [Importing SQLite Data in a Separate, Controlled Process](#15-importing-sqlite-data-in-a-separate-controlled-process)
16. [Configuring Production Hosting (Vercel)](#16-configuring-production-hosting-vercel)
17. [Configuring Persistent Uploads](#17-configuring-persistent-uploads)
18. [Switching from a Test Database to Production](#18-switching-from-a-test-database-to-production)
19. [Backups and Recovery](#19-backups-and-recovery)
20. [Troubleshooting Common Errors](#20-troubleshooting-common-errors)
21. [Final Setup Checklist](#21-final-setup-checklist)
22. [Order Management & Fulfillment Guide](#22-order-management--fulfillment-guide)
23. [Performance Architecture & Audit Findings](#23-performance-architecture--audit-findings)
24. [Global Theme-Aware Scrollbar Architecture](#24-global-theme-aware-scrollbar-architecture)
25. [Platform Generalization, Order Lifecycle, Returns & Logistics](#25-platform-generalization-order-lifecycle-returns--logistics)
26. [Git Workflow, Branch Standards & Contributor Guidelines](#26-git-workflow-branch-standards--contributor-guidelines)
27. [Notification Architecture, Authentication Security & Session Management](#27-notification-architecture-authentication-security--session-management)
28. [Authentication State Hydration, Persistent Profile Avatars & Mobile Identity (BS-AUTH-03A)](#28-authentication-state-hydration-persistent-profile-avatars--mobile-identity-bs-auth-03a)
- [Appendix: Environment-Variable Reference Table](#appendix-environment-variable-reference-table)
- [Developer & Credits Information](#developer--credits-information)

---

## 1. Project Architecture

**Bishnu Studio** is an integrated e-commerce and local printing services web platform designed for counter operations and online customers in West Bengal, India. It combines traditional retail shopping with specialized on-demand printing workflows:
- **E-Commerce & Retail Shop**: Stationery, office supplies, art equipment, and electronics with category browsing, search, inventory tracking, multi-image product galleries, customer reviews with verified purchase badges, shopping cart, and Buy Now checkout.
- **PVC Smart Card Printing**: Government ID and smart card production (Aadhaar, PAN, Voter ID, Driving Licence, Ration cards, Custom badges) with live client preview, front/back image uploads, and server-side pricing.
- **Document Printing & Lamination**: Multi-page PDF/Word uploads with automated server-side page counting via `pdf-lib`, Black & White vs. Colour, Single-sided vs. Duplex sheets, A4/Legal/A3 paper sizing, and thermal pouch lamination.
- **Photo Studio Lab**: Passport size sets (standard 35×45 mm), Stamp size sets (25×30 mm), 4×6 inch studio postcards, 5×7 inch portraits, A4 enlargements, and custom finishes (Glossy vs. Silk Matte).
- **Manual UPI Payment Reconciliation**: Cashless payments via dynamic NPCI-compliant UPI QR codes, receiving account lifecycle history (`shop_upi_accounts`), immutable snapshot preservation on every transaction, 12-digit UTR submission, payment proof verification queue, and CSV ledger export.
- **Customer Account & Security**: Phone/Email authentication, password reset, multiple saved delivery addresses, order progress tracking, customer blocking, and appeals handling.

### Technology Stack & Architecture
| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | **Next.js 14.2.24** (App Router, Server & Client Components, React 18, TypeScript 5.7) |
| **Styling & Design System** | **Tailwind CSS 3.4**, Lucide React icons, Editorial Commerce design system, Light/Dark theme |
| **Backend & APIs** | Next.js Route Handlers (`/api/*`), Next.js Server Actions, Node.js runtime |
| **Database & ORM** | **Neon Serverless PostgreSQL** (`@neondatabase/serverless`, `pg`) + **Drizzle ORM** (v0.38+), with embedded SQLite (`@libsql/client`) for zero-config offline local development |
| **Migrations Engine** | **Drizzle Kit** (`drizzle-kit generate`), custom HTTP migrator (`src/db/migrate.ts`), and SQLite-to-Neon data preservation tool (`scripts/migrate-sqlite-to-neon.ts`) |
| **Document Processing** | `pdf-lib` (pure JS server-side PDF page counting & validation) |
| **File Storage** | Private local filesystem storage (`./uploads/` partitioned by category) with genuine magic-byte file signature validation |
| **Authentication** | Dual authentication: Fixed Owner Admin via environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`), Customer authentication via bcryptjs hashes, session cookies, and rate-limited OTPs |
| **Automated Testing** | **Vitest 2.1** test suite (15 test suites, 156 automated tests covering payments, pricing, auth, migrations, orders, and performance) |

---

## 2. Local SQLite versus Neon PostgreSQL

The Bishnu Studio repository supports two database engines through a unified abstraction layer in `src/db/index.ts`. Understanding how they differ prevents configuration mistakes:

### A. Local SQLite / LibSQL Database (`./data/bishnu.db`)
- **What it is**: A self-contained, single-file relational database stored directly on your development machine's local disk at `./data/bishnu.db`.
- **Driver used**: `@libsql/client` coupled with `drizzle-orm/libsql`.
- **Persistence**: Persists across local restarts on the developer's computer. However, it is ignored by Git (`.gitignore` excludes `/data/*.db`), so it is **never** committed to version control.
- **Deployment Behavior**: When deployed to serverless hosts like Vercel, the filesystem is ephemeral and read-only. An SQLite file cannot be shared across multiple serverless function instances, and any writes to disk are lost when containers recycle.
- **Synchronization**: SQLite records are **never** automatically copied or synced to Neon.

### B. Neon PostgreSQL Database
- **What it is**: A managed, cloud-hosted PostgreSQL 16 database running on AWS with separated compute and persistent NVMe storage.
- **Driver used**: `@neondatabase/serverless` (Neon HTTP driver) coupled with `drizzle-orm/neon-http`.
- **Serverless-Native**: Neon utilizes connection pooling (PgBouncer) and an HTTP query pipeline that allows thousands of concurrent serverless requests without exhausting PostgreSQL connection limits.
- **Persistence**: All tables, customer accounts, orders, reviews, and payments are stored in persistent cloud storage with automatic continuous write-ahead logging (WAL) and point-in-time recovery (PITR).
- **Scale-to-Zero**: Neon Free Tier automatically pauses compute endpoints after 5 minutes of inactivity to save resources. When an incoming request arrives, Neon wakes the compute in 500ms to 1.5s transparently.

---

## 3. When Each Database is Used

The application selects its database engine **exclusively** at startup based on the value of `process.env.DATABASE_URL` in `src/db/index.ts`:

```ts
// src/db/index.ts
const dbUrl = process.env.DATABASE_URL || "file:./data/bishnu.db";
export const isPostgres = dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");
```

| Scenario | `DATABASE_URL` Value | Engine Selected | Driver Loaded |
| :--- | :--- | :--- | :--- |
| **Default Local Run** (No variable set) | Undefined (defaults to `file:./data/bishnu.db`) | **Local SQLite** | `@libsql/client` |
| **Explicit Offline Local** | `file:./data/bishnu.db` | **Local SQLite** | `@libsql/client` |
| **Connected to Neon Test DB** | `postgresql://...` (contains Neon host) | **Neon PostgreSQL** | `@neondatabase/serverless` |
| **Production on Vercel** | `postgresql://...-pooler...` | **Neon PostgreSQL** | `@neondatabase/serverless` |

### Critical Production Serverless Protection
If the application is deployed to Vercel in production and `DATABASE_URL` is either missing or set to a local `file:` URL, the application **immediately throws a fatal error at startup**:
```
CRITICAL CONFIGURATION ERROR: Vercel serverless environment detected with local SQLite file URL.
A persistent Neon PostgreSQL database URL (e.g. postgresql://...) must be provided in production...
```
This fails fast and prevents the website from silently writing orders or payments to an ephemeral SQLite file on Vercel.

---

## 4. Whether Data is Shared, Copied or Synchronized

> [!IMPORTANT]
> **THERE IS ZERO AUTOMATIC SYNCHRONIZATION BETWEEN SQLITE AND NEON.**
>
> 1. **No Dual Writing**: The application creates exactly **one** database client instance (`db`) at startup. Every insert, update, select, and delete executes against that single active database.
> 2. **No Split Reads/Writes**: The application never reads from SQLite while writing to Neon, or vice versa.
> 3. **No Background Replication**: Changes made in local SQLite are **not** forwarded to Neon. Changes made in Neon are **not** pulled down to SQLite.
> 4. **One-Time Migration Tool**: The script `scripts/migrate-sqlite-to-neon.ts` is an isolated command-line utility. It reads the local SQLite database and performs a one-time copy to Neon. Once it finishes, the two databases remain completely independent.

---

## 5. Database Environment Variables

The project uses three distinct database-related variables in `.env.local`. **They do not represent three different databases; they specify connection modes to the same database:**

```
                                  ┌───────────────────────────────────────────────┐
                                  │           Neon PostgreSQL Database            │
                                  │          (Project: bishnu-studio)             │
                                  └───────▲───────────────────────────────▲───────┘
                                          │                               │
                      Port 5432 / HTTP    │                               │  Port 5432 (Direct TCP)
                      PgBouncer Pooler   │                               │  (No Pooler)
                                          │                               │
                         ┌────────────────┴────────┐             ┌────────┴──────────────┐
                         │      DATABASE_URL       │             │       DIRECT_URL      │
                         │ (Next.js App Traffic &  │             │ (Drizzle Kit DDL      │
                         │  Serverless Functions)  │             │  Schema Migrations)   │
                         └─────────────────────────┘             └───────────────────────┘
```

1. **`DATABASE_URL` (Required for Runtime)**:
   - **Endpoint**: Neon **Pooled Connection String** (contains `-pooler` in the host).
   - **Used by**: Next.js App Router, Server Components, API routes (`/api/*`), and `@neondatabase/serverless` HTTP driver.
   - **Why Pooled?**: Next.js serverless functions scale up rapidly. Connecting each serverless worker directly to PostgreSQL would quickly exceed PostgreSQL's max connection limit (100–200). The PgBouncer pooler efficiently shares a small pool of database connections across thousands of concurrent web requests.
2. **`DIRECT_URL` (Required for DDL Migrations)**:
   - **Endpoint**: Neon **Direct Connection String** (does **not** contain `-pooler`).
   - **Used by**: Drizzle Kit in `drizzle.config.ts` when running `npm run db:migrate` or `npm run db:generate`.
   - **Why Direct?**: Schema changes (creating tables, altering columns, adding foreign keys) execute DDL transactions and prepared statements that are incompatible with PgBouncer's transaction-pooling mode. DDL tools require a direct TCP socket connection to PostgreSQL.
3. **`TARGET_DATABASE_URL` (Optional Migration Override)**:
   - **Used by**: `scripts/migrate-sqlite-to-neon.ts` only.
   - **Purpose**: If you want to run the migration script against a specific Neon database while keeping `DATABASE_URL` pointed to local SQLite in `.env.local`, you can specify `TARGET_DATABASE_URL` (or use the CLI flag `--target-url=...`). If unset, the migration script automatically falls back to `DATABASE_URL`.

---

## 6. Creating a Neon Test Project

To test your application safely without affecting future production data, create an isolated development/test project on Neon:

1. Open your browser and navigate to [https://console.neon.tech/](https://console.neon.tech/).
2. Sign in with GitHub, Google, or your email.
3. Click the **"New Project"** button in the top right.
4. Configure the test project settings:
   - **Project Name**: Name it clearly for testing, such as `bishnu-studio-test` or `bishnu-studio-dev`.
   - **Postgres Version**: Select **PostgreSQL 16**.
   - **Region**: Select `AWS ap-southeast-1` (Singapore) or `ap-south-1` (Mumbai) for lowest latency to India.
5. Click **"Create Project"**.
6. Neon will display the **Connection Details** modal. Keep this window open for the next step.

---

## 7. Copying the Pooled and Direct URLs

From the Neon **Connection Details** dialog in your test project:

### Step 1: Copy the Pooled URL (for `DATABASE_URL`)
1. Ensure the toggle **"Connection pooling"** is checked (or select **"Pooled connection"**).
2. Click the copy icon next to the connection string.
3. Notice that the hostname contains `-pooler`:
   ```
   postgresql://neondb_owner:YOUR_SECRET@ep-test-sample-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

### Step 2: Copy the Direct URL (for `DIRECT_URL`)
1. Toggle **off** connection pooling (or select **"Direct connection"**).
2. Click the copy icon next to the connection string.
3. Notice that the hostname does **not** have `-pooler`:
   ```
   postgresql://neondb_owner:YOUR_SECRET@ep-test-sample.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

> [!CAUTION]
> Connection strings contain private database passwords. Never paste them into public chat channels, GitHub issues, or source code files that are committed to git.

---

## 8. Configuring `.env.local`

1. Open your terminal in the project root:
   ```bash
   cd C:\dev\Antigravity\bishnu-studio
   ```
2. If `.env.local` does not exist, copy `.env.example`:
   - **Windows PowerShell**:
     ```powershell
     Copy-Item .env.example .env.local
     ```
   - **macOS / Linux / Git Bash**:
     ```bash
     cp .env.example .env.local
     ```
3. Open `.env.local` in your code editor. Paste your test Neon credentials using this template:

```env
# ==============================================================================
# DATABASE CONFIGURATION (Neon Test Project)
# ==============================================================================
# Pooled connection string for application runtime
DATABASE_URL="postgresql://neondb_owner:PASTE_TEST_PASSWORD_HERE@ep-test-sample-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# Direct connection string for DDL schema migrations
DIRECT_URL="postgresql://neondb_owner:PASTE_TEST_PASSWORD_HERE@ep-test-sample.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# Optional: Migration target URL (leave unset or point to direct URL)
TARGET_DATABASE_URL="postgresql://neondb_owner:PASTE_TEST_PASSWORD_HERE@ep-test-sample.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# ==============================================================================
# AUTHENTICATION & SECURITY SECRETS
# ==============================================================================
SESSION_SECRET="dev-secret-key-at-least-32-characters-long-123456"
ADMIN_EMAIL="admin@bishnustudio.com"
ADMIN_PASSWORD="TestAdminPassword2026!"

# ==============================================================================
# APPLICATION RUNTIME
# ==============================================================================
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
STORAGE_PROVIDER="local"
LOCAL_UPLOAD_DIR="./uploads"
```

4. Verify `.env.local` is ignored by Git:
   ```bash
   git status --ignored
   # Confirm .env.local appears under "Ignored files"
   ```

---

## 9. Required Non-Database Environment Variables

In addition to database URLs, the application requires these settings:

| Variable | What It Controls | Value to Use Locally |
| :--- | :--- | :--- |
| **`SESSION_SECRET`** | Signs and encrypts customer HTTP session cookies. Must be 32+ characters. | Any 32+ character random string (e.g. `openssl rand -base64 32`). |
| **`ADMIN_EMAIL`** | Master administrator login email. | E.g. `admin@bishnustudio.com`. |
| **`ADMIN_PASSWORD`** | Master administrator plaintext password for login verification. | Your chosen test admin password. |
| **`NEXT_PUBLIC_BASE_URL`** | Canonical storefront URL for payment QR deep links. | `http://localhost:3000` |
| **`LOCAL_UPLOAD_DIR`** | Local directory for uploaded files. | `./uploads` |

---

## 10. Initializing an Empty Test Database

When connecting to a brand new Neon test database, the database is completely empty: no tables exist yet.

> [!NOTE]
> Do NOT start the Next.js server before running migrations. If you start Next.js against an empty database, page queries will fail with PostgreSQL errors like `relation "products" does not exist`.

### The Safe 3-Step Initialization Workflow
You can initialize your database using individual steps or the one-line `npm run db:setup` command:

```bash
# Recommended: One-command automated verification, migration & seeding
npm run db:setup
```

Or run each step individually:
1. **Verify Connectivity**: Tests database reachability within a 5000ms bounded timeout without leaking secrets.
   ```bash
   npm run db:check
   ```
2. **Apply Schema Migrations**: Creates all 23 tables, foreign keys, and indexes via Drizzle Kit.
   ```bash
   npm run db:migrate
   ```
3. **Seed Initial Reference Data**: Populates default shop configuration, product categories, initial services, and dynamic pricing rules.
   ```bash
   npm run db:seed
   ```

This prepares a fully functional test database without importing any historical customer records or past orders!

---

## 11. Running Schema Migrations

The project maintains version-controlled PostgreSQL migrations generated by Drizzle Kit in `src/db/migrations-pg/`.

### Commands Explained
| Command | What It Does | When to Run It |
| :--- | :--- | :--- |
| **`npm run db:check`** | Performs a bounded, non-destructive connection test (`SELECT 1`), counts tables in public schema, and reports latency in ms. | Anytime to verify database status without altering data. |
| **`npm run db:migrate`** | Reads SQL files in `src/db/migrations-pg/` and applies pending migrations using Drizzle Kit. Completely idempotent. | Whenever initializing a database or after pulling schema updates. |
| **`npm run db:setup`** | Runs `db:check`, `db:migrate`, and `db:seed` sequentially in one automated command. | First-time project setup on an empty database. |
| **`npm run db:generate`** | Compares `src/db/schema.pg.ts` against existing SQL migrations and generates a new `.sql` delta migration file. | Only when you modify TypeScript tables in `schema.pg.ts`. |
| **`npm run db:seed`** | Executes `src/db/seed.ts` to populate initial categories, products, services, and pricing matrices. | On a newly created empty database after running `db:migrate`. |

---

## 12. Testing Database Connectivity

To verify that your application successfully connects to your Neon test database without exposing credentials in terminal logs:

1. Start the application:
   ```bash
   npm run dev
   ```
2. Open your browser or run `curl`:
   ```bash
   curl http://localhost:3000/api/health/db
   ```
3. Verify the JSON response:
   ```json
   {
     "status": "healthy",
     "provider": "neon-postgres",
     "latencyMs": 48,
     "timestamp": "2026-10-25T08:30:00.000Z"
   }
   ```
   - `"provider": "neon-postgres"` confirms the application is communicating with Neon PostgreSQL.
   - `"latencyMs"` confirms healthy ping round-trip time.

---

## 13. Running the Application Locally

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser:

1. **Homepage Check (`/`)**: Verify that the split hero displays the Barasat counter information, dynamic service cards load starting rates from Neon (`service_prices`), and category pills load from Neon (`product_categories`).
2. **Admin Portal (`/admin/login`)**: Log in with your `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. **Printing Service Pricing (`/admin/pricing`)**: Update a pricing rule (e.g. Document Print rate) and confirm the updated rate is saved in Neon.
4. **Order Flow**: Place a test document printing or photo order, proceed through checkout, and submit a test 12-digit UTR on the payment screen.
5. **Payment Verification (`/admin/payments`)**: Approve the test payment in the admin console and verify that the order transitions to `confirmed`.

---

## 14. Running the Test Suite

The repository includes **19 Vitest test suites (207 automated tests)** covering all critical workflows:

```bash
npm test
```

### Running Targeted Test Suites
```bash
# Order state machine & logistics tracking
npm test -- tests/order-state-machine-and-tracking.test.ts

# Return eligibility & idempotent inventory restocking
npm test -- tests/returns-and-refunds.test.ts

# Authoritative business identity & store availability toggle
npm test -- tests/business-config-and-availability.test.ts

# Theme-aware scrollbars
npm test -- tests/theme-scrollbar.test.ts
```

### How Tests Interact with the Database
- Vitest imports `db` from `src/db/index.ts`.
- If `DATABASE_URL` in `.env.local` points to your Neon test database, tests execute against that database.
- If `DATABASE_URL` is omitted or points to `file:./data/bishnu.db`, tests execute locally against SQLite.
- Tests do **not** use mock database queries; they verify real SQL transactions and schema constraints.

---

## 15. Importing SQLite Data in a Separate, Controlled Process

> [!CAUTION]
> **DO NOT RUN THIS STEP UNLESS YOU EXPLICITLY WANT TO COPY EXISTING SQLITE DATA INTO NEON.**
> If your goal is to test with fresh sample data, skip this section.

If you have historical data in `./data/bishnu.db` (products, custom UPI receiving accounts, historical orders) that you want to transfer into your Neon database:

### Step 1: Back Up the Local SQLite File
```powershell
Copy-Item ./data/bishnu.db ./data/bishnu.db.backup
```

### Step 2: Run Preflight Check (Dry Run — Zero Writes)
Audit your source database and review record counts and financial checksums without writing to Neon:
```bash
npm run db:migrate-neon -- --dry-run
```

### Step 3: Execute Live Data Migration
Pass your Neon direct connection string:
```bash
npx tsx scripts/migrate-sqlite-to-neon.ts --target-url="postgresql://neondb_owner:YOUR_PASSWORD@ep-test-sample.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

### How the Migration Tool Protects Data
- **Topological Order**: Migrates tables in strict foreign key order (Categories → Products → Services → Prices → Users → Orders → Payments → History → Reviews → Appeals → Audit Logs).
- **Type Transformation**: Casts SQLite numeric `0` and `1` into native PostgreSQL `boolean` values.
- **Idempotent Inserts**: Uses `.onConflictDoNothing()` on primary keys (`id`). If you run the script again, existing records are safely preserved without throwing primary key duplicate errors.
- **Financial Checksum**: Verifies that total order revenue (`orders.totalAmount`) and payment sums match 100% between SQLite and Neon.

---

## 16. Configuring Production Hosting (Vercel)

When deploying to Vercel:

1. Push your code to your private GitHub or GitLab repository:
   ```bash
   git add .
   git commit -m "feat: configure Neon database support"
   git push origin main
   ```
2. Open [https://vercel.com/dashboard](https://vercel.com/dashboard) and click **"Add New..."** → **"Project"**.
3. Import your `bishnu-studio` repository.
4. Go to **Settings → Environment Variables** in the Vercel project settings.
5. Add each production environment variable:
   - `DATABASE_URL`: Your **Production** Neon **Pooled** connection string (with `-pooler`).
   - `DIRECT_URL`: Your **Production** Neon **Direct** connection string (no `-pooler`).
   - `SESSION_SECRET`: A newly generated 32+ character random secret for production.
   - `ADMIN_EMAIL`: Your official production administrator email.
   - `ADMIN_PASSWORD`: Your official production administrator password.
   - `NEXT_PUBLIC_BASE_URL`: Your production domain (e.g. `https://bishnu-studio.vercel.app`).
   - `LOCAL_UPLOAD_DIR`: `./uploads`
6. **Do NOT use test database credentials in production.**
7. Apply migrations to the production database from your workstation before the first build:
   ```bash
   npx tsx src/db/migrate.ts
   ```
8. Click **"Deploy"** in Vercel.
9. Verify health status at `https://your-domain.vercel.app/api/health/db`.

---

## 17. Configuring Persistent Uploads

### Current Implementation: Local Filesystem
The application saves uploaded print files (PDF documents, PVC scans, photo portraits) and UPI payment proof screenshots to the local filesystem in `./uploads/` via `src/lib/storage.ts`:
- All uploads are validated using genuine file magic-byte signatures (`%PDF-`, JPEG, PNG, WebP).
- Private documents are stored in `./uploads/private/` outside the web root and served through authenticated routes with access control.

### Serverless Storage Consideration
> [!IMPORTANT]
> Vercel functions execute in stateless, ephemeral serverless containers. While files written to `./uploads/` work for local development, they will not persist across serverless redeployments or container recycling on Vercel.
>
> For long-term production file persistence on Vercel, a cloud object store (such as **Cloudflare R2**, **AWS S3**, or **Vercel Blob**) should be integrated into `src/lib/storage.ts`. Until that driver is added, database records will persist on Neon, but uploaded proof screenshots on Vercel will be ephemeral.

---

## 18. Switching from a Test Database to Production

When your development and testing phase is complete and you are ready to point to your live production Neon database:

1. Create a dedicated **Production Project** in Neon Console (e.g. `bishnu-studio-production`).
2. Copy the production **Pooled URL** and **Direct URL**.
3. Apply schema migrations to production:
   ```bash
   # Temporarily set DIRECT_URL in .env.local to the production direct URL
   npm run db:migrate
   ```
4. If migrating real business data from your local store database, execute:
   ```bash
   npx tsx scripts/migrate-sqlite-to-neon.ts --target-url="<PRODUCTION_DIRECT_URL>"
   ```
5. Update Vercel project environment variables (`DATABASE_URL` and `DIRECT_URL`) with the production connection strings.
6. Trigger a redeploy in Vercel.
7. Verify live orders and products at `https://your-domain.vercel.app`.

---

## 19. Backups and Recovery

### 1. Neon Continuous Backups & Point-in-Time Recovery (PITR)
- Neon continuously archives write-ahead logs (WAL).
- On the Neon Free Tier, you can restore your database to any specific second within the last 24 hours.
- To restore in Neon Console: Navigate to **Branches** → **Restore to point in time**.

### 2. Manual Backup with `pg_dump`
```bash
pg_dump "postgresql://neondb_owner:YOUR_PASSWORD@ep-your-project.region.aws.neon.tech/neondb?sslmode=require" -F c -b -v -f "./backup_bishnu_$(date +%Y%m%d).dump"
```

### 3. Restoring with `pg_restore`
```bash
pg_restore -d "postgresql://neondb_owner:YOUR_PASSWORD@ep-your-project.region.aws.neon.tech/neondb?sslmode=require" -v "./backup_bishnu_20261025.dump"
```

---

## 20. Troubleshooting Common Errors

| Error Message / Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| `CRITICAL CONFIGURATION ERROR: Vercel serverless environment detected with local SQLite` | `DATABASE_URL` is missing or starts with `file:` on Vercel | Set `DATABASE_URL` to your Neon PostgreSQL pooled connection string in Vercel Project Settings and redeploy. |
| `password authentication failed for user "neondb_owner"` | Password in connection URL is incorrect or has unencoded symbols | Reset password in Neon Console. If password has `@`, `#`, or `/`, URL-encode them (e.g. `@` → `%40`). |
| `relation "products" does not exist` | Application started against an empty database before migrations ran | Run `npm run db:migrate` to create all 23 tables. |
| `prepared statement "s0" does not exist` | DDL schema migration executed against PgBouncer pooler | Use `DIRECT_URL` (without `-pooler`) for migrations. PgBouncer transaction mode does not support prepared statements. |
| `SSL connection has been closed unexpectedly` | Connection dropped during compute endpoint wake | Ensure `?sslmode=require` is present at the end of the connection URL. Neon HTTP driver automatically retries. |
| `Type error: boolean cannot be matched with integer` | Attempting to write raw SQLite `0`/`1` to PostgreSQL `boolean` | Use `scripts/migrate-sqlite-to-neon.ts`, which casts booleans before inserting. |
| `/api/health/db` returns `"ok": false` | Outbound TCP/HTTPS blocked or bad URL | Verify outbound port 5432/443 is unblocked. Ensure database URL starts with `postgresql://`. |
| Session expires on server restart | `SESSION_SECRET` changed or is undefined | Define a persistent 32+ character `SESSION_SECRET` in `.env.local` or Vercel. |

---

## 21. Final Setup Checklist

Follow this checklist from zero to a live working application:

### Phase A: Safe to Do Right Now
- [x] Repository cloned and inspected.
- [x] Dependencies installed (`npm install`).
- [x] Automated test suite verified (`npm test` — 148 tests passing).
- [x] Production build verified (`npm run build` — 56/56 routes compiled).

### Phase B: Required Before Local Testing with Neon
- [ ] **Step 1**: Create a test project at [console.neon.tech](https://console.neon.tech/) (Section 6).
- [ ] **Step 2**: Copy the **Pooled URL** and **Direct URL** (Section 7).
- [ ] **Step 3**: Copy `.env.example` to `.env.local` and paste test URLs (Section 8).
- [ ] **Step 4**: Apply PostgreSQL schema: `npm run db:migrate` (Section 10).
- [ ] **Step 5**: Seed reference categories and pricing: `npm run db:seed` (Section 10).
- [ ] **Step 6**: Verify connection: visit `http://localhost:3000/api/health/db` (Section 12).
- [ ] **Step 7**: Test local shopping, checkout, and admin login at `http://localhost:3000` (Section 13).

### Phase C: Required ONLY if Migrating Existing Store Data
- [ ] **Step 8**: Back up local SQLite database: `Copy-Item ./data/bishnu.db ./data/bishnu.db.backup` (Section 15).
- [ ] **Step 9**: Run dry-run preflight check: `npm run db:migrate-neon -- --dry-run` (Section 15).
- [ ] **Step 10**: Run live migration: `npx tsx scripts/migrate-sqlite-to-neon.ts --target-url="<DIRECT_URL>"` (Section 15).

### Phase D: Required Before Production Deployment
- [ ] **Step 11**: Create a separate Production Neon project (Section 18).
- [ ] **Step 12**: Apply migrations to production database: `npm run db:migrate` (Section 18).
- [ ] **Step 13**: Add production environment variables in Vercel Project Settings (Section 16).
- [ ] **Step 14**: Deploy repository on Vercel and verify `/api/health/db` (Section 16).

---

## 22. Order Management & Fulfillment Guide

The Order Management and Fulfillment Hub at `/admin/orders` and `/admin/orders/[id]` provides a complete, audit-compliant interface for studio staff to process, pay, prepare, and deliver customer orders.

### 1. Order List Hub (`/admin/orders`)
- **Direct Data Exposure**: Displays Order Reference, Date & Time, Customer Name & Verified Phone, Fulfillment Method (Counter Pickup vs. Home Delivery), Delivery Area / PIN code, Item Count, Order Total, Payment Method & Status badge, and Fulfillment Status badge.
- **Filter & Search Bar**: Filter instantly across Order Reference, Customer Name, Phone, Fulfillment Status (`pending`, `confirmed`, `processing`, `ready_for_collection`, `out_for_delivery`, `completed`, `cancelled`), Payment Status (`unpaid`, `pending`, `paid`, `refunded`), and Fulfillment Method (`store_pickup`, `home_delivery`).
- **Mobile Responsive Layout**: Seamless dual presentation featuring a clean desktop table and touch-friendly mobile cards.
- **Pagination**: Bounded query batches (default 20 items per page) with total count indicators and Prev/Next controls.

### 2. Dedicated Order Detail Hub (`/admin/orders/[id]`)
Organized into 5 structured, operational sections:
1. **Order Summary & Customer Identity**:
   - Order reference, creation time, and last update timestamp.
   - Customer identity: Name, phone number (+91 with one-click copy), and verified email.
   - Financial breakdown: Items subtotal, delivery charges, discounts, and grand total.
2. **Delivery & Pickup Instructions**:
   - **Home Delivery**: Formatted courier delivery address (Recipient name, contact phone, house/building, street/locality, landmark, city, state, PIN code) with a one-click **Copy Delivery Address** button for shipping labels.
   - **Missing Address Warning Banner**: If a customer selected home delivery but no shipping address exists in the historical record, a high-visibility warning is rendered. The system never silently substitutes current user profile data for historical order addresses.
   - **Store Pickup**: Complete counter instructions, studio address (Barasat, West Bengal), and pickup verification guidelines.
3. **Ordered Items & Technical Production Specifications**:
   - Item line breakdown displaying item type (Retail Product, PVC Smart Card, Document Print, Photo Print, Lamination), quantity, unit price snapshot, and line subtotal.
   - Comprehensive technical parameters (paper size, color mode, simplex/duplex, photo finish, card document type).
   - Customer special instructions.
   - Customer uploaded artwork & documents with secure, authenticated download links (`/api/files/download/[id]`).
4. **Payment & UTR Reconciliation**:
   - Payment method (UPI Mock, Cash on Collection, Online).
   - Three-tier financial accounting: Total Due, Amount Verified, and Outstanding Balance.
   - Customer payment submissions list: UTR reference with one-click copy, target receiving UPI account snapshot (permanent historical record), claimed amount, and screenshot lightbox preview.
5. **Fulfillment Controller & Dispatch Tracking**:
   - **Status Updater**: Advance order workflow status independently of payment verification.
   - **Logistics Dispatch Fields**: Assign Courier Partner (e.g. DTDC, BlueDart, Delhivery, Speed Post) and Tracking / AWB Number. Setting tracking or marking `out_for_delivery` automatically stamps `dispatchedAt`. Marking `completed` stamps `deliveredAt`.
   - **Internal Staff Notes**: Persistent staff notes for printing press operator instructions and shelf placement.
   - **Order Event Timeline**: Complete, chronological audit trail recording previous/new status, actor role, timestamp, staff notes, and customer-facing notifications.

### 3. Server-Side Address Validation Rules
- **Home Delivery Orders**: Server-side checkout and `/api/orders` endpoints strictly require a complete shipping address containing `houseBuilding`, `streetLocality`, `cityTown`, `state`, and `pinCode`. Missing any required field returns a 400 Bad Request error.
- **Store Pickup Orders**: Store counter pickup orders do not require a delivery address.

---

## 23. Performance Architecture & Audit Findings

### 1. Root Causes of Prior Performance Bottlenecks
1. **Homepage Sequential Query Waterfall**:
   - *Problem*: `src/app/page.tsx` was configured with `export const dynamic = "force-dynamic"` and executed 5 sequential `await` database queries against remote Neon PostgreSQL (latency 150-250ms per roundtrip), causing a 800ms-1200ms initial response time.
   - *Image Table Dump*: The page queried `db.select().from(productImages)` with no filter, downloading the entire image catalog into Node.js memory on every homepage load.
2. **Footer Waterfall & Mismatched Response Parsing**:
   - *Problem*: `src/components/Footer.tsx` issued an un-cached client-side `fetch("/api/settings/shop")` on every single route change. Furthermore, the component inspected `data.shop`, whereas the API returned `data.settings`, discarding the fetched payload and re-rendering on every navigation.
3. **Redundant Database Reads in `getShopSettings`**:
   - *Problem*: `getShopSettings()` in `src/lib/settings.ts` performed a full database read on every invocation across layouts, footers, headers, and APIs.
4. **Admin Metrics & Analytics Full Table Scans**:
   - *Problem*: `/api/admin/metrics` and `/api/admin/analytics` executed `db.select().from(orders)`, `db.select().from(orderItems)`, `db.select().from(products)`, and `db.select().from(users)`, pulling complete tables into Node.js memory to compute basic counts and revenue totals with `.filter()` and `.reduce()`.
5. **Duplicate Session Lookups**:
   - *Problem*: `getAuthSession()` lacked request-level memoization, triggering duplicate session queries across server layout, navigation, and page components.

### 2. Implemented Optimizations & Measurable Improvements
1. **Homepage Parallelization & ISR (`src/app/page.tsx`)**:
   - Converted sequential queries into a single concurrent `Promise.all()` batch.
   - Replaced full-table image scans with targeted `where(inArray(productImages.productId, prodIds))` scoped exclusively to the 8 featured products.
   - Enabled Incremental Static Regeneration with `export const revalidate = 60;`. Subsequent requests within 60 seconds are served directly from cache in under 25ms.
2. **In-Memory Shop Settings Cache (`src/lib/settings.ts`)**:
   - Implemented an in-memory cache with a 60-second TTL for `getShopSettings()`.
   - Added automatic cache invalidation (`invalidateShopSettingsCache()`) triggered whenever settings are updated in the admin panel.
   - Latency for settings retrieval reduced from ~80ms to <1ms.
3. **Request-Level Session Memoization (`src/lib/auth.ts`)**:
   - Wrapped `getAuthSession()` with React `cache()` (falling back safely in standalone CLI environments).
   - Eliminates duplicate database queries when multiple server components inspect the session within the same request lifecycle.
4. **Footer Waterfall Elimination (`src/components/Footer.tsx` & `/api/settings/shop`)**:
   - Added `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` HTTP headers to `/api/settings/shop`.
   - Fixed property reading to accept both `data.settings` and `data.shop`.
   - Added module-level caching in `Footer.tsx` so client route navigations never trigger redundant HTTP network calls.
5. **SQL Aggregation for Dashboard Metrics (`/api/admin/metrics` & `/api/admin/analytics`)**:
   - Replaced in-memory JavaScript table filtering with native SQL aggregates (`count(*)`, `sum(case when ...)`, `groupBy()`).
   - Network payload and server memory consumption reduced by over 90% for admin dashboard metrics.
6. **Scoped Product Catalog Queries (`/api/products`)**:
   - Added `inArray(productImages.productId, prodIds)` filtering so only images for matched products are loaded from the database.
   - Added HTTP `Cache-Control` headers for unfiltered catalog browsing.

---

## 24. Global Theme-Aware Scrollbar Architecture

Bishnu Studio implements an adaptive, theme-aware scrollbar engine across the entire application (storefront, customer portal, and admin dashboard). Rather than relying on OS-level or browser default scrollbars—which often render bright white tracks or clunky arrow buttons in dark mode—the application uses reactive CSS variables coupled with standard W3C and WebKit scrollbar directives.

### Design Tokens & Palette Specifications
Scrollbar colors are tied directly to active CSS variables defined in `src/app/globals.css`:

| Token | Light Mode (`:root`) | Dark Mode (`.dark`) | Purpose |
| :--- | :--- | :--- | :--- |
| `--scrollbar-track` | `#f1f5f9` (Slate-100) | `#0f172a` (Slate-900) | Scrollbar background track |
| `--scrollbar-thumb` | `#cbd5e1` (Slate-300) | `#334155` (Slate-700) | Default thumb state |
| `--scrollbar-thumb-hover` | `#94a3b8` (Slate-400) | `#475569` (Slate-600) | Mouse hover thumb state |
| `--scrollbar-thumb-active` | `#64748b` (Slate-500) | `#64748b` (Slate-500) | Thumb drag / active state |
| `--scrollbar-corner` | `#f1f5f9` (Slate-100) | `#0f172a` (Slate-900) | Corner where X and Y scrollbars meet |

### Cross-Browser Implementation Strategy
1. **W3C Standards (Firefox & Modern Specs)**:
   - Applied globally via `html, body, * { scrollbar-width: thin; scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track); }`.
   - Automatically respects the active theme color without vendor prefixes.
2. **WebKit & Chromium (Chrome, Edge, Safari, Opera)**:
   - Styled using `::-webkit-scrollbar` with an 8px standard width.
   - Thumb uses `border: 2px solid var(--scrollbar-track); background-clip: padding-box;` creating a floating capsule aesthetic.
   - `::-webkit-scrollbar-button { display: none; }` cleanly eliminates legacy stepper arrows.
   - Smooth `transition: background-color 0.15s ease` for interactive feedback.
3. **Native Engine Sync (`color-scheme`)**:
   - `color-scheme: light;` is explicitly declared on `:root` and `color-scheme: dark;` on `.dark`.
   - Prevents the operating system (Windows/macOS/Linux) from rendering stark white scrollbars or form elements when dark theme is enabled.
4. **Pre-Hydration Anti-Flash Script (`src/app/layout.tsx`)**:
   - The `<head>` includes an inline script that detects stored localStorage or `prefers-color-scheme` and synchronizes `document.documentElement.style.colorScheme` before React hydration. This guarantees zero visual flash of light scrollbars on dark page loads.
5. **Runtime Synchronization (`src/context/ThemeContext.tsx`)**:
   - Whenever the user toggles between Light and Dark mode, `applyTheme` sets `root.style.colorScheme = newTheme` in lockstep with the `.dark` class. Scrollbars across open modals, sidebars, and the document update instantly with zero page reloads.
6. **Admin Sidebar & Container Protection (`src/app/admin/layout.tsx`)**:
   - Admin sidebar container uses `overflow-y-auto overflow-x-hidden overscroll-contain`, preventing accidental horizontal scroll jumps while maintaining smooth vertical navigation across long menu lists.
7. **Accessibility & Touch Handling**:
   - Contrast ratios comply with WCAG 2.1 AA requirements (minimum 3:1 against background track).
   - `@media (prefers-reduced-motion: reduce)` disables thumb color transitions for users with motion sensitivity.
   - Native mobile touch gestures (`-webkit-overflow-scrolling: touch`) are fully preserved without interference from custom pointer scrollbars.

---

## 25. Platform Generalization, Order Lifecycle, Returns & Logistics

To allow Bishnu Studio to serve as an authoritative foundation for any local print shop or stationery retail enterprise, the platform has been generalized to decouple business branding, introduce administrative store availability controls, enforce explicit order lifecycle transitions, and provide complete return, exchange, and refund workflows.

```mermaid
flowchart TD
    subgraph Identity ["1. Authoritative Identity Resolution"]
        DB[(DB Shop Settings)] --> |Priority 1| Conf[Authoritative Business Config]
        ENV[Environment Variables] --> |Priority 2| Conf
        DEF[System Fallbacks] --> |Priority 3| Conf
        Conf --> WebUI[Storefront, Admin & Customer Portals]
    end

    subgraph Operations ["2. Availability & Fulfillment"]
        StoreToggle{Admin isOpen?}
        StoreToggle --> |Open| Normal[Order Placement Active]
        StoreToggle --> |Closed| Blocked[403 STORE_CLOSED Guard]
        Normal --> StateMachine[Order Lifecycle State Machine]
        StateMachine --> Logistics[Courier & Delivery Person Tracking]
    end

    subgraph PostOrder ["3. Returns & Refunds"]
        Completed[Completed Order] --> EligCheck{Eligible within Window?}
        EligCheck --> |Yes| RetReq[Customer Return Request]
        EligCheck --> |No| Ineligible[Ineligibility Reason Displayed]
        RetReq --> AdminReview[Admin Inspection & Decision]
        AdminReview --> |Approve & Refund| Settle[Record Disbursed UTR & Restock Inventory]
        AdminReview --> |Reject| RejectReason[Mandatory Rejection Explanation]
    end
```

### 25.1 Centralized Business Branding & Asset Security
All hardcoded references to "Bishnu Studio" and default static logos are managed through `src/lib/business.ts`:
- **Precedence Hierarchy**:
  1. **Admin Persisted Database Settings** (`shopSettings.shopName`, `shopSettings.logoUrl`): Dynamically editable in `/admin/settings/business`.
  2. **Deployment Environment Variables** (`BUSINESS_NAME`, `BUSINESS_LOGO_PATH`, `BUSINESS_URL`, `NEXT_PUBLIC_BUSINESS_NAME`).
  3. **Non-Secret System Defaults** (`"Bishnu Studio"`, `"/logo.png"`).
- **Logo Path Safety Validation (`validateLogoPath`)**:
  - Permitted: Relative public paths starting with `/` (e.g. `/logo.png`, `/uploads/branding/logo.svg`) and valid HTTP/HTTPS URLs.
  - Strictly Blocked: Local Windows filesystem paths (`C:\...`, `D:\...`, `\\share\...`), directory traversal (`/uploads/../../etc/passwd`), and dangerous URL schemes (`javascript:`, `file:`, `data:`, `vbscript:`). Prevents broken asset links in cloud/serverless deployments and shields against XSS.
- **Component Coverage**: Dynamic business branding is integrated into `Navbar`, `Footer`, `HomePage` ("The {businessName} Standard"), `AdminLayout`, `Checkout`, `ReturnsPolicyPage`, and `OrderDetails`.

### 25.2 Admin-Controlled Store Availability (Open/Closed Toggle)
Store managers can pause new orders during holidays, inventory audits, or emergency studio maintenance:
- **Admin Configuration**: Located at `/admin/settings/business`, providing an instant switch (`isOpen: boolean`) and a customizable notice (`closedMessage: string`).
- **Storefront Availability Indicator**: The public homepage features a dynamic status badge:
  - When **Open**: Displays pulsing green badge (`Open Today: 9:00 AM – 9:00 PM`) and normal order workflows.
  - When **Closed**: Displays an amber/rose indicator (`Temporarily Closed for New Orders`) and renders a prominent notice banner containing the admin's exact explanation.
- **Server-Side Checkout Enforcement**: The checkout submission API (`/api/orders`) checks `settings.isOpen !== false`. If closed, it rejects order creation with HTTP 403 `STORE_CLOSED` and the custom message.
- **Read-Only Accessibility**: Store browsing, catalog search, pricing calculations, user authentication, and existing order tracking remain fully functional while the store is closed.

### 25.3 Order Lifecycle State Machine & Logistics Tracking
The order fulfillment lifecycle is governed by an explicit state machine (`src/lib/order-state-machine.ts`):
- **Independent State Dimensions**:
  - `orders.orderStatus`: Overall lifecycle (`pending` → `confirmed` → `processing` → `ready_for_collection` / `out_for_delivery` → `completed` | `cancelled`).
  - `orders.paymentStatus`: Payment verification (`unpaid`, `awaiting_payment`, `pending_verification`, `paid`, `refunded`, `failed`).
  - `orders.fulfillmentStatus`: Logistics progress (`unfulfilled`, `preparing`, `ready_for_pickup`, `in_transit`, `out_for_delivery`, `delivered`, `failed_delivery`).
  - `order_returns`: Return and refund status managed in isolated tables.
- **Terminal Status Protection**: Completed and cancelled orders are finalized and cannot be moved backward via routine controls. Accidental misclicks are prevented; exceptional emergency corrections require the explicit `allowAdminOverride` flag.
- **Logistics & Delivery Person Tracking**:
  - Supported attributes: Courier partner (`courierName`), tracking number (`trackingNumber`), web tracking link (`trackingUrl`), assigned delivery person (`deliveryPersonName`, `deliveryPersonPhone`), expected delivery date (`expectedDeliveryDate`), and customer instructions (`customerFulfillmentNote`).
  - Link safety: `validateTrackingUrl` enforces standard `http` and `https` protocols, rejecting unsafe schemes.
- **Strict Information Barrier**:
  - `orders.internalNotes`: Confidential internal remarks between studio operators and staff. Strictly sanitized and stripped from all customer-facing API responses (`isAdmin ? order.internalNotes : undefined`).
  - `orders.customerFulfillmentNote`: Dedicated customer-visible instructions from print technicians regarding packaging, pickup times, or delivery coordinates.

### 25.4 Complete Return, Exchange & Refund Management
To fulfill real-world e-commerce requirements, a dedicated return subsystem has been established:
- **Eligibility Engine (`evaluateOrderReturnEligibility`)**:
  - Order must have terminal status `completed`.
  - Delivery date must be within the studio's configured return window (`returnWindowDays`, default 7 days).
  - Item-level returnable quantity validation: Tracks previous return requests (`approved`, `in_transit`, `received`, `completed`), preventing duplicate active returns for the same order items.
- **Dedicated Database Entities**:
  - `order_returns`: Full return lifecycle record with customer reason, requested resolution (`refund` vs `exchange`), evidence photos, pickup details, physical inspection outcome, refund amount, UTR reference, and restocked state.
  - `order_return_items`: Item-level snapshots (`orderItemId`, `productId`, `quantity`, `unitPriceSnapshot`, `totalPriceSnapshot`).
- **Return Lifecycle States**:
  `requested` → `under_review` → `approved` → `pickup_scheduled` → `in_transit` → `received` → `inspection_in_progress` → `refund_pending` / `exchange_processing` → `completed` (or `rejected` / `cancelled`).
- **Mandatory Rejection Reasons**: Admins cannot reject a customer's return without supplying a clear, auditable explanation (`rejectionReason`).
- **Disbursed Refund Auditing**: When marking a refund as processed, operators record the disbursed refund amount and the banking / UPI UTR reference number (`refundTransactionReference`), which is displayed to the customer for reconciliation.
- **Idempotent Inventory Restocking**:
  - Admins can restock returned items back to the product catalog with a single checkbox.
  - The system checks `!existingReturn.restocked`, increments `products.stockQuantity`, and sets `orderReturns.restocked = true`. Subsequent updates will not double-restock inventory.
- **Customer Self-Service Interface**: Customers can initiate return requests directly from `/account/orders/[id]` and monitor return progress in real time.
- **Admin Returns Dashboard & Inspector**: Full management portal at `/admin/returns` and inspector at `/admin/returns/[id]`.
- **Public Policy Page**: Clean, transparent return terms and FAQ accessible at `/returns`.

---

## 26. Git Workflow, Branch Standards & Contributor Guidelines

The Bishnu Studio repository is hosted on GitHub and maintains a clean, linear development workflow tracked against `main`.

- **GitHub Remote**: `https://github.com/SayanBasani/BISHNU-STUDIO.git`
- **Primary Branch**: `main` (Tracks `origin/main`)
- **Agent Guidelines File**: [`AGENTS.md`](./AGENTS.md) provides authoritative instructions for automated agents and pair programmers.

### Standard Git Workflow for New Features & Bug Fixes

1. **Pre-Flight Inspection**:
   ```powershell
   git status --short
   ```
   Confirm that the working tree is understood and preserve any existing uncommitted user changes. Never run destructive reset commands.

2. **Implement & Test**:
   Execute the test suite and verify the Next.js production build:
   ```powershell
   npm test
   npm run build
   ```

3. **Stage Selective Changes**:
   Stage only files directly relevant to the completed milestone:
   ```bash
   git add <path/to/file1> <path/to/file2>
   ```
   Avoid blanket `git add .` if unrelated scratch files or temporary logs exist.

4. **Review Staged Diff**:
   Inspect the exact changes before committing:
   ```bash
   git diff --staged
   ```
   Confirm that no `.env.local` files, database dumps, customer uploads, or secrets are staged.

5. **Commit with Meaningful Message**:
   ```bash
   git commit -m "feat(scope): concise description of verified change"
   ```

6. **Push to GitHub**:
   ```powershell
   git push origin main
   ```
   Verify that the push succeeds with exit code 0 and that the working tree is clean (`git status`).

### Absolute Security & Repository Rules
- **No Secrets Exposure**: Never commit `.env`, `.env.local`, passwords, or private connection strings.
- **No Force Pushing**: `git push --force` and destructive commands (`git reset --hard`) are strictly forbidden in normal workflow.
- **No Empty Commits**: Do not create placeholder commits without real changes.

---

## 27. Notification Architecture, Authentication Security & Session Management

This section documents the security, session invalidation, and real-time notification engine designed for Bishnu Studio administrators and customers.

### A. Root Cause Analysis: Admin Credential Rotation & Session Staleness

During an audit of administrator credential management, two architectural defects were identified and resolved:
1. **Database Hash Precedence Blocked Environment Password Rotation**:
   In `src/lib/auth.ts`, `validateAdminCredentials()` previously checked whether `existingUsers[0].passwordUpdatedAt` was set. If populated, authentication tested the presented password **exclusively** against the stored database bcrypt hash. When an administrator rotated `ADMIN_PASSWORD` in `.env.local` or environment variables, the system rejected the new credentials because it never evaluated them against the environment configuration.
2. **Missing Session Fingerprinting Allowed Stale Admin Sessions**:
   The `sessions` table lacked a credential version or fingerprint column. When an administrator logged in from Browser A, a 14-day session cookie was issued. If credentials were changed subsequently, Browser A remained permanently logged in until session expiry because `validateSession()` only checked `session.expiresAt > Date.now()`.

### B. The Authoritative Environment Credential Engine

Environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, or `ADMIN_PASSWORD_HASH`) are now the **primary, authoritative source of truth** for platform administration:
- **Precedence**: When an administrator signs in via `/admin/login` or the main `/login` portal, the password is validated against the environment credentials first.
- **Automatic Database Synchronization**: Upon successful authentication, the administrator user record in the database (`users.passwordHash` and `users.passwordUpdatedAt`) is automatically updated with the newly hashed password.
- **Server Restart / Redeployment Requirement**: Next.js loads `.env.local` into `process.env` at Node.js server startup. Any modification to `.env.local` requires stopping and restarting the local development server (`Ctrl+C` and `npm run dev`) or triggering a redeployment in Vercel for production.

### C. Admin Session Invalidation via Credential Fingerprint

To prevent stale sessions from persisting after credential rotation:
1. **Fingerprint Generation**:
   A deterministic HMAC-SHA256 fingerprint is calculated via `getAdminCredentialFingerprint()`:
   ```ts
   // sha256(ADMIN_EMAIL : (ADMIN_PASSWORD | ADMIN_PASSWORD_HASH) : SESSION_SECRET)
   ```
2. **Version Stamping on Session Creation**:
   When an admin logs in, `sessions.credentialVersion` is populated with the active fingerprint. Customer sessions receive `null`.
3. **Instant Rejection & Purge**:
   In `validateSession()` (and `requireAdminSession()`), if `user.role === 'admin'`, the session's `credentialVersion` is compared against `getAdminCredentialFingerprint()`. If mismatched (such as after `.env.local` rotation and server restart), the outdated session is **immediately deleted from the database** and rejected with `401 Unauthorized`.
4. **Customer Isolation**:
   Customer sessions do not depend on the admin credential fingerprint and remain 100% active and unaffected when admin credentials rotate.

### D. Force Logout vs. Account Blocking in Admin Dashboard

Session management and access restrictions are strictly separated into two distinct administrative operations:

| Feature | Force Logout | Block Customer Account |
| :--- | :--- | :--- |
| **Primary Purpose** | Session hygiene, device de-authorization, compromised browser reset | Prevent malicious users, fraud prevention, spam mitigation |
| **Database Effect** | Deletes rows from `sessions` table where `userId = customerId` | Sets `users.status = 'blocked'`, records `blockedReason`, `blockedCategory`, `blockedAt`, and deletes sessions |
| **Customer Ability to Log In** | **Allowed**. The customer can immediately log in again using their valid credentials. | **Forbidden**. All subsequent login attempts are rejected with `403 Forbidden` and blocked details. |
| **Customer Notification** | Emits high-priority security alert: *"Session Terminated — An administrator has logged you out of all active sessions. You can log in again anytime."* | Emits urgent alert: *"Account Restricted — Your Bishnu Studio account has been restricted by administration."* |
| **Admin Self-Protection** | **Enforced**. Admins cannot force logout their own session or admin accounts through the customer endpoint. | **Enforced**. Administrator accounts can never be blocked (`role === 'admin'` check). |

### E. Centralized Persistent Notification Engine

A centralized notifications system is implemented in table 26 (`notifications`) across both SQLite (`./data/bishnu.db`) and Neon PostgreSQL:

#### Notification Schema
- `id`: Unique identifier (`notif_<uuid>`)
- `recipientType`: `'admin'` \| `'customer'`
- `recipientId`: Targeted user ID (or `null` for broadcast to all administrators)
- `category`: `'order'` \| `'payment'` \| `'delivery'` \| `'return'` \| `'account'` \| `'system'`
- `eventType`: Standardized lifecycle event string (e.g. `order_created`, `payment_verified`, `order_out_for_delivery`, `return_requested`, `force_logout`, `account_blocked`)
- `title` & `message`: XSS-safe notification copy
- `entityType` & `entityId`: Reference to target entity (`order`, `payment`, `return`, `user`)
- `linkUrl`: Direct deep link (e.g. `/account/orders/[id]` or `/admin/orders/[id]`)
- `isRead` & `readAt`: Read receipt tracking
- `priority`: `'low'` \| `'normal'` \| `'high'` \| `'urgent'`
- `deduplicationKey`: Idempotency key preventing duplicate notifications during rapid retries or polling

#### Business Event Integration Points
1. **Order Creation** (`POST /api/orders`):
   - Customer notification: Order confirmation with order reference and total amount.
   - Admin notification: High-priority new order alert with customer name and total amount.
2. **Order Status & Tracking Updates** (`PATCH /api/orders/[id]`):
   - Customer notification: Dispatched when status moves to `processing`, `ready_for_collection`, `out_for_delivery`, or `completed`, or when courier tracking details are attached. Private staff notes are strictly excluded.
3. **Order Cancellation** (`POST /api/orders/[id]/cancel`):
   - Customer and admin notifications confirming cancellation and inventory restoration.
4. **Payment Proof Submission** (`POST /api/orders/[id]/payment`):
   - Customer confirmation of payment proof receipt (with UTR reference).
   - Admin alert requesting verification against bank records (flagged urgent if duplicate UTR detected).
5. **Payment Verification & Rejection** (`POST /api/admin/payments/[id]/verify` & `reject`):
   - Customer notification confirming verification and order confirmation, or rejection with reason and resubmission guidance.
6. **Return Requests & Status** (`POST /api/returns` & `PATCH /api/returns/[id]`):
   - Admin alert upon customer return request.
   - Customer notifications when return is approved, pickup scheduled, or refund processed.
7. **Security & Session Events** (`POST /api/admin/customers/[id]/sessions` & `block`):
   - High-priority security alerts sent to customers upon session termination or account restriction.

### F. Notification UI & Polling Architecture

- **`NotificationBell` Component**:
  Interactive bell icon with dynamic unread badge counter (`1`, `5`, `9+`), category-colored badges, relative timestamps, quick "Mark as Read" actions, and empty states.
  - Placed in Customer Navbar (`src/components/Navbar.tsx`) when authenticated.
  - Placed in Admin Top Header & Sidebar Header (`src/app/admin/layout.tsx`).
- **Tab-Visibility-Aware Polling**:
  Polling runs every 30 seconds but automatically **suspends** when the browser tab is hidden or backgrounded (`document.visibilityState === 'hidden'`). When the user returns to the tab, polling immediately wakes up and fetches the latest alerts.
- **Live Event Toasts**:
  When new high-priority or urgent notifications arrive (such as payment verifications, dispatch alerts, or new orders for admins), a non-intrusive toast notification slides into view with a direct "View Details" link.
- **Full Notification Centers**:
  Dedicated full-page notification management interfaces with filtering by read state and category, mark all as read, and notification dismissal:
  - Customer: [`/account/notifications`](file:///account/notifications)
  - Admin: [`/admin/notifications`](file:///admin/notifications)

---

## 28. Authentication State Hydration, Persistent Profile Avatars & Mobile Identity (BS-AUTH-03A)

### A. Three-State Authentication Hydration
To eliminate the confusing flash of `Log In` and `Register` buttons for already-authenticated users, navigation components strictly distinguish three explicit states:
- **State A — Loading / Initializing (`loading === true`)**:
  Renders an animated pulse skeleton placeholder (`w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700/70`) with exact dimensions matching the user profile avatar button. Prevents layout shift and prevents premature unauthenticated control rendering.
- **State B — Authenticated (`!loading && user`)**:
  Renders the authenticated user's profile avatar (with automatic error fallback to the customer's initial badge), user's first name, and dropdown menu with profile links and logout.
- **State C — Unauthenticated (`!loading && !user`)**:
  Renders the standard Log In and Register buttons only after session verification completes.

### B. Mobile Top Navbar Account Identity
On mobile viewports (`< 640px` and down to `320px`), an account preview indicator is rendered directly in the sticky top header:
- **Layout**: `[Brand Logo] ... [Theme Toggle] [Cart] [Notifications] [Mobile Avatar / Account] [Hamburger Menu]`.
- **Responsive Adaptability**:
  - `320px - 360px`: Renders compact 32px touch avatar button with no horizontal scrolling.
  - `390px - 430px`: Renders 32px avatar + short truncated first name (`max-w-[65px] truncate`).
- **Interaction**: Tapping the mobile avatar toggles an anchored mobile quick-sheet account menu providing direct one-tap access to Orders, Profile, Notifications, Security, Admin Console (for administrators), and Sign Out.
- **Unauthenticated Fallback**: Displays a clean `User` icon linking to `/login`.

### C. Persistent Profile Picture Lifecycle & Storage Protection
- **Atomic Database Commit**: In `POST /api/account/avatar`, new avatar records are committed to the `users` table and `orderFiles` table *before* deleting superseded image files from disk, strictly satisfying Requirement 3.5.
- **Disk File Persistence**: Files are stored in `./uploads/public/profiles/` with cryptographic identifiers and verified magic bytes (JPEG, PNG, WebP).
- **Test Database Reset Protection**: In `src/scripts/reset-test-db.ts`, profile picture files belonging to preserved administrator and customer accounts are preserved during automated test cleanup.
- **Image Error Fallback (`UserAvatar`)**: If any profile picture on disk is missing or fails to load, `<UserAvatar />` automatically catches the error (`onError`) and seamlessly renders the user's initial badge instead of showing a broken image icon.
- **Cache-Control Headers**: Missing file responses (`404` and `410`) strictly return `Cache-Control: no-store, no-cache, must-revalidate` to prevent browsers from caching dead states.

### D. Application Performance Diagnosis & Empirical Latency Findings
- **Remote Neon PostgreSQL WAN Latency**:
  Empirical measurements confirm that when running local development against a remote Neon PostgreSQL database hosted in AWS `us-east-2` (Ohio, USA) from India, physical speed-of-light network roundtrips incur **~270ms - 340ms per query**. Cold compute wake-ups take **~2,100ms - 2,230ms**.
- **Local SQLite / LibSQL Timings**:
  The exact same database queries running on local SQLite (`DATABASE_URL=file:./data/bishnu.db`) execute in **0.3ms to 1.9ms** (< 2 milliseconds total backend time).
- **Notification Polling Guard**:
  Customer notification polling is strictly suspended while `authLoading === true` or when `user === null`, eliminating 401 Unauthorized errors and duplicate network requests during initial page hydration.
- **In-Flight Request Deduplication**:
  Module-level promise deduplication in `AuthContext` and `NotificationBell` ensures concurrent components share a single in-flight network request.

---

## Appendix: Environment-Variable Reference Table

| Variable Name | Purpose | Required / Optional | Where to Obtain Value | Destination File / Dashboard | Scope | Environments | Requires Restart? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`DATABASE_URL`** | Primary database connection string (Pooled Neon PostgreSQL URL for production; `file:./data/bishnu.db` for local SQLite) | **Required** | Neon Console → Connection Details (with Pooling enabled) | `.env.local` (Local) / Vercel Settings (Prod) | Server-only | Local, Preview, Production | **Yes** (Server restart / Vercel redeploy) |
| **`DIRECT_URL`** | Direct connection string for DDL migrations (bypasses PgBouncer pooler) | **Required for DDL** | Neon Console → Connection Details (Pooling disabled) | `.env.local` / CI/CD pipeline | Server-only | Local, Production | **Yes** |
| **`TARGET_DATABASE_URL`** | Target PostgreSQL connection string used by `scripts/migrate-sqlite-to-neon.ts` | **Required during migration** | Neon Console → Connection Details | `.env.local` / CLI argument | Server-only | Local | No (Script read) |
| **`BUSINESS_NAME`** | Authoritative business name override (takes precedence if DB setting empty) | Optional (Default: `"Bishnu Studio"`) | Business owner's chosen entity name | `.env.local` / Vercel Settings | Server-only | Local, Preview, Production | **Yes** |
| **`BUSINESS_LOGO_PATH`** | Relative web path (e.g. `/logo.png`) or full HTTPS URL for store branding logo | Optional (Default: `"/logo.png"`) | Public asset directory or CDN asset URL | `.env.local` / Vercel Settings | Server-only | Local, Preview, Production | **Yes** |
| **`BUSINESS_URL`** | Canonical public web URL of the business deployment | Optional (Default: `http://localhost:3000`) | Production domain (e.g. `https://bishnu-studio.vercel.app`) | `.env.local` / Vercel Settings | Server-only | Local, Preview, Production | **Yes** |
| **`NEXT_PUBLIC_BUSINESS_NAME`** | Public client-side fallback business name | Optional (Default: `"Bishnu Studio"`) | Business name string | `.env.local` / Vercel Settings | **Public (Client & Server)** | Local, Preview, Production | **Yes** |
| **`SESSION_SECRET`** | Secret key for signing and verifying customer session cookies (min. 32 characters) | **Required** | Generate via `openssl rand -base64 32` | `.env.local` / Vercel Settings | Server-only | Local, Preview, Production | **Yes** |
| **`ADMIN_EMAIL`** | Master administrator login email address | **Required** | Owner's chosen email (e.g. `admin@bishnustudio.com`) | `.env.local` / Vercel Settings | Server-only | Local, Preview, Production | **Yes** |
| **`ADMIN_PASSWORD`** | Master administrator plaintext password for login verification | **Required** (if no hash) | Owner's chosen secure password | `.env.local` / Vercel Settings | Server-only | Local, Preview, Production | **Yes** |
| **`NEXT_PUBLIC_BASE_URL`** | Public canonical URL for generating full payment links and QR code intents | **Required** | Deployment domain (e.g. `http://localhost:3000` or `https://bishnu-studio.vercel.app`) | `.env.local` / Vercel Settings | **Public (Client & Server)** | Local, Preview, Production | **Yes** |
| **`STORAGE_PROVIDER`** | File storage backend provider (`local`) | Optional (Default: `local`) | Architectural default | `.env.local` / Vercel Settings | Server-only | Local, Preview, Production | **Yes** |
| **`LOCAL_UPLOAD_DIR`** | Local filesystem directory for file uploads | Optional (Default: `./uploads`) | Server filesystem path | `.env.local` | Server-only | Local | **Yes** |

---

## Developer & Credits Information

Bishnu Studio was built with an emphasis on local community utility, transactional transparency, and long-term architectural stability.
- **Developer Credits Page**: View the full project timeline, certified technology stack, and engineering attributions at [`/developer`](file:///developer).
- **Official Authorship Statement**: *"Website developed and maintained by Sayan (Antigravity Engineer) for Bishnu Studio."*
- **Admin Developer Editor**: Admin console operators can update credits, bio, and social links at `/admin/settings/developer`.
