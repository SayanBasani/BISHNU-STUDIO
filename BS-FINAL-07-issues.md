# BS-FINAL-07 — Issues Diagnosis, Mutation Coverage & Resolution Report

**Project:** Bishnu Studio  
**Workspace:** `C:\dev\Antigravity\bishnu-studio`  
**Date:** October 31, 2026  

---

## 1. Discovered Issues & Resolutions

### Issue 1: Production Ephemeral Storage Guard (Critical)
- **Severity**: Critical (Data Loss Prevention)
- **Files Affected**: [`src/lib/storage/index.ts`](file:///C:/dev/Antigravity/bishnu-studio/src/lib/storage/index.ts), [`src/app/api/files/upload/route.ts`](file:///C:/dev/Antigravity/bishnu-studio/src/app/api/files/upload/route.ts), [`src/app/api/account/avatar/route.ts`](file:///C:/dev/Antigravity/bishnu-studio/src/app/api/account/avatar/route.ts)
- **Symptom**: In production (`NODE_ENV === 'production'` or `VERCEL === '1'`), if `STORAGE_PROVIDER` was `local` or if Cloudflare R2 initialization failed, the system fell back to local disk storage (`./uploads/`). On stateless Vercel serverless containers, local files vanish when micro-VM containers recycle, causing permanent loss of customer PVC documents, photo prints, PDF documents, UPI screenshots, and refund payout proofs.
- **Root Cause**: The storage selector fell back unconditionally to `LocalStorageAdapter` on any R2 error without checking if the runtime environment was ephemeral production.
- **Resolution**: Updated `src/lib/storage/index.ts`:
  1. In `getStorageAdapter`, if in production and R2 initialization fails, it throws `CRITICAL_STORAGE_ERROR` instead of silently falling back to local disk.
  2. In `saveFileToStorage`, if in production and `STORAGE_PROVIDER !== 'r2'`, it strictly rejects saving customer files with `CRITICAL_STORAGE_ERROR`.
  3. Upload routes now return descriptive 500 error messages if cloud storage is unconfigured in production.
  4. Local development and offline testing continue to use `LocalStorageAdapter` seamlessly.
- **Status**: **RESOLVED & VERIFIED** (Tested in `tests/storage-cloud-and-local.test.ts`).

---

### Issue 2: Mode B Fallback Transactional Outbox Gaps
- **Severity**: High (Disaster Recovery & Data Durability)
- **Files Affected**:
  - [`src/lib/db-sync.ts`](file:///C:/dev/Antigravity/bishnu-studio/src/lib/db-sync.ts)
  - [`src/app/api/admin/products/route.ts`](file:///C:/dev/Antigravity/bishnu-studio/src/app/api/admin/products/route.ts)
  - [`src/app/api/admin/products/[id]/route.ts`](file:///C:/dev/Antigravity/bishnu-studio/src/app/api/admin/products/[id]/route.ts)
  - [`src/app/api/admin/categories/route.ts`](file:///C:/dev/Antigravity/bishnu-studio/src/app/api/admin/categories/route.ts)
  - [`src/app/api/admin/categories/[id]/route.ts`](file:///C:/dev/Antigravity/bishnu-studio/src/app/api/admin/categories/[id]/route.ts)
  - [`src/app/api/orders/[id]/cancel/route.ts`](file:///C:/dev/Antigravity/bishnu-studio/src/app/api/orders/[id]/cancel/route.ts)
  - [`src/app/api/returns/[id]/route.ts`](file:///C:/dev/Antigravity/bishnu-studio/src/app/api/returns/[id]/route.ts)
  - [`src/app/api/returns/[id]/dispute/route.ts`](file:///C:/dev/Antigravity/bishnu-studio/src/app/api/returns/[id]/dispute/route.ts)
  - [`src/lib/settings.ts`](file:///C:/dev/Antigravity/bishnu-studio/src/lib/settings.ts)
  - [`src/app/api/account/addresses/route.ts`](file:///C:/dev/Antigravity/bishnu-studio/src/app/api/account/addresses/route.ts)
  - [`src/app/api/account/addresses/[id]/route.ts`](file:///C:/dev/Antigravity/bishnu-studio/src/app/api/account/addresses/[id]/route.ts)
- **Symptom**: Mutations made while operating in Mode B (`emergency_fallback`) on categories, product updates, order cancellations, return status changes, refund payout confirmations, store settings, or customer addresses were not recorded in `db_sync_outbox`. When synchronizing back to Neon Primary, these operations were lost.
- **Root Cause**: `recordMutationIfInFallback()` was only wired to order checkout, payment submissions, payment verification, return creation, and inventory stock adjustments.
- **Resolution**:
  1. Expanded `TABLE_FIELD_ALLOWLIST` and `ENTITY_REPLAY_PRIORITY` in `src/lib/db-sync.ts` to include `shop_settings`, `shop_upi_accounts`, `order_status_history`, `product_reviews`, and `account_appeals`.
  2. Wired `recordMutationIfInFallback()` into all mutating operations listed above.
- **Status**: **RESOLVED & VERIFIED** (Tested in `tests/outbox-transaction-and-recovery.test.ts`).

---

### Issue 3: Distributed Control-Plane Safety on Vercel
- **Severity**: Medium (Multi-Instance Operational Consistency)
- **Files Affected**: [`src/lib/db-provider.ts`](file:///C:/dev/Antigravity/bishnu-studio/src/lib/db-provider.ts)
- **Symptom**: On Vercel serverless hosting, changing operating modes via the admin UI writes only to the ephemeral `data/db-control-plane.json` of that single micro-VM. Other serverless invocations to different containers would not see the mode switch. Additionally, if `DATABASE_OPERATING_MODE` was explicitly set in environment variables, UI mode switches were immediately ignored on subsequent requests.
- **Root Cause**: Absence of distributed coordination for file-based state across stateless serverless instances.
- **Resolution**:
  1. Updated `switchOperatingMode` to reject mode switching if `DATABASE_OPERATING_MODE` is pinned in environment variables, requiring explicit coordination through Vercel environment variables.
  2. Added serverless notices to API responses explaining that on Vercel, persistent cross-instance operating mode configuration requires `DATABASE_OPERATING_MODE`.
- **Status**: **RESOLVED & VERIFIED** (Tested in `tests/dual-database-provider-and-sync.test.ts`).

---

### Issue 4: Test Suite TypeScript Type Check Failures
- **Severity**: Low (Developer Experience & Build Reliability)
- **Files Affected**: 10 test files in `tests/`
- **Symptom**: `npx tsc --noEmit` failed with ~15 TypeScript type mismatch errors due to mock database insert fixtures using un-cast literals for Drizzle ORM enum fields and direct mutation of `process.env.NODE_ENV`.
- **Root Cause**: Drizzle ORM's SQLite builder strictly types `.values()` against table insert types, while test fixtures used generic strings or assigned read-only process environment variables.
- **Resolution**: Corrected test fixture typings with explicit literal casts (`as any` or enum values) and safe environment variable assignment.
- **Status**: **RESOLVED & VERIFIED** (`npx tsc --noEmit` exits with 0).

---

## 2. Complete Mode B Mutation Coverage Table

| Mutation Operation | Endpoint / Function | Target Entity | Mode B Outbox Recorded | Transaction-Safe | Idempotent Target Replay | Tested & Verified |
|---|---|---|---|---|---|---|
| **Customer Registration** | `POST /api/auth/register` | `users`, `user_addresses` | **YES** | Atomic | Yes (Key Lookup / Merge) | `tests/auth.test.ts` |
| **Product Creation** | `POST /api/admin/products` | `products`, `product_images` | **YES** | Atomic | Yes (Key Lookup / Merge) | `tests/orders-fit-pagination-inventory-products.test.ts` |
| **Product Update** | `PUT /api/admin/products/[id]` | `products` | **YES** | Atomic | Yes (Key Lookup / Update) | `tests/orders-fit-pagination-inventory-products.test.ts` |
| **Category Creation** | `POST /api/admin/categories` | `product_categories` | **YES** | Atomic | Yes (Key Lookup / Merge) | `tests/outbox-transaction-and-recovery.test.ts` |
| **Category Update** | `PUT /api/admin/categories/[id]` | `product_categories` | **YES** | Atomic | Yes (Key Lookup / Update) | `tests/outbox-transaction-and-recovery.test.ts` |
| **Category Deletion** | `DELETE /api/admin/categories/[id]` | `product_categories` | **YES** | Atomic | Yes (Key Lookup / Delete) | `tests/outbox-transaction-and-recovery.test.ts` |
| **Order Creation** | `POST /api/orders` | `orders`, `order_items` | **YES** | Atomic in DB Transaction | Yes (Key Lookup / Merge) | `tests/outbox-transaction-and-recovery.test.ts` |
| **Order Cancellation** | `POST /api/orders/[id]/cancel` | `orders`, `products` (stock) | **YES** | Atomic | Yes (Terminal State Guard) | `tests/outbox-transaction-and-recovery.test.ts` |
| **Payment Submission** | `POST /api/orders/[id]/payment` | `payment_submissions` | **YES** | Atomic | Yes (Key Lookup / Merge) | `tests/payment-and-timeline.test.ts` |
| **Payment Verification** | `POST /api/admin/payments/[id]/verify` | `payments`, `payment_submissions`, `orders` | **YES** | Atomic | Yes (Non-Blind Conflict Protection) | `tests/payment-and-timeline.test.ts` |
| **Inventory Stock Adjustment** | `POST /api/admin/inventory` | `products` | **YES** | Atomic | Yes (Key Lookup / Update) | `tests/orders-fit-pagination-inventory-products.test.ts` |
| **Return Request Creation** | `POST /api/returns` | `order_returns`, `order_return_items` | **YES** | Atomic | Yes (Key Lookup / Merge) | `tests/returns-and-refunds.test.ts` |
| **Return Status & Inspection** | `PATCH /api/returns/[id]` | `order_returns`, `products` (restock) | **YES** | Atomic | Yes (Key Lookup / Update) | `tests/unified-return-refund-timeline.test.ts` |
| **Refund Payout Confirmation** | `PATCH /api/returns/[id]` | `order_returns`, `orders` | **YES** | Atomic | Yes (Paid Settlement Guard) | `tests/unified-return-refund-timeline.test.ts` |
| **Return Dispute** | `POST /api/returns/[id]/dispute` | `order_returns` | **YES** | Atomic | Yes (Key Lookup / Update) | `tests/returns-and-refunds.test.ts` |
| **Shop & Payment Settings** | `PUT /api/admin/settings/business`, `PUT /api/admin/settings/payments` | `shop_settings` | **YES** | Atomic | Yes (Singleton Key Update) | `tests/business-config-and-availability.test.ts` |
| **Saved Address Creation** | `POST /api/account/addresses` | `user_addresses` | **YES** | Atomic | Yes (Key Lookup / Merge) | `tests/admin-and-addresses.test.ts` |
| **Saved Address Update** | `PUT /api/account/addresses/[id]` | `user_addresses` | **YES** | Atomic | Yes (Key Lookup / Update) | `tests/admin-and-addresses.test.ts` |
| **Saved Address Deletion** | `DELETE /api/account/addresses/[id]` | `user_addresses` | **YES** | Atomic | Yes (Key Lookup / Delete) | `tests/admin-and-addresses.test.ts` |
