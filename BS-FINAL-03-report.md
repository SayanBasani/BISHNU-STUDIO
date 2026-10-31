# Engineering Delivery Report: BS-FINAL-03

**Milestone:** `BS-FINAL-03 — Universal Order Fulfilment, Return/Exchange Journey, Refund Approval, Business Terminology and Notification Routing`  
**Repository:** `C:\dev\Antigravity\bishnu-studio`  
**Target Branch:** `main`  
**Previous Commit:** `b0c046c`  
**Date:** October 31, 2026  
**Status:** Completed & Verified  

---

## Executive Summary

Milestone **BS-FINAL-03** resolved fundamental discrepancies across Bishnu Studio's order fulfillment and return/exchange lifecycle. Previously, the system conflated retail commerce with custom printing services, displayed printing-specific operational stages ("Print Room Processing") to retail customers, lacked dedicated exchange workflows, conflated administrative refund approval with financial payout settlement, misrouted return notifications, and used colloquial operational terms (e.g., "Received at Studio").

All core objectives have been implemented, tested across 29 test suites (352 automated tests passing), verified via a full Next.js production build (`npm run build`, 59 routes generated cleanly), and migrated synchronously across both local SQLite and remote Neon PostgreSQL databases.

---

## 1. Root Cause Analysis of Reported Screenshot Issues

| Screenshot Reference | Identified Root Cause | Engineering Resolution |
| :--- | :--- | :--- |
| **Screenshot 1: Admin Order Fulfillment Dropdown** | The admin order details console hardcoded `<option value="processing">Processing in Studio</option>`, forcing retail and service orders into print-room nomenclature regardless of fulfillment method. | Updated dropdown to universal `Preparing Order / In Progress` and parameterized labels based on order category and delivery type. |
| **Screenshot 2: Customer Order Fulfillment Tracking** | Order tracking page hardcoded a single sequence containing "Print Room Processing" and "Printing & packaging" for milestone 3, showing printing steps to customers who bought retail goods (e.g. stationery, paper packs). | Introduced `determineOrderCategory()` (`retail`, `service`, `mixed`) and `getFulfillmentMilestones()` to dynamically render tailored milestones ("Preparing Your Order", "Items picked & packed" for retail; "Production in Progress", "Printing, finishing & packing" for service). |
| **Screenshot 3: Return Notification Routing** | Return notification creation dispatched admin notifications to `/admin/orders/[orderId]` rather than the return detail console, and customer return notifications lacked direct deep links to return cards. | Built `resolveNotificationLink()` in `src/lib/notifications.ts` enforcing deterministic routing: Admin return notifications navigate strictly to `/admin/returns/[returnId]`; customer return notifications navigate to `/account/orders/[orderId]#return-[returnId]`. |
| **Screenshot 4: Return Workflow & Refund Settlement** | Approving a return or refund immediately permitted setting the status to `paid` without requiring transaction references, UTR numbers, or receipt upload proofs, conflating policy approval with financial payout. | Separated the workflow into two independent phases: Policy Approval (`approved` / `awaiting_payout`) and Settlement Execution (`payout_recorded` / `paid`). Enforced mandatory payout receipt proof URL before marking as paid. |

---

## 2. Universal Order Fulfilment Model & Category Separation

### 2.1 Dynamic Order Categorization
In `src/lib/order-state-machine.ts`, `determineOrderCategory(items)` inspects order line items to classify orders:
- **`retail`**: Standard catalog products (`product`).
- **`service`**: Custom print services (`pvc_card`, `document_print`, `lamination`, `photo_print`).
- **`mixed`**: Hybrid carts containing both retail products and print services.

### 2.2 Fulfillment Milestones by Category & Delivery Type
Milestones dynamically adapt:
1. **Retail — Courier / Home Delivery:**
   - Order Placed (*Order reference registered*)
   - Order Confirmed (*Order & payment verified*)
   - Preparing Your Order (*Items picked & packed*)
   - Shipped / In Transit (*Out with courier partner*)
   - Delivered (*Delivered to your doorstep*)
2. **Retail — Store Pickup / Customer Collection:**
   - Order Placed (*Order reference registered*)
   - Order Confirmed (*Order & payment verified*)
   - Preparing Your Order (*Items assembled & packed*)
   - Ready for Collection (*Ready at collection counter*)
   - Collected (*Handed over to customer*)
3. **Custom Printing Services (Photo Print, PVC, Lamination, Documents):**
   - Retains specialized operational steps (*Files & specs submitted*, *Confirmed & Approved*, *Production in Progress*, *Dispatched / Ready for Collection*, *Delivered / Collected*).

---

## 3. Prominent Return & Exchange Journey

### 3.1 Immutable Fulfillment Journey
When a return or exchange is initiated after delivery, the original fulfillment timeline remains intact and marked 100% complete ("Delivered" or "Collected"). It is never overwritten with return progress.

### 3.2 Active Return / Exchange Tracking Section
In `src/app/account/orders/[id]/page.tsx`, the active return/exchange card was repositioned prominently above the main order items grid with:
- **Visual Badge**: Purple `Return / Exchange Active` pill.
- **Stage Progression Bar**: Interactive multi-step progress bar showing physical return stages (`Requested` → `Approved` → `Pickup Scheduled` → `In Transit` → `Received` → `Inspection` → `Completed`).
- **Next Action Banner**: High-visibility callout indicating the immediate required step (e.g., "Prepare item for courier pickup", "Item received — inspection in progress").
- **Replacement Order Linking**: When resolution is `exchange`, displays replacement order reference with one-click navigation to the new order tracking page.

