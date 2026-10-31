import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { formatCompactDateTime, formatCompactPaymentMethod } from "../src/lib/utils";

describe("BS-ORDERS-04B: Workstream 1 - Payment Reconciliation Safety Audit", () => {
  const orderUpdateRouteSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/orders/[id]/route.ts"),
    "utf-8"
  );
  const paymentVerifyRouteSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/admin/payments/[id]/verify/route.ts"),
    "utf-8"
  );

  it("should NOT auto-verify pending payment claims when order status is updated to paid", () => {
    // Audit check: Order status change must never silently mark payment claims as verified
    expect(orderUpdateRouteSource).not.toContain(
      "Automatically reconciled: Order marked paid by administrator."
    );
    expect(orderUpdateRouteSource).toContain("BS-ORDERS-04B audit");
  });

  it("should strictly reserve payment claim verification to the authoritative payment verification workflow", () => {
    expect(paymentVerifyRouteSource).toContain(".update(paymentSubmissions)");
    expect(paymentVerifyRouteSource).toContain('status: "verified"');
    expect(paymentVerifyRouteSource).toContain("verifiedByAdminId: auth.user.id");
    expect(paymentVerifyRouteSource).toContain("amountVerified: submission.amount");
  });
});

describe("BS-ORDERS-04B: Workstream 2 - All Orders Table Layout, 11 Columns & Desktop Fit", () => {
  const ordersPageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/admin/orders/page.tsx"),
    "utf-8"
  );

  it("should include all 11 columns in the table header", () => {
    // 1. # (No.)
    expect(ordersPageSource).toContain('<th className="py-3 px-2 w-10 text-center">#</th>');
    // 2. Order Ref
    expect(ordersPageSource).toContain("Order Ref");
    // 3. Date & Time
    expect(ordersPageSource).toContain("Date & Time");
    // 4. Customer
    expect(ordersPageSource).toContain("Customer");
    // 5. Fulfillment
    expect(ordersPageSource).toContain("Fulfillment");
    // 6. Items
    expect(ordersPageSource).toContain("Items");
    // 7. Total
    expect(ordersPageSource).toContain("Total");
    // 8. Payment Method
    expect(ordersPageSource).toContain("Payment Method");
    // 9. Payment Status
    expect(ordersPageSource).toContain("Payment Status");
    // 10. Order Status
    expect(ordersPageSource).toContain("Order Status");
    // 11. Actions
    expect(ordersPageSource).toContain("Actions");
  });

  it("should fit desktop viewport widths without forcing min-w-[1200px]", () => {
    expect(ordersPageSource).not.toMatch(/min-w-\[(1150|1200)px\]/);
    expect(ordersPageSource).toContain("w-full text-left text-xs border-collapse");
    expect(ordersPageSource).toContain("overflow-x-auto");
  });

  it("should replace the wide View Details text button with a compact eye-icon button", () => {
    expect(ordersPageSource).toContain('title="View Details"');
    expect(ordersPageSource).toContain('aria-label="View Order Details"');
    expect(ordersPageSource).toContain("<Eye className=\"w-3.5 h-3.5\" />");
  });

  it("should format date and time compactly (e.g. DD/MM/YYYY, hh:mm A)", () => {
    const testDate = new Date(2026, 9, 31, 12, 44); // 31 Oct 2026 12:44 PM
    const formatted = formatCompactDateTime(testDate);
    expect(formatted).toBe("31/10/2026, 12:44 PM");
  });

  it("should format payment methods compactly to conserve table width", () => {
    expect(formatCompactPaymentMethod("cash_on_collection")).toBe("Cash");
    expect(formatCompactPaymentMethod("cash_on_delivery")).toBe("COD");
    expect(formatCompactPaymentMethod("upi")).toBe("UPI");
    expect(formatCompactPaymentMethod("upi_mock")).toBe("UPI");
    expect(formatCompactPaymentMethod("online")).toBe("Online");
  });
});

describe("BS-ORDERS-04B: Workstream 3 - Sequential Row Numbering", () => {
  const ordersPageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/admin/orders/page.tsx"),
    "utf-8"
  );

  it("should calculate sequential row numbering based on page, limit, and index", () => {
    expect(ordersPageSource).toContain("const rowNumber = (page - 1) * limit + idx + 1;");
    expect(ordersPageSource).toContain("{rowNumber}");
  });

  it("should verify row index calculation for different pages and limits", () => {
    const calc = (page: number, limit: number, idx: number) => (page - 1) * limit + idx + 1;
    // Page 1, limit 20: 1 to 20
    expect(calc(1, 20, 0)).toBe(1);
    expect(calc(1, 20, 19)).toBe(20);
    // Page 2, limit 20: 21 to 40
    expect(calc(2, 20, 0)).toBe(21);
    expect(calc(2, 20, 19)).toBe(40);
    // Page 3, limit 50: 101 to 150
    expect(calc(3, 50, 0)).toBe(101);
    expect(calc(3, 50, 49)).toBe(150);
  });
});

