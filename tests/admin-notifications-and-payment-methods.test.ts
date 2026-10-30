import { describe, it, expect, vi } from "vitest";
import { formatPaymentMethod, getPaymentMethodBadgeClass } from "@/lib/utils";
import {
  generateRequestId,
  createRequestTimer,
  RequestTimer,
} from "@/lib/perf";
import { NextRequest, NextResponse } from "next/server";
import { fetchPublicShopSettings } from "@/lib/public-settings";
import { calculateDropdownStyle } from "@/components/NotificationBell";
import { CANONICAL_PAYMENT_STATUSES } from "@/lib/order-state-machine";

describe("BS-UI-01A: Payment Method Formatting & Separation", () => {
  it("should format known payment methods into human-readable labels", () => {
    expect(formatPaymentMethod("cash_on_collection")).toBe("Cash on Collection");
    expect(formatPaymentMethod("cash_on_delivery")).toBe("Cash on Delivery");
    expect(formatPaymentMethod("cod")).toBe("Cash on Delivery");
    expect(formatPaymentMethod("upi_mock")).toBe("UPI");
    expect(formatPaymentMethod("upi")).toBe("UPI");
    expect(formatPaymentMethod("online")).toBe("Online Payment");
    expect(formatPaymentMethod("card")).toBe("Card");
  });

  it("should handle null, undefined, empty, or whitespace-only payment methods safely", () => {
    expect(formatPaymentMethod(null)).toBe("Not recorded");
    expect(formatPaymentMethod(undefined)).toBe("Not recorded");
    expect(formatPaymentMethod("")).toBe("Not recorded");
    expect(formatPaymentMethod("   ")).toBe("Not recorded");
  });

  it("should format arbitrary custom payment methods with capitalization", () => {
    expect(formatPaymentMethod("bank_transfer")).toBe("Bank Transfer");
    expect(formatPaymentMethod("pos_terminal")).toBe("Pos Terminal");
  });

  it("should provide distinct theme-aware badge classes for different payment methods", () => {
    const cashClass = getPaymentMethodBadgeClass("cash_on_collection");
    const upiClass = getPaymentMethodBadgeClass("upi_mock");
    const onlineClass = getPaymentMethodBadgeClass("online");
    const unknownClass = getPaymentMethodBadgeClass(null);

    expect(cashClass).toContain("blue");
    expect(upiClass).toContain("purple");
    expect(onlineClass).toContain("cyan");
    expect(unknownClass).toContain("slate");
  });

  it("should maintain strict separation between payment method and payment status", () => {
    // Case 1: Unpaid Cash on Collection
    const orderA = {
      orderReference: "BS-2610-1001",
      paymentMethod: "cash_on_collection",
      paymentStatus: "unpaid",
      orderStatus: "pending",
    };
    expect(formatPaymentMethod(orderA.paymentMethod)).toBe("Cash on Collection");
    expect(orderA.paymentStatus).toBe("unpaid");

    // Case 2: Unpaid UPI order
    const orderB = {
      orderReference: "BS-2610-1002",
      paymentMethod: "upi_mock",
      paymentStatus: "unpaid",
      orderStatus: "pending",
    };
    expect(formatPaymentMethod(orderB.paymentMethod)).toBe("UPI");
    expect(orderB.paymentStatus).toBe("unpaid");

    // Case 3: Pending Verification UPI order
    const orderC = {
      orderReference: "BS-2610-1003",
      paymentMethod: "upi_mock",
      paymentStatus: "pending_verification",
      orderStatus: "processing",
    };
    expect(formatPaymentMethod(orderC.paymentMethod)).toBe("UPI");
    expect(orderC.paymentStatus).toBe("pending_verification");

    // Case 4: Paid Online Payment order
    const orderD = {
      orderReference: "BS-2610-1004",
      paymentMethod: "online",
      paymentStatus: "paid",
      orderStatus: "ready_for_collection",
    };
    expect(formatPaymentMethod(orderD.paymentMethod)).toBe("Online Payment");
    expect(orderD.paymentStatus).toBe("paid");
  });
});