---

## 4. Refund Approval vs Financial Settlement Separation

### 4.1 State Machine Separation
Refund statuses in `src/lib/return-state-machine.ts` now distinctly separate administrative approval from financial payout:
```
not_eligible → pending_review → approved → awaiting_payout → payout_recorded → paid
                                                                                ↓
                                                                             disputed
```
- Direct transitions from `pending_review` to `paid` are blocked by validation rules.
- Transitioning to `paid` requires the administrator to supply an explicit transaction reference / UTR number and an uploaded payout proof receipt URL.

### 4.2 Customer Transparency & Dispute Flow
- Customers can inspect the verified payout receipt directly via an embedded lightbox viewer.
- If funds do not arrive, customers can trigger an expedited dispute with explanation, notifying the finance team.

---

## 5. Dedicated Exchange & Replacement Workflow

### 5.1 Schema & State Machine
Migration `0012_exchange_and_universal_fulfillment.sql` added:
- `replacement_order_id` (varchar)
- `exchange_status` (varchar)
- `exchange_price_difference` (integer in paise)
- `exchange_notes` (text)

### 5.2 Exchange Status Progression
Independent exchange lifecycle:
`requested` → `under_review` → `approved` → `replacement_created` → `dispatched` → `completed` (or `rejected`/`cancelled`).

---

## 6. Business Terminology Generalization

Conducted full codebase audit replacing studio-centric jargon with neutral operational terminology:
- `Received at Studio` → `Received at Return Location`
- `In Transit to Studio` → `In Transit to Return Location`
- `Under Review by Studio Staff` → `Under Review by Staff`
- `Processing in Studio` → `Preparing Order / In Progress`
- `Studio Finance` → `Finance Team`
- Preserved legitimate brand assets: `Bishnu Studio`, `Photo Studio Print`.

---

## 7. Deterministic Notification Routing

In `src/lib/notifications.ts`, `resolveNotificationLink()` standardizes link resolution:
- **Admin Return Notification**: `/admin/returns/${entityId}`
- **Customer Return Notification**: `/account/orders/${orderId}#return-${entityId}`
- **Admin Order Notification**: `/admin/orders/${entityId}`
- **Customer Order Notification**: `/account/orders/${entityId}`

Integrated directly into `createNotification()` ensuring all notifications adhere to deterministic URL contracts regardless of calling context.

---

## 8. Dual-Database Migration & Data Integrity

- **Migration Script:** `src/db/migrations/0012_exchange_and_universal_fulfillment.sql`
- **SQLite Database:** Successfully migrated local `data/bishnu.db`. Columns verified via `PRAGMA table_info(order_returns)`.
- **Neon PostgreSQL Database:** Successfully migrated remote database `ep-snowy-salad-a5k1u48k.us-east-2.aws.neon.tech`. Columns verified via `information_schema.columns`.
- **Journal Updated:** `src/db/migrations/meta/_journal.json` updated with index `12`.

---

## 9. Verification & Quality Gates

### 9.1 Automated Test Suite
- **Executed:** `npx vitest run`
- **Result:** **29/29 test files passed (100%)**, **352/352 tests passed**.
- **Dedicated Test File:** `tests/universal-fulfillment-and-return-exchange.test.ts` (17 tests covering category detection, retail vs service milestones, exchange statuses, payout guards, notification routing, and terminology assertions).

### 9.2 Next.js Production Build
- **Executed:** `npm run build`
- **Result:** Success (Exit code 0).
- **Output:** 59 static and dynamic routes compiled, 0 TypeScript errors, 0 ESLint errors.

---

## 10. Summary of Modified Files

```
src/
├── app/
│   ├── account/orders/[id]/page.tsx           # Contextual milestones & prominent return/exchange tracking
│   ├── admin/orders/[id]/page.tsx             # Universal order status terminology
│   ├── admin/returns/[id]/page.tsx            # Payout separation, receipt upload guard & exchange console
│   ├── admin/returns/page.tsx                 # Generalized return status filters
│   ├── api/orders/[id]/route.ts               # Universal fulfillment status messaging
│   ├── api/returns/[id]/route.ts              # Exchange field persistence & refund proof enforcement
│   └── api/returns/route.ts                   # Deterministic notification routing & neutral confirmation text
├── db/
│   ├── migrations/
│   │   ├── 0012_exchange_and_universal_fulfillment.sql # Schema migration for exchange fields
│   │   └── meta/_journal.json                 # Migration journal entry 12
│   ├── schema.pg.ts                           # Neon Postgres schema updates
│   └── schema.sqlite.ts                       # SQLite schema updates
├── lib/
│   ├── notifications.ts                       # Deterministic resolveNotificationLink
│   ├── order-state-machine.ts                 # Category detection & universal fulfillment milestones
│   └── return-state-machine.ts                # Payout separation & exchange lifecycle
tests/
└── universal-fulfillment-and-return-exchange.test.ts # Comprehensive automated test suite
BS-FINAL-03-report.md                          # Milestone delivery report
```
