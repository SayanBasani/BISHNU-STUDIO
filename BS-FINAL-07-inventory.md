# BS-FINAL-07 — Complete Project Feature Inventory

**Project:** Bishnu Studio  
**Local Workspace:** `C:\dev\Antigravity\bishnu-studio`  
**Repository:** `https://github.com/SayanBasani/BISHNU-STUDIO.git`  
**Branch:** `main`  
**Baseline Commit:** `3f1b9ec`  
**Date:** October 31, 2026  

---

## 1. Complete Feature Inventory Table

| Feature | Frontend | Backend | Database | Authorization | Tests | Status |
|---|---|---|---|---|---|---|
| **User Authentication & Session Management** | `/login`, `/register`, `/forgot-password`, `/blocked` | `/api/auth/login`, `/api/auth/logout`, `/api/auth/register`, `/api/auth/me`, `/api/auth/profile`, `/api/auth/otp/send`, `/api/auth/otp/verify`, `/api/auth/password-reset/confirm` | `users`, `sessions`, `verification_tokens`, `authentication_events` | Public for auth endpoints; valid session required for profile; blocked user enforcement | `tests/auth.test.ts`, `tests/auth-hydration-avatars-and-performance.test.ts`, `tests/session-management-and-blocking.test.ts` | **Operational** |
| **Customer Profile & Saved Addresses** | `/account/profile`, `/account/security` | `/api/account/addresses`, `/api/account/addresses/[id]`, `/api/account/avatar`, `/api/account/change-password` | `users`, `user_addresses`, `audit_logs` | Authenticated customer (ownership strictly enforced: `userId === auth.user.id`) | `tests/admin-and-addresses.test.ts`, `tests/profile-and-security.test.ts` | **Operational** |
| **Product Catalog & Category Browsing** | `/shop`, `/shop/[id]`, `/` (Homepage) | `/api/products`, `/api/products/[id]`, `/api/settings/shop` | `products`, `product_categories`, `product_images`, `shop_settings` | Public read access | `tests/system-config-pricing-homepage.test.ts`, `tests/neon-postgres-and-homepage.test.ts` | **Operational** |
| **Product Reviews & Verified Purchases** | `/shop/[id]/reviews` | `/api/products/[id]/reviews`, `/api/admin/reviews`, `/api/admin/reviews/[id]` | `product_reviews`, `orders`, `order_items` | Customer verified purchase check for review submission; Admin for moderation | `tests/blocking-reviews-gallery.test.ts`, `tests/sidebar-cleanup-reviews-theme.test.ts` | **Operational** |
| **Document Printing & Custom Services** | `/services/document-printing`, `/services/photo-printing`, `/services/pvc-card`, `/services/lamination` | `/api/pricing/calculate`, `/api/pricing/rates`, `/api/files/upload` | `services`, `service_options`, `service_prices`, `order_files` | Public pricing calculation; Authenticated document upload | `tests/pricing.test.ts`, `tests/storage-pdf.test.ts` | **Operational** |
| **Shopping Cart & Buy-Now Selection** | `/cart` | Client-side reactive cart state with server-side pricing re-validation | `products`, `service_prices` | Public cart browsing; Authenticated checkout | `tests/cart-buynow-selection-services.test.ts`, `tests/cart-gallery-tracking.test.ts` | **Operational** |
| **Checkout & Order Creation** | `/checkout` | `POST /api/orders` | `orders`, `order_items`, `order_files`, `user_addresses`, `products`, `db_sync_outbox` | Authenticated Customer; server recalculates totals, validates prices & reserves stock | `tests/orders.test.ts`, `tests/orders-fit-pagination-inventory-products.test.ts`, `tests/order-state-machine-and-tracking.test.ts` | **Operational** |
| **UPI Payment Submission & Verification** | `/checkout/payment/[orderId]`, `/admin/payments`, `/admin/payments/reconciliation` | `/api/orders/[id]/payment`, `/api/admin/payments/[id]/verify`, `/api/admin/payments/[id]/reject`, `/api/admin/payments/reconciliation` | `payments`, `payment_submissions`, `shop_upi_accounts`, `orders`, `order_status_history`, `db_sync_outbox` | Customer payment submission; Admin-only verification/rejection with mandatory evidence | `tests/payment-and-timeline.test.ts`, `tests/upi-history-and-developer-credits.test.ts`, `tests/admin-notifications-and-payment-methods.test.ts` | **Operational** |
| **Order Tracking & Unified Timeline** | `/account/orders`, `/account/orders/[id]` | `/api/orders`, `/api/orders/[id]`, `/api/orders/[id]/cancel` | `orders`, `order_items`, `order_files`, `order_status_history`, `order_returns` | Customer owns order (`customerId === auth.user.id`) or Admin/Staff | `tests/unified-return-refund-timeline.test.ts`, `tests/order-state-machine-and-tracking.test.ts` | **Operational** |
| **Universal Fulfilment Hub** | `/admin/orders`, `/admin/orders/[id]` | `PUT /api/orders/[id]`, `/api/admin/orders/[id]/items/[itemId]/inventory` | `orders`, `order_items`, `order_status_history`, `products` | Admin / Staff role; home delivery, courier tracking & counter collection paths | `tests/universal-fulfillment-and-return-exchange.test.ts`, `tests/orders-table-payment-products-devcleanup.test.ts` | **Operational** |
| **Returns & Exchanges Physical Workflow** | `/returns`, `/admin/returns`, `/admin/returns/[id]` | `/api/returns`, `/api/returns/[id]`, `/api/returns/[id]/dispute` | `order_returns`, `order_return_items`, `orders`, `products`, `order_status_history` | Customer returns within window; Admin reviews, inspects goods, and restocks inventory | `tests/returns-and-refunds.test.ts`, `tests/universal-fulfillment-and-return-exchange.test.ts` | **Operational** |
| **Refund Settlement & Payout Confirmation** | `/admin/returns/[id]` | `PATCH /api/returns/[id]` | `order_returns`, `orders`, `order_status_history` | Admin explicit payout confirmation (with settlement reference; initiated != paid) | `tests/unified-return-refund-timeline.test.ts` | **Operational** |
| **In-App Notification System** | `/account/notifications`, `/admin/notifications`, Navbar Bell | `/api/notifications`, `/api/notifications/[id]/read`, `/api/notifications/mark-all-read` | `notifications` | Recipient-based authorization (Customers see own notifications; Admin sees admin scope) | `tests/notifications-system-and-security.test.ts` | **Operational** |
| **Admin Product & Category Catalog Hub** | `/admin/products`, `/admin/categories` | `/api/admin/products`, `/api/admin/products/[id]`, `/api/admin/categories`, `/api/admin/categories/[id]` | `products`, `product_categories`, `product_images`, `audit_logs` | Admin role | `tests/orders-fit-pagination-inventory-products.test.ts` | **Operational** |
| **Admin Real-Time Inventory Control** | `/admin/inventory` | `/api/admin/inventory` | `products`, `order_items`, `db_sync_outbox`, `audit_logs` | Admin role | `tests/orders-fit-pagination-inventory-products.test.ts` | **Operational** |
| **Customer Moderation & Account Appeals** | `/admin/customers`, `/admin/customers/[id]`, `/admin/customers/appeals` | `/api/admin/customers`, `/api/admin/customers/[id]`, `/api/admin/customers/[id]/block`, `/api/admin/customers/[id]/unblock`, `/api/admin/appeals` | `users`, `account_appeals`, `sessions`, `audit_logs` | Admin role | `tests/session-management-and-blocking.test.ts` | **Operational** |
| **Business Settings & Multi-UPI Receiving** | `/admin/settings/business`, `/admin/settings/payments` | `/api/admin/settings/business`, `/api/admin/settings/payments`, `/api/settings/shop` | `shop_settings`, `shop_upi_accounts`, `audit_logs` | Admin role | `tests/business-config-and-availability.test.ts`, `tests/admin-notifications-and-payment-methods.test.ts` | **Operational** |
| **Dual Database Control Plane & Modes A-D** | `/admin/settings/database` | `/api/admin/database/status`, `/api/admin/database/switch`, `/api/health/db` | Neon PostgreSQL, SQLite/LibSQL, `db-control-plane.json`, fencing token | Super-admin with mandatory reason | `tests/dual-database-provider-and-sync.test.ts`, `tests/neon-first-and-complete-parity.test.ts` | **Operational** |
| **Transactional Outbox & Recovery Engine** | `/admin/settings/database` | `/api/admin/database/sync`, `/api/admin/database/sync/preview`, `/api/admin/database/sync/conflicts`, `/api/admin/database/sync/retry` | `db_sync_outbox`, `db_sync_history` | Admin role | `tests/outbox-transaction-and-recovery.test.ts` | **Operational** |
| **Cloud Storage & Private Download Proxy** | Upload Dropzones, Avatar Upload, Payment Proofs | `/api/files/upload`, `/api/files/download/[fileId]`, `/api/account/avatar` | `order_files`, `users`, `orders` | Cloudflare R2 / S3 abstraction + Local disk fallback; strict download ownership check | `tests/storage-cloud-and-local.test.ts`, `tests/storage-pdf.test.ts` | **Operational** |
| **Developer Profile & Attribution Credits** | `/developer`, `/admin/settings/developer` | `/api/developer`, `/api/admin/developer` | `developer_profile` | Public view; Admin modification | `tests/upi-history-and-developer-credits.test.ts` | **Operational** |

---

## 2. Codebase Quality Audit Findings

A global inspection of all files in `src/app`, `src/lib`, `src/components`, `src/db`, `scripts`, and `tests` was performed:
- **`TODO` / `FIXME` comments**: 0 occurrences found in `src/`.
- **Placeholder / Mock Data**: Zero mock endpoints in production routes. All API routes interact directly with Drizzle ORM schemas.
- **Unhandled Promises / Catch Blocks**: All API routes use structured `try/catch` with HTTP error codes and JSON error responses.
- **Inert Buttons / Actions**: All modals, buttons, forms, and status toggles across customer and admin views are backed by functional API endpoints.
- **Temporary bypasses**: None identified.