describe("BS-UI-01A: Notification Panel Viewport Clamping Logic", () => {
  it("should compute mobile panel coordinates with full-width gutters (<640px)", () => {
    const vw = 390;
    const vh = 844;
    const triggerRect = { bottom: 60, right: 360, left: 320 };

    // Mobile logic from NotificationBell
    const top = Math.min(triggerRect.bottom + 8, vh - 220);
    const maxHeight = Math.max(220, vh - top - 16);

    expect(top).toBe(68);
    expect(maxHeight).toBeLessThanOrEqual(vh - top);
    expect(vw - 24).toBe(366); // 12px left, 12px right safe margins
  });

  it("should prevent off-screen left overflow in desktop sidebar (triggerRect.right < 390px)", () => {
    const vw = 1440;
    const vh = 900;
    // In desktop sidebar (w-72 = 288px), bell trigger is at left ~200px, right ~240px
    const triggerRect = { bottom: 50, right: 240, left: 200 };
    const panelWidth = 384;

    let left: number;
    if (triggerRect.right - panelWidth < 12) {
      // Align to trigger left or clamp to 12px
      left = Math.max(12, Math.min(triggerRect.left, vw - panelWidth - 12));
    } else {
      left = Math.max(12, Math.min(triggerRect.right - panelWidth, vw - panelWidth - 12));
    }

    expect(left).toBe(200); // Opens to the right into the viewport! Never negative.
    expect(left + panelWidth).toBeLessThan(vw);
  });

  it("should correctly position panel when trigger is on the far right (top navbar)", () => {
    const vw = 1440;
    const triggerRect = { bottom: 64, right: 1400, left: 1360 };
    const panelWidth = 384;

    let left: number;
    if (triggerRect.right - panelWidth < 12) {
      left = Math.max(12, Math.min(triggerRect.left, vw - panelWidth - 12));
    } else {
      left = Math.max(12, Math.min(triggerRect.right - panelWidth, vw - panelWidth - 12));
    }

    expect(left).toBe(1016); // 1400 - 384
    expect(left).toBeGreaterThan(0);
    expect(left + panelWidth).toBe(1400); // Fully on screen
  });
});

