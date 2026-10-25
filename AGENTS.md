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
2. **Dual-Database Parity**:
   Any database schema modification must be mirrored across both:
   - `src/db/schema.sqlite.ts` (SQLite / LibSQL)
   - `src/db/schema.pg.ts` (PostgreSQL / Neon)
   - Exported through `src/db/schema.ts`
   - Reflected in data migrators (`scripts/migrate-sqlite-to-neon.ts`) and reset utilities (`src/scripts/reset-test-db.ts`).
3. **Confidentiality & Information Barriers**:
   - `orders.internalNotes` and `orderReturns.internalNotes` are confidential internal staff remarks. They must never be leaked to customer-facing APIs (`isAdmin ? record.internalNotes : undefined`).
   - Customer-visible fulfillment instructions belong in `customerFulfillmentNote` or `customerInstructions`.
4. **Asset & Input Security**:
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
