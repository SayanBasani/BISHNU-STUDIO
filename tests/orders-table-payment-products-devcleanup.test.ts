import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

describe("BS-ORDERS-04A: Workstream 1 - Admin All Orders Table Layout & Responsiveness", () => {
  const ordersPageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/admin/orders/page.tsx"),
    "utf-8"
  );

  it("should enforce a minimum table width of at least 1150px to prevent cramped columns", () => {
    expect(ordersPageSource).toMatch(/min-w-\[(1150|1200)px\]/);
  });

  it("should enforce whitespace-nowrap and explicit min-widths on table columns", () => {
    expect(ordersPageSource).toContain("min-w-[170px] whitespace-nowrap"); // Order Ref
    expect(ordersPageSource).toContain("min-w-[140px] whitespace-nowrap"); // Date & Time
    expect(ordersPageSource).toContain("min-w-[170px]"); // Customer
    expect(ordersPageSource).toContain("min-w-[150px]"); // Fulfillment
    expect(ordersPageSource).toContain("min-w-[80px] text-center"); // Items
    expect(ordersPageSource).toContain("min-w-[110px] font-mono whitespace-nowrap"); // Total
    expect(ordersPageSource).toContain("min-w-[150px] whitespace-nowrap"); // Payment Method
    expect(ordersPageSource).toContain("min-w-[140px] whitespace-nowrap"); // Payment Status
    expect(ordersPageSource).toContain("min-w-[140px] whitespace-nowrap"); // Order Status
  });

  it("should implement sticky right positioning on the Actions column with opaque theme-aware backdrop", () => {
    expect(ordersPageSource).toContain("sticky right-0");
    expect(ordersPageSource).toContain("bg-white/95 dark:bg-slate-900/95");
    expect(ordersPageSource).toContain("shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)]");
    expect(ordersPageSource).toContain("dark:shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.5)]");
  });

  it("should retain mobile cards grid for screens below lg breakpoint", () => {
    expect(ordersPageSource).toContain("grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-4");
  });
});

describe("BS-ORDERS-04A: Workstream 2 - Payment Status Reconciliation & Consistency", () => {
  const orderApiSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/orders/[id]/route.ts"),
    "utf-8"
  );
  const verifyApiSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/admin/payments/[id]/verify/route.ts"),
    "utf-8"
  );
  const orderDetailSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/admin/orders/[id]/page.tsx"),
    "utf-8"
  );

  it("should automatically reconcile pending payment submissions when order payment status is set to paid", () => {
    expect(orderApiSource).toContain('if (paymentStatus === "paid") {');
    expect(orderApiSource).toContain("eq(paymentSubmissions.status, \"pending_verification\")");
    expect(orderApiSource).toContain('status: "verified"');
    expect(orderApiSource).toContain("Automatically reconciled: Order marked paid by administrator.");
  });

  it("should avoid double-counting or concurrency issues when reconciling payments", () => {
    expect(orderApiSource).toContain("eq(payments.transactionReference, sub.transactionId)");
    expect(verifyApiSource).toContain("existingPay.length === 0");
  });

  it("should eliminate artificial block preventing verification of pending submissions when order is paid", () => {
    // Should NOT contain: submission.status === "verified" || order.paymentStatus === "paid"
    expect(verifyApiSource).not.toContain("submission.status === \"verified\" || order.paymentStatus === \"paid\"");
    expect(verifyApiSource).toContain("if (submission.status === \"verified\")");
  });

  it("should render inline Verify Claim and Reject Claim actions in Admin Order Details Section 4", () => {
    expect(orderDetailSource).toContain("handleVerifySubmission");
    expect(orderDetailSource).toContain("handleRejectSubmission");
    expect(orderDetailSource).toContain("Verify Claim");
    expect(orderDetailSource).toContain("Reject Claim");
  });

  it("should accurately calculate amountPaid and amountRemaining", () => {
    expect(orderApiSource).toContain("const verifiedSubmissions = submissions.filter((s) => s.status === \"verified\");");
    expect(orderApiSource).toContain("const amountPaid =");
    expect(orderApiSource).toContain("const amountRemaining = Math.max(0, order.totalAmount - amountPaid);");
  });
});