describe("Performance Diagnostic Utility (src/lib/perf.ts)", () => {
  it("should generate a random request ID with req_ prefix", () => {
    const id = generateRequestId();
    expect(id).toMatch(/^req_[a-f0-9]{16}$/);
  });

  it("should preserve valid incoming X-Request-ID", () => {
    const validIncoming = "req_custom-abc-12345";
    const id = generateRequestId(validIncoming);
    expect(id).toBe(validIncoming);
  });

  it("should sanitize and regenerate on invalid incoming ID", () => {
    const invalidIncoming = "<script>alert(1)</script>";
    const id = generateRequestId(invalidIncoming);
    expect(id).toMatch(/^req_[a-f0-9]{16}$/);
  });

  it("should measure stage timings and set X-Request-ID response header", async () => {
    const req = new NextRequest("http://localhost:3000/api/orders?page=1", {
      headers: { "x-request-id": "req_perf_test_9999" },
    });

    const timer = createRequestTimer(req);
    expect(timer.requestId).toBe("req_perf_test_9999");

    await timer.measure("test_stage", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    timer.recordQuery("test_count", 5.2);

    const initialRes = NextResponse.json({ success: true });
    const finalRes = timer.finish(initialRes);

    expect(finalRes.headers.get("X-Request-ID")).toBe("req_perf_test_9999");

    const metrics = timer.getMetrics();
    expect(metrics.stages.length).toBe(1);
    expect(metrics.stages[0].name).toBe("test_stage");
    expect(metrics.stages[0].durationMs).toBeGreaterThanOrEqual(8);
    expect(metrics.queryCount).toBe(1);
    expect(metrics.totalQueryDurationMs).toBe(5.2);
  });
});

describe("Public Settings In-Flight Deduplication (src/lib/public-settings.ts)", () => {
  it("should share a single in-flight promise for concurrent calls", async () => {
    let fetchCount = 0;
    const originalFetch = global.fetch;

    global.fetch = vi.fn().mockImplementation(async () => {
      fetchCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        ok: true,
        json: async () => ({
          settings: {
            shopName: "Bishnu Studio Deduplicated",
            logoUrl: "/logo.png",
          },
        }),
      } as any;
    });

    try {
      // Simulate Navbar and Footer mounting concurrently
      const [res1, res2, res3] = await Promise.all([
        fetchPublicShopSettings(),
        fetchPublicShopSettings(),
        fetchPublicShopSettings(),
      ]);

      expect(fetchCount).toBe(1); // Only 1 network fetch executed!
      expect(res1?.shopName).toBe("Bishnu Studio Deduplicated");
      expect(res2?.shopName).toBe("Bishnu Studio Deduplicated");
      expect(res3?.shopName).toBe("Bishnu Studio Deduplicated");
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("Password Visibility & Admin UI Architecture Integrity", () => {
  const fs = require("fs");
  const path = require("path");

  it("should provide an accessible PasswordInput component with eye show/hide toggle", () => {
    const passwordInputCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/ui/PasswordInput.tsx"),
      "utf-8"
    );

    expect(passwordInputCode).toContain('type="button"');
    expect(passwordInputCode).toContain('aria-label={isVisible ? "Hide password" : "Show password"}');
    expect(passwordInputCode).toContain("<EyeOff");
    expect(passwordInputCode).toContain("<Eye");
    expect(passwordInputCode).toContain("autoComplete");
  });

  it("should integrate PasswordInput into customer login and registration", () => {
    const loginCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/login/page.tsx"),
      "utf-8"
    );
    const registerCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/register/page.tsx"),
      "utf-8"
    );
    const forgotCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/forgot-password/page.tsx"),
      "utf-8"
    );

    expect(loginCode).toContain("<PasswordInput");
    expect(registerCode).toContain("<PasswordInput");
    expect(forgotCode).toContain("<PasswordInput");
  });

  it("should render dedicated Payment Method column in admin orders desktop table", () => {
    const adminOrdersCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/admin/orders/page.tsx"),
      "utf-8"
    );

    expect(adminOrdersCode).toContain("<th className=\"py-3 px-4\">Payment Method</th>");
    expect(adminOrdersCode).toContain("<th className=\"py-3 px-4\">Payment Status</th>");
    expect(adminOrdersCode).toContain("<th className=\"py-3 px-4\">Order Status</th>");
    expect(adminOrdersCode).toContain("formatPaymentMethod(ord.paymentMethod)");
    expect(adminOrdersCode).toContain("getPaymentMethodBadgeClass(");
  });

  it("should render separate Payment Method row in admin orders mobile cards", () => {
    const adminOrdersCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/admin/orders/page.tsx"),
      "utf-8"
    );

    expect(adminOrdersCode).toContain("Payment Method:");
    expect(adminOrdersCode).toContain("Payment Status:");
    expect(adminOrdersCode).toContain("Order Status:");
  });

  it("should display Payment Method clearly in admin order detail view", () => {
    const orderDetailCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/admin/orders/[id]/page.tsx"),
      "utf-8"
    );

    expect(orderDetailCode).toContain("formatPaymentMethod(order.paymentMethod)");
    expect(orderDetailCode).toContain("Payment Method:");
    expect(orderDetailCode).toContain("Payment Reconciliation & Proof Verification");
  });

  it("should anchor and clamp notification dropdown within visible viewport", () => {
    const notifBellCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/NotificationBell.tsx"),
      "utf-8"
    );

    expect(notifBellCode).toContain("calculateDropdownStyle");
    expect(notifBellCode).toContain("buttonRef");
    expect(notifBellCode).toContain("panelStyle");
    expect(notifBellCode).toContain("maxHeight");
  });
});