describe("BS-ORDERS-04B: Workstream 4 - Real Server-Side Pagination & URL State", () => {
  const ordersApiSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/orders/route.ts"),
    "utf-8"
  );
  const ordersPageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/admin/orders/page.tsx"),
    "utf-8"
  );

  it("should perform server-side SQL count and pagination before slicing", () => {
    expect(ordersApiSource).toContain(".select({ count: sql<number>`count(*)` })");
    expect(ordersApiSource).toContain("q.limit(limit).offset(offset)");
    expect(ordersApiSource).toContain("desc(orders.createdAt), desc(orders.id)");
  });

  it("should return complete pagination metadata in orders API response", () => {
    expect(ordersApiSource).toContain("total,");
    expect(ordersApiSource).toContain("page: all ? 1 : page,");
    expect(ordersApiSource).toContain("limit: all ? total : limit,");
    expect(ordersApiSource).toContain("totalPages: all ? 1 : totalPages,");
    expect(ordersApiSource).toContain("hasNextPage: all ? false : page < totalPages,");
    expect(ordersApiSource).toContain("hasPrevPage: all ? false : page > 1,");
  });

  it("should support page sizes of 20, 50, and 100 in the admin UI", () => {
    expect(ordersPageSource).toContain('<option value={20}>20</option>');
    expect(ordersPageSource).toContain('<option value={50}>50</option>');
    expect(ordersPageSource).toContain('<option value={100}>100</option>');
  });

  it("should synchronize pagination and filters with URL parameters via history.replaceState", () => {
    expect(ordersPageSource).toContain("window.history.replaceState(null, \"\", newUrl)");
    expect(ordersPageSource).toContain('params.set("page", page.toString())');
    expect(ordersPageSource).toContain('params.set("limit", limit.toString())');
  });

  it("should wrap the orders page in Suspense to prevent Next.js deopt", () => {
    expect(ordersPageSource).toContain("<Suspense");
    expect(ordersPageSource).toContain("<AdminOrdersContent />");
  });
});

describe("BS-ORDERS-04B: Workstream 5 - Product Operations & SKU Copy in Order Details", () => {
  const orderDetailSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/admin/orders/[id]/page.tsx"),
    "utf-8"
  );
  const productsPageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/admin/products/page.tsx"),
    "utf-8"
  );

  it("should provide compact SKU copy button with tooltip and accessible label", () => {
    expect(orderDetailSource).toContain('title="Copy SKU"');
    expect(orderDetailSource).toContain('aria-label="Copy SKU"');
    expect(orderDetailSource).toContain("copySkuToClipboard(itemSku)");
    expect(orderDetailSource).toContain("Copied");
  });

  it("should link product thumbnail and name directly to the catalog edit page", () => {
    expect(orderDetailSource).toContain("href={`/admin/products?edit=${item.productId}`}");
    expect(orderDetailSource).toContain("title=\"View product in catalog\"");
    expect(orderDetailSource).toContain("title=\"Edit product in catalog\"");
  });

  it("should preserve historical snapshot and show unavailable badge if catalog product is deleted", () => {
    expect(orderDetailSource).toContain("Catalog Item Unavailable");
    expect(orderDetailSource).toContain("item.catalogProductExists === false");
  });

  it("should support auto-opening the edit modal in products page via ?edit= or ?id= query param", () => {
    expect(productsPageSource).toContain('searchParams.get("edit") || searchParams.get("id")');
    expect(productsPageSource).toContain("handleOpenEdit(target)");
    expect(productsPageSource).toContain("<Suspense");
  });
});

describe("BS-ORDERS-04B: Workstream 6 - Safe Inventory Actions & Prevention of Double Deductions", () => {
  const createOrderApiSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/orders/route.ts"),
    "utf-8"
  );
  const deductStockApiSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/admin/orders/[id]/items/[itemId]/deduct-stock/route.ts"),
    "utf-8"
  );
  const inventoryCheckApiSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/admin/orders/[id]/items/[itemId]/inventory/route.ts"),
    "utf-8"
  );
  const orderDetailSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/admin/orders/[id]/page.tsx"),
    "utf-8"
  );

  it("should record stock deduction at checkout to prevent accidental double deductions", () => {
    expect(createOrderApiSource).toContain('stockDeductionStatus: "deducted_at_checkout"');
    expect(createOrderApiSource).toContain("stockQuantity: calc.product.stockQuantity - item.quantity");
  });

  it("should enforce server-side idempotency in deduct-stock API", () => {
    expect(deductStockApiSource).toContain('config.stockDeductionStatus === "deducted"');
    expect(deductStockApiSource).toContain('config.stockDeductionStatus === "deducted_at_checkout"');
    expect(deductStockApiSource).toContain("Stock already deducted for this item.");
    expect(deductStockApiSource).toContain("alreadyDeducted: true");
  });

  it("should reject inventory deduction on non-inventory print services", () => {
    expect(deductStockApiSource).toContain('item.itemType !== "product"');
    expect(deductStockApiSource).toContain("is a print service and does not track inventory");
  });

  it("should check authoritative stock and reject insufficient stock on deduction", () => {
    expect(deductStockApiSource).toContain("product.stockQuantity < requestedQty");
    expect(deductStockApiSource).toContain("Insufficient stock for");
  });

  it("should record audit log and order timeline event on successful manual deduction", () => {
    expect(deductStockApiSource).toContain('action: "inventory_manual_deduction"');
    expect(deductStockApiSource).toContain("recordOrderEvent({");
    expect(deductStockApiSource).toContain("Manual stock deduction:");
  });

  it("should render deduction confirmation modal with authoritative server stock and expected post-deduction stock", () => {
    expect(orderDetailSource).toContain("Deduct {inventoryModalItem.quantity} unit");
    expect(orderDetailSource).toContain("Current Stock");
    expect(orderDetailSource).toContain("After Deduction");
    expect(orderDetailSource).toContain("handleConfirmDeductStock");
    expect(inventoryCheckApiSource).toContain("expectedStockAfterDeduction");
  });

  it("should display appropriate stock status badges in order details item cards", () => {
    expect(orderDetailSource).toContain("Not tracked (Print Service)");
    expect(orderDetailSource).toContain("Stock Deducted");
    expect(orderDetailSource).toContain("Verified • No double-deduction");
    expect(orderDetailSource).toContain("Insufficient Stock");
  });
});
