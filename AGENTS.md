# BISHNU STUDIO — AGENT & CONTRIBUTOR CODING GUIDELINES

This document establishes permanent operating rules, quality standards, and Git workflow requirements for all AI agents, pair programmers, and engineers working in this repository.

---

## 1. Environment & Workspace Context

- **Repository Root**: `C:\dev\Antigravity\bishnu-studio`
- **Default Shell**: PowerShell (Windows). Note that subshell processes and tool executions run in isolated sessions. Always set working directory using `Set-Location 'C:\dev\Antigravity\bishnu-studio'` or execute commands directly from the repository root.
- **Remote Origin**: `https://github.com/SayanBasani/BISHNU-STUDIO.git`
- **Primary Branch**: `main` (Tracks `origin/main`)
- **Dual Database Architecture**: 
  - Neon Serverless PostgreSQL (`src/db/schema.pg.ts`, migrations in `src/db/migrations-pg/`)
  - Local SQLite fallback (`src/db/schema.sqlite.ts`, migrations in `src/db/migrations/`, local file `data/bishnu.db`)
  - Shared table exports in `src/db/schema.ts`

---

## 2. Mandatory Pre-Flight Discipline (Before Editing)

1. **Check Working Tree**:
   Always execute `git status --short` before inspecting code or making changes. Confirm the baseline state of the repository.
2. **Preserve User Modifications**:
   Never discard, overwrite, or revert existing user modifications. If uncommitted work is present, work incrementally alongside it or ask for guidance if conflicts arise. Never run `git checkout .`, `git restore .`, or `git reset --hard` without explicit user instruction.
3. **Inspect Real Files**:
   Inspect actual file paths, schemas, routes, and components before writing code. Do not assume or invent non-existent APIs or libraries.

---

## 3. Implementation & Architecture Rules

1. **Production-Grade Implementation**:
   Implement genuine, complete full-stack logic. Never leave placeholder stubs, mock data where real database persistence is expected, or incomplete "TODO" comments in critical paths.
2. **Permanent Dual-Database Parity Protocol (Neon-First & Complete Parity)**:
   Every existing and future feature MUST be designed and implemented for both database engines from inception. No feature may work only on Neon while silently failing on SQLite, or vice versa:
   - **Schema Parity Checklist**:
     1. Add schema definition to `src/db/schema.sqlite.ts` using `drizzle-orm/sqlite-core`.
     2. Add identical schema definition to `src/db/schema.pg.ts` using `drizzle-orm/pg-core`.
     3. Export dynamic proxy in `src/db/schema.ts` (`createTableProxy(pgTable, sqTable)`).
     4. Generate and verify SQLite migration in `src/db/migrations/`.
     5. Generate and verify PostgreSQL migration in `src/db/migrations-pg/`.
     6. Update `scripts/migrate-sqlite-to-neon.ts` with table dependency order.
     7. Update test reset scripts (`src/scripts/reset-test-db.ts`).
     8. Verify foreign keys, indexes, uniqueness, and column defaults.
     9. Test queries with both drivers (`@libsql/client` and `@neondatabase/serverless`).
     10. Run automated tests verifying both engines.
   - **Application-Level Compatibility**: Ensure query syntax, joins, transactions, JSON serialization, timestamp handling (`Date.now()` vs `now()`), and boolean flags execute identically under both drivers.
   - **Production Default**: Neon PostgreSQL is the authoritative production database. Mode C (Local Development / SQLite) is strictly prohibited from running in production or on Vercel.