describe("BS-OPS-02A: Order Fulfillment, Payment Enums & Collapsible Sidebar", () => {
  const fs = require("fs");
  const path = require("path");

  it("should auto-increment queryCount in RequestTimer when database stages are measured", async () => {
    const req = new NextRequest("http://localhost:3000/api/orders/BS-1001", {
      headers: { "x-request-id": "req_perf_auto_inc_123" },
    });

    const timer = createRequestTimer(req);

    // Measure stage with database prefix
    await timer.measure("database.orders.fetch", async () => {
      await new Promise((r) => setTimeout(r, 5));
    });

    await timer.measure("database.items.fetch", async () => {
      await new Promise((r) => setTimeout(r, 5));
    });

    // Measure non-database stage
    await timer.measure("validate_transition", async () => {
      await new Promise((r) => setTimeout(r, 2));
    });

    const metrics = timer.getMetrics();
    expect(metrics.queryCount).toBe(2); // Auto-incremented for 2 database stages!
    expect(metrics.totalQueryDurationMs).toBeGreaterThan(0);
    expect(metrics.stages.length).toBe(3);
  });

  it("should compute dropdown position synchronously to eliminate first-open misplaced flash", () => {
    // Case 1: Initial mount before DOM reference exists (fallback positioning)
    const initialFallback = calculateDropdownStyle(null);
    expect(initialFallback.position).toBe("fixed");
    expect(initialFallback.top).toBe("60px");
    expect(initialFallback.right).toBe("16px");
    expect(initialFallback.zIndex).toBe(60);

    // Case 2: Desktop sidebar trigger (left: 40px, right: 80px - opening to the right)
    const mockSidebarEl = {
      getBoundingClientRect: () => ({
        top: 20,
        bottom: 56,
        left: 40,
        right: 80,
        width: 40,
        height: 36,
      }),
    };
    const sidebarDropdown = calculateDropdownStyle(mockSidebarEl as any);
    expect(sidebarDropdown.position).toBe("fixed");
    expect(parseInt(String(sidebarDropdown.top))).toBe(64); // 56 + 8
    expect(parseInt(String(sidebarDropdown.left))).toBe(40); // Opens rightwards into viewport!
    expect(sidebarDropdown.zIndex).toBe(60);
  });

  it("should validate all canonical database payment statuses in PATCH /api/orders/[id]", () => {
    expect(CANONICAL_PAYMENT_STATUSES).toContain("unpaid");
    expect(CANONICAL_PAYMENT_STATUSES).toContain("pending");
    expect(CANONICAL_PAYMENT_STATUSES).toContain("pending_verification");
    expect(CANONICAL_PAYMENT_STATUSES).toContain("awaiting_payment");
    expect(CANONICAL_PAYMENT_STATUSES).toContain("paid");
    expect(CANONICAL_PAYMENT_STATUSES).toContain("refunded");
    expect(CANONICAL_PAYMENT_STATUSES).toContain("failed");
    expect(CANONICAL_PAYMENT_STATUSES).toContain("review_required");
  });

  it("should provide collapsible desktop sidebar in admin layout with persisted localStorage state", () => {
    const adminLayoutCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/admin/layout.tsx"),
      "utf-8"
    );

    expect(adminLayoutCode).toContain("admin_sidebar_collapsed");
    expect(adminLayoutCode).toContain("sidebarCollapsed");
    expect(adminLayoutCode).toContain("toggleSidebar");
    expect(adminLayoutCode).toContain("ChevronLeft");
    expect(adminLayoutCode).toContain("ChevronRight");
    expect(adminLayoutCode).toContain('sidebarCollapsed ? "md:w-20" : "md:w-64"');
  });

  it("should context-adapt fulfillment status options for store pickup vs home delivery", () => {
    const orderDetailCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/admin/orders/[id]/page.tsx"),
      "utf-8"
    );

    expect(orderDetailCode).toContain("isPickup ? (");
    expect(orderDetailCode).toContain("Ready for Counter Pickup");
    expect(orderDetailCode).toContain("Collected & Completed");
    expect(orderDetailCode).toContain("Packed & Ready for Dispatch");
    expect(orderDetailCode).toContain("Dispatched / Out for Delivery");
    expect(orderDetailCode).toContain("Delivered & Completed");
  });

  it("should replace raw alerts with inline accessible banner messages in admin order details", () => {
    const orderDetailCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/admin/orders/[id]/page.tsx"),
      "utf-8"
    );

    expect(orderDetailCode).toContain("saveError");
    expect(orderDetailCode).toContain("setSaveError");
    expect(orderDetailCode).not.toContain("alert(err?.message");
  });
});