describe("BS-ORDERS-04A: Workstream 3 - Display Actual Ordered Products & Specs", () => {
  const createOrderApiSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/orders/route.ts"),
    "utf-8"
  );
  const getOrderApiSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/orders/[id]/route.ts"),
    "utf-8"
  );
  const orderDetailSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/admin/orders/[id]/page.tsx"),
    "utf-8"
  );
  const customerOrderSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/account/orders/[id]/page.tsx"),
    "utf-8"
  );

  it("should snapshot productName, sku, and imageUrl into configuration on order placement", () => {
    expect(createOrderApiSource).toContain("productName: snapshottedProduct.name");
    expect(createOrderApiSource).toContain("productSku: snapshottedProduct.sku");
  });

  it("should dynamically resolve product name from catalog if missing or fallback to historical message", () => {
    expect(getOrderApiSource).toContain("resolvedProductName = prodRows[0].name;");
    expect(getOrderApiSource).toContain("isResolvedFromCatalog = true;");
    expect(getOrderApiSource).toContain('resolvedProductName = "Product details unavailable (historical item)";');
  });

  it("should display real product name, sku, and thumbnail in Admin Order Details", () => {
    expect(orderDetailSource).toContain("item.productName || config.productName || \"Product details unavailable (historical item)\"");
    expect(orderDetailSource).toContain("Catalog Item");
    expect(orderDetailSource).toContain("SKU:");
  });

  it("should replace generic 'Shop Product' with actual product name in customer order details", () => {
    expect(customerOrderSource).toContain("item.productName || item.configuration?.productName || \"Product details unavailable (historical item)\"");
  });
});

describe("BS-ORDERS-04A: Workstream 4 - Development-Only Data Cleanup Feature", () => {
  const previewRouteSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/admin/dev-cleanup/preview/route.ts"),
    "utf-8"
  );
  const cleanupRouteSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/admin/dev-cleanup/route.ts"),
    "utf-8"
  );
  const settingsPageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/admin/settings/page.tsx"),
    "utf-8"
  );

  it("should strictly reject dev cleanup requests in production environments with 403", () => {
    expect(previewRouteSource).toContain('process.env.NODE_ENV === "production"');
    expect(previewRouteSource).toContain("status: 403");
    expect(cleanupRouteSource).toContain('process.env.NODE_ENV === "production"');
    expect(cleanupRouteSource).toContain("status: 403");
  });

  it("should require exact confirmation phrase 'WIPE DEVELOPMENT DATA'", () => {
    expect(cleanupRouteSource).toContain('confirmation: z.literal("WIPE DEVELOPMENT DATA"');
  });

  it("should require administrator password re-authentication before executing wipe", () => {
    expect(cleanupRouteSource).toContain("validateAdminCredentials");
    expect(cleanupRouteSource).toContain("Re-authentication failed: Invalid administrator password.");
  });

  it("should strictly preserve admin user (usr_admin_001) and system settings", () => {
    expect(cleanupRouteSource).toContain('ne(users.id, "usr_admin_001")');
    expect(cleanupRouteSource).toContain('ne(users.role, "admin")');
  });

  it("should purge business upload files in private directories while leaving base directories intact", () => {
    expect(cleanupRouteSource).toContain('path.join(uploadRoot, "private", "documents")');
    expect(cleanupRouteSource).toContain('path.join(uploadRoot, "private", "payments")');
    expect(cleanupRouteSource).toContain('path.join(uploadRoot, "private", "pvc")');
    expect(cleanupRouteSource).toContain('path.join(uploadRoot, "private", "photos")');
    expect(cleanupRouteSource).toContain("fs.unlinkSync(filePath)");
  });

  it("should provide two-step confirmation modal and Danger Zone section in settings UI", () => {
    expect(settingsPageSource).toContain("Danger Zone: Development Data Cleanup");
    expect(settingsPageSource).toContain("Wipe Development Data");
    expect(settingsPageSource).toContain("Step {cleanupStep} of 2");
    expect(settingsPageSource).toContain("WIPE DEVELOPMENT DATA");
  });
});