3. **Permanent File Storage & Customer Privacy Protocol (BS-FINAL-06)**:
   - **Storage Abstraction**: All file uploads, downloads, and deletions must route through the provider-independent storage abstraction (`src/lib/storage/index.ts`).
   - **Cloud Object Storage (Cloudflare R2)**: Production cloud uploads use Cloudflare R2 via official AWS S3 SDK (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`). Local disk (`./uploads/`) is retained for offline development.
   - **Strict Privacy Boundary**:
     - *Public assets*: Product catalog images and avatars (if public) may be delivered via CDN/public URLs.
     - *Private customer documents*: PVC cards, Aadhaar/identity documents, PDF prints, photos, payment screenshots, and refund payout receipts must NEVER be exposed via public bucket URLs.
     - *Authorization Check*: All private files must be requested through `/api/files/download/[fileId]` which strictly enforces authorization: uploader (`fileRecord.uploadedByUserId === auth.user.id`), order customer (`order.customerId === auth.user.id`), or admin/staff (`role === "admin" || role === "staff"`).
   - **Cryptographic Keys & Path Traversal Prevention**: Storage keys must be generated using randomized UUIDs (`fil_${uuid}_${hex}.${ext}`). Never use client-supplied filenames as storage keys. Sanitize filenames and reject path traversal characters (`..`).
   - **Orphan File Cleanup**: If database metadata insertion fails after an upload, immediately delete the uploaded object from storage.
   - **Non-Destructive Migration**: Migrating files from local disk to R2 (`scripts/migrate-uploads-to-cloud.ts`) must never delete local files until verification is complete.
4. **Permanent Transactional Outbox & Synchronization Protocol (BS-FINAL-06)**:
   - **Mode B Outbox Coverage**: In `emergency_fallback` mode (Mode B), every mutating operation on business entities (`orders`, `order_items`, `payments`, `payment_submissions`, `order_returns`, `order_return_items`, `products`, `users`, `user_addresses`, `order_files`) MUST queue an event to `db_sync_outbox` in the same database transaction via `recordMutationIfInFallback()`.
   - **Strict Allowlist**: `TABLE_FIELD_ALLOWLIST` strictly enforces allowed tables and fields. Arbitrary SQL tables or unmapped properties are rejected.
   - **Dependency Replay Priority**: Outbox replay to Neon must strictly follow foreign-key dependency order (`ENTITY_REPLAY_PRIORITY`: users &rarr; categories &rarr; products &rarr; orders &rarr; items &rarr; files &rarr; payments &rarr; returns).
   - **Non-Blind Conflict Detection**:
     - *Orders*: An order verified as `paid` in Neon must NEVER be downgraded. Terminal states (`delivered`, `cancelled`, `completed`) cannot be reverted.
     - *Payments*: Verified or paid payment records must not be overwritten.
     - *Refunds*: Confirmed payout records with transaction references must not be downgraded.
   - **Replay Idempotency & Lock**: Target database inserts check for existing records by ID to safely absorb duplicate deliveries. A concurrency lock (`isSynchronizationLocked()`) prevents racing workers.
5. **Confidentiality & Information Barriers**:
   - `orders.internalNotes` and `orderReturns.internalNotes` are confidential internal staff remarks. They must never be leaked to customer-facing APIs (`isAdmin ? record.internalNotes : undefined`).
   - Customer-visible fulfillment instructions belong in `customerFulfillmentNote` or `customerInstructions`.
6. **Asset & Input Security**:
   - Validate logo URLs and courier tracking links with `validateLogoPath` and `validateTrackingUrl` (`src/lib/business.ts`, `src/lib/order-state-machine.ts`).
   - Strictly prohibit Windows filesystem paths (`C:\...`, `D:\...`), directory traversal (`..`), and unsafe URI schemes (`javascript:`, `file:`, `data:`).

---

## 4. Verification & Testing Standards

1. **Run Relevant Tests on Every Significant Change**:
   Execute the automated test suite to ensure zero regressions:
   ```powershell
   Set-Location 'C:\dev\Antigravity\bishnu-studio'
   npm test
   ```
   Or run targeted test files:
   ```powershell
   npm test -- tests/order-state-machine-and-tracking.test.ts
   npm test -- tests/returns-and-refunds.test.ts
   npm test -- tests/business-config-and-availability.test.ts
   ```
2. **Verify Production Build**:
   Before finalizing a milestone, run:
   ```powershell
   npm run build
   ```
   Confirm that all Next.js routes, TypeScript types, and server components compile cleanly with zero errors.
3. **Honesty in Reporting**:
   Never invent test results or claim a check passed unless the command executed with exit code 0.

---

## 5. Staging, Commit & Diff Review Protocol

1. **Review Diff Before Staging**:
   Inspect what changed using `git status` and `git diff`.
2. **Stage Selectively**:
   Stage only the files directly related to the completed feature or bugfix:
   ```bash
   git add <path/to/file1> <path/to/file2>
   ```
   Avoid indiscriminate `git add .` if unrelated scratch files or temporary logs exist.
3. **Review Staged Changes**:
   Verify staged content using:
   ```bash
   git diff --staged
   ```
   Ensure no unintended debug logs, commented-out dead code, or secrets are staged.
4. **Meaningful Commit Messages**:
   Use clear, conventional commit messages describing the actual milestone achieved:
   - `feat(returns): add customer return self-service and admin inspection dashboard`
   - `fix(theme): resolve theme-aware scrollbar contrast in dark mode`
   - `chore(git): establish agent workflow rules and airtight gitignore`
5. **No Empty Commits**:
   Never create empty commits (`--allow-empty`). Commit only when substantive, verified changes exist.

---

## 6. Push & Remote Tracking Protocol

1. **Push Significant Completed Milestones**:
   Once a feature, bugfix, or milestone is fully tested and committed, push to the remote tracking branch:
   ```powershell
   git push origin main
   ```
2. **Verify Push Success**:
   Confirm that the push completed with exit code 0 and that local `main` is up to date with `origin/main`:
   ```powershell
   git status
   ```
3. **No Force Pushing or Destructive Commands**:
   - Never use `git push --force` or `git push --force-with-lease` to resolve ordinary merge conflicts or rejected pushes.
   - Destructive Git operations (`git reset --hard`, `git clean -fdx`, rewriting history) are strictly prohibited for routine tasks.
   - If a push is rejected, inspect remote status using `git fetch` and `git log ..origin/main` to diagnose cleanly.

---

## 7. Data Hygiene & Zero Secrets Leakage

1. **Never Commit Secrets**:
   - Never commit `.env`, `.env.local`, `.env.production`, or any file containing real passwords, database connection strings, or session secrets.
   - Ensure `.env.example` contains only non-secret placeholders (`USER:PASSWORD@ep-your-project...`).
2. **Never Commit Private Data**:
   - Never stage SQLite database files (`data/*.db`, `data/*.sqlite*`).
   - Never stage customer-uploaded documents, identity card scans, or payment proof screenshots (`uploads/*`).
   - Keep `.gitignore` strictly maintained and verified.
3. **Report Exposure Safely**:
   If an accidental secret exposure is ever detected in local files, report it clearly to the user without printing or logging the actual secret value.

---

## 8. Permanent Mandatory Post-Task Reporting Standard

After completing every implementation task, the agent MUST structure its final report using the following mandatory sections in clear, beginner-friendly language:

### 1. What was the problem?
Explain the original issue or requirement in plain, accessible terms without jargon.

### 2. What did you change?
Provide a comprehensive list of:
- Files created
- Files modified
- Files deleted (if any)
- Database schemas / migrations changed
- API routes updated
- UI components modified
For each important file, explain what was changed and why.

### 3. Visual changes
Explain explicitly what the user or administrator will see differently on desktop, tablet, and mobile screens. If there are no visual changes, state so explicitly.

### 4. Functional/actionable changes
Explain what new actions users and administrators can now perform and what new behaviors are enabled.

### 5. What should I manually test?
Provide concrete, step-by-step instructions that the user can follow in the browser:
- Page or URL to open
- Buttons or interactions to trigger
- Expected visible result
- Indicators that would signal a failure

### 6. Performance report
Always include actual measurements:
- Request timings and correlation IDs
- Measured backend stage durations (authentication, database queries, storage, serialization)
- In-flight request deduplication improvements
- Query count observations

### 7. Automated test results
List actual commands executed and results, clearly distinguishing:
- PASSED
- FAILED
- NOT RUN
- BLOCKED

### 8. GitHub synchronization
Report:
- Commit message
- Commit SHA
- Branch name
- Remote push status
- Final working-tree cleanliness

### 9. Remaining problems
List any incomplete work, known limitations, or items requiring manual user configuration. Never conceal incomplete work.

### 10. Future work suggestions
Highlight relevant next steps and improvements directly related to the task.

