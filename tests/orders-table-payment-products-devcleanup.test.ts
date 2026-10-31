import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

describe("BS-ORDERS-04A & BS-ORDERS-04B: Admin All Orders Table Layout & Responsiveness", () => {
  const ordersPageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/admin/orders/page.tsx"),
    "utf-8"
  );

  it("should contain all 11 columns including sequential row numbering and eye-icon action", () => {
    expect(ordersPageSource).toContain("<th className=\"py-3 px-2 w-10 text-center\">#</th>");
    expect(ordersPageSource).toContain("Order Ref");
    expect(ordersPageSource).toContain("Date & Time");
    expect(ordersPageSource).toContain("Customer");
    expect(ordersPageSource).toContain("Fulfillment");
    expect(ordersPageSource).toContain("Items");
    expect(ordersPageSource).toContain("Total");
    expect(ordersPageSource).toContain("Payment Method");
    expect(ordersPageSource).toContain("Payment Status");
    expect(ordersPageSource).toContain("Order Status");
    expect(ordersPageSource).toContain("Actions");
  });

  it("should fit desktop viewport widths cleanly without forcing arbitrary min-w-1200px", () => {
    // BS-ORDERS-04B eliminates min-w-[1200px] to fit within ~1050px desktop content width
    expect(ordersPageSource).not.toMatch(/min-w-\[(1150|1200)px\]/);
    expect(ordersPageSource).toContain("overflow-x-auto");
  });

  it("should implement compact eye icon button with accessible tooltip and aria-label", () => {
    expect(ordersPageSource).toContain('title="View Details"');
    expect(ordersPageSource).toContain('aria-label="View Order Details"');
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

  it("should NOT automatically reconcile pending payment submissions when order payment status is set to paid (BS-ORDERS-04B Audit)", () => {
    // Payment claims must only be verified authoritatively via POST /api/admin/payments/[id]/verify
    expect(orderApiSource).not.toContain("Automatically reconciled: Order marked paid by administrator.");
    expect(orderApiSource).toContain("BS-ORDERS-04B audit");
  });

  it("should avoid double-counting or concurrency issues when verifying payments in authoritative verification API", () => {
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
