import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "fs";
import path from "path";
import { db } from "../src/db";
import {
  services,
  serviceOptions,
  servicePrices,
  orders,
  orderItems,
  auditLogs,
  products,
  shopSettings,
  users,
} from "../src/db/schema";
import { eq } from "drizzle-orm";
import {
  calculatePvcPrice,
  calculateDocumentPrintPrice,
  calculateLaminationPrice,
  calculatePhotoPrintPrice,
} from "../src/lib/pricing";
import { GET as getAdminPricing, PUT as putAdminPricing } from "../src/app/api/admin/pricing/route";
import * as authModule from "../src/lib/auth";
import { NextRequest } from "next/server";

describe("Bishnu Studio — System Config Theming, Admin Service Pricing & Homepage Redesign", () => {
  // =========================================================================
  // PART 1: System Config Light / Dark Theme Architecture
  // =========================================================================
  describe("PART 1: System Config Light & Dark Mode Tokens", () => {
    const settingsFilePath = path.join(
      process.cwd(),
      "src/app/admin/settings/page.tsx"
    );
    const settingsSource = fs.readFileSync(settingsFilePath, "utf8");

    it("should have dual-theme tokens on main page headings and subheadings", () => {
      expect(settingsSource).toMatch(/text-slate-900\s+dark:text-white|text-gray-900\s+dark:text-white/);
      expect(settingsSource).toMatch(/text-slate-500\s+dark:text-slate-400|text-gray-500\s+dark:text-slate-400/);
      expect(settingsSource).toContain("Store Settings &amp; System Configuration");
    });

    it("should adapt Business Profile card consistently in light and dark themes", () => {
      expect(settingsSource).toContain("Business Profile");
      expect(settingsSource).toMatch(/bg-white\s+dark:bg-slate-900/);
      expect(settingsSource).toMatch(/border-slate-200\s+dark:border-slate-800|border-gray-200\s+dark:border-slate-800/);
    });

    it("should adapt Store Counter Operating Hours in light and dark themes", () => {
      expect(settingsSource).toContain("Store Counter Operating Hours");
      expect(settingsSource).toMatch(/text-slate-700\s+dark:text-slate-300|text-gray-700\s+dark:text-slate-300/);
    });

    it("should adapt Delivery Threshold Charges card in light and dark themes", () => {
      expect(settingsSource).toContain("Delivery Threshold &amp; Charges");
      expect(settingsSource).toMatch(/Store Pickup:/);
      expect(settingsSource).toMatch(/Home Delivery:/);
    });

    it("should adapt Owner Credentials & Compute Environment in light and dark themes", () => {
      expect(settingsSource).toContain("Owner Credentials &amp; Compute Environment");
      expect(settingsSource).toMatch(/ADMIN_EMAIL/);
      expect(settingsSource).toMatch(/ADMIN_PASSWORD/);
      expect(settingsSource).toMatch(/bg-slate-100\s+dark:bg-slate-950/);
    });

    it("should adapt System Diagnostics card in light and dark themes", () => {
      expect(settingsSource).toContain("System Diagnostics");
      expect(settingsSource).toContain("Online &amp; Operational");
      expect(settingsSource).toMatch(/bg-emerald-50\s+dark:bg-emerald-950/);
    });

    it("should provide quick action navigation to Printing Service Pricing", () => {
      expect(settingsSource).toContain("/admin/pricing");
      expect(settingsSource).toContain("Printing Service Pricing");
    });
  });

  // =========================================================================
  // PART 2: Admin Service Pricing Management & Authorization
  // =========================================================================
  describe("PART 2: Admin Service Pricing API, RBAC & Validation", () => {
    it("should reject unauthenticated or non-admin requests on GET and PUT with 403 Forbidden", async () => {
      const fakeReq = new NextRequest("http://localhost:3000/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: "prc_pvc_aadhaar", price: 65 }),
      });

      const putRes = await putAdminPricing(fakeReq);
      expect(putRes.status).toBe(403);
      const putData = await putRes.json();
      expect(putData.error).toMatch(/Administrator privileges required/i);

      const getReq = new NextRequest("http://localhost:3000/api/admin/pricing", {
        method: "GET",
      });
      const getRes = await getAdminPricing(getReq);
      expect(getRes.status).toBe(403);
    });

    it("should validate and reject negative prices when authenticated as administrator", async () => {
      // Mock admin auth session
      const authSpy = vi.spyOn(authModule, "getAuthSession").mockResolvedValue({
        user: { id: "usr_admin_test", email: "admin@bishnustudio.com", role: "admin", fullName: "Admin Owner", isBlocked: false },
        session: { id: "sess_admin_test", userId: "usr_admin_test", expiresAt: Date.now() + 3600000, createdAt: Date.now() },
      } as any);

      const negReq = new NextRequest("http://localhost:3000/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: "prc_pvc_aadhaar", price: -25 }),
      });

      const res = await putAdminPricing(negReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Price cannot be negative/i);

      authSpy.mockRestore();
    });

    it("should validate and reject invalid quantity tiers where maxQuantity < minQuantity", async () => {
      const authSpy = vi.spyOn(authModule, "getAuthSession").mockResolvedValue({
        user: { id: "usr_admin_test", email: "admin@bishnustudio.com", role: "admin", fullName: "Admin Owner", isBlocked: false },
        session: { id: "sess_admin_test", userId: "usr_admin_test", expiresAt: Date.now() + 3600000, createdAt: Date.now() },
      } as any);

      const badTierReq = new NextRequest("http://localhost:3000/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: "prc_pvc_aadhaar",
          price: 50,
          minQuantity: 10,
          maxQuantity: 2,
        }),
      });

      const res = await putAdminPricing(badTierReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Max quantity cannot be less than min quantity/i);

      authSpy.mockRestore();
    });

    it("should allow admin to update service prices, round to 2 decimals, and record audit log", async () => {
      const adminUsers = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
      const adminId = adminUsers[0]?.id || "usr_admin_owner";

      const authSpy = vi.spyOn(authModule, "getAuthSession").mockResolvedValue({
        user: { id: adminId, email: "admin@bishnustudio.com", role: "admin", fullName: "Admin Owner", isBlocked: false },
        session: { id: "sess_admin_test", userId: adminId, expiresAt: Date.now() + 3600000, createdAt: Date.now() },
      } as any);

      const updateReq = new NextRequest("http://localhost:3000/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: "prc_pvc_aadhaar",
          price: 55.555, // Should round to 55.56
          minQuantity: 1,
          maxQuantity: 100,
        }),
      });

      const res = await putAdminPricing(updateReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.price).toBe(55.56);

      // Verify DB was updated
      const row = await db.select().from(servicePrices).where(eq(servicePrices.id, "prc_pvc_aadhaar"));
      expect(row[0].price).toBe(55.56);

      // Restore back to 50
      await db.update(servicePrices).set({ price: 50 }).where(eq(servicePrices.id, "prc_pvc_aadhaar"));

      authSpy.mockRestore();
    });

    it("should return complete service catalog with all options and current rates on admin GET", async () => {
      const authSpy = vi.spyOn(authModule, "getAuthSession").mockResolvedValue({
        user: { id: "usr_admin_test", email: "admin@bishnustudio.com", role: "admin", fullName: "Admin Owner", isBlocked: false },
        session: { id: "sess_admin_test", userId: "usr_admin_test", expiresAt: Date.now() + 3600000, createdAt: Date.now() },
      } as any);

      const getReq = new NextRequest("http://localhost:3000/api/admin/pricing", { method: "GET" });
      const res = await getAdminPricing(getReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.services)).toBe(true);
      expect(data.services.length).toBe(4);

      // Verify PVC, Doc, Lam, Photo all exist in returned catalog
      const keys = data.services.map((s: any) => s.key);
      expect(keys).toContain("pvc_card");
      expect(keys).toContain("document_print");
      expect(keys).toContain("lamination");
      expect(keys).toContain("photo_print");

      authSpy.mockRestore();
    });
  });

  // =========================================================================
  // PART 3: Dynamic Calculation & Historical Order Price Immutability
  // =========================================================================
  describe("PART 3: Dynamic Pricing Recalculation & Historical Preservation", () => {
    let originalAadhaarPrice: number;

    beforeAll(async () => {
      const p = await db
        .select()
        .from(servicePrices)
        .where(eq(servicePrices.id, "prc_pvc_aadhaar"))
        .limit(1);
      originalAadhaarPrice = p.length > 0 ? p[0].price : 50;
    });

    afterAll(async () => {
      await db
        .update(servicePrices)
        .set({ price: originalAadhaarPrice, updatedAt: Date.now() })
        .where(eq(servicePrices.id, "prc_pvc_aadhaar"));
    });

    it("should dynamically calculate future orders using updated database prices", async () => {
      // Initial calculation
      const initial = await calculatePvcPrice({ documentType: "aadhaar", copies: 2 });
      expect(initial.totalPrice).toBe(originalAadhaarPrice * 2);

      // Admin updates Aadhaar rate to ₹75 in database
      const newRate = 75;
      await db
        .update(servicePrices)
        .set({ price: newRate, updatedAt: Date.now() })
        .where(eq(servicePrices.id, "prc_pvc_aadhaar"));

      // Next calculation immediately reflects ₹75 (2 copies = ₹150)
      const updated = await calculatePvcPrice({ documentType: "aadhaar", copies: 2 });
      expect(updated.unitPrice).toBe(newRate);
      expect(updated.totalPrice).toBe(newRate * 2);

      // Reset back to original
      await db
        .update(servicePrices)
        .set({ price: originalAadhaarPrice, updatedAt: Date.now() })
        .where(eq(servicePrices.id, "prc_pvc_aadhaar"));

      const restored = await calculatePvcPrice({ documentType: "aadhaar", copies: 2 });
      expect(restored.totalPrice).toBe(originalAadhaarPrice * 2);
    });

    it("should dynamically pull authoritative lamination rates in document printing", async () => {
      const result = await calculateDocumentPrintPrice({
        paperSize: "A4",
        printMode: "bw",
        sides: "single",
        pageCount: 5,
        copies: 1,
        includeLamination: true,
      });

      // 5 pages B&W single = 5 * ₹3 = ₹15
      // 5 sheets A4 glossy lamination = 5 * ₹20 = ₹100
      // Total = ₹115
      expect(result.totalPrice).toBe(115);
      expect(result.breakdown.extraCharges).toBe(100);
    });

    it("should strictly preserve historical order prices when prices change later", async () => {
      // Find admin user or create fallback customer id
      const adminUsers = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
      const customerId = adminUsers[0]?.id || "usr_admin_default";

      const orderId = `ord_test_history_${Date.now()}`;
      const itemId = `itm_test_history_${Date.now()}`;
      const historicalUnitPrice = 45;
      const historicalQuantity = 3;
      const historicalTotal = 135;

      // Create an order with frozen price snapshot
      await db.insert(orders).values({
        id: orderId,
        orderReference: `BS-HIST-${Date.now().toString().slice(-4)}`,
        customerId: customerId,
        orderType: "print_service",
        status: "confirmed",
        paymentStatus: "paid",
        subtotal: historicalTotal,
        deliveryFee: 0,
        totalAmount: historicalTotal,
        deliveryType: "store_pickup",
      });

      await db.insert(orderItems).values({
        id: itemId,
        orderId: orderId,
        itemType: "pvc_card",
        serviceId: "srv_pvc",
        configurationJson: JSON.stringify({ documentType: "pan" }),
        quantity: historicalQuantity,
        pageCount: 1,
        unitPriceSnapshot: historicalUnitPrice,
        totalPriceSnapshot: historicalTotal,
      });

      // Now change the current database rate for PAN card
      await db
        .update(servicePrices)
        .set({ price: 99, updatedAt: Date.now() })
        .where(eq(servicePrices.id, "prc_pvc_pan"));

      // Verify that the historical order item snapshot was NOT rewritten
      const savedItem = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.id, itemId))
        .limit(1);

      expect(savedItem[0].unitPriceSnapshot).toBe(historicalUnitPrice);
      expect(savedItem[0].totalPriceSnapshot).toBe(historicalTotal);

      const savedOrder = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      expect(savedOrder[0].totalAmount).toBe(historicalTotal);

      // Clean up test order
      await db.delete(orderItems).where(eq(orderItems.id, itemId));
      await db.delete(orders).where(eq(orders.id, orderId));
      await db
        .update(servicePrices)
        .set({ price: 50, updatedAt: Date.now() })
        .where(eq(servicePrices.id, "prc_pvc_pan"));
    });
  });

  // =========================================================================
  // PART 4: Professional Homepage Architecture & Route Integrity
  // =========================================================================
  describe("PART 4: Professional Homepage Structure, Data & Accessibility", () => {
    const homeFilePath = path.join(process.cwd(), "src/app/page.tsx");
    const homeSource = fs.readFileSync(homeFilePath, "utf8");

    it("should link to all 5 dedicated services and products with exact routes", () => {
      expect(homeSource).toContain("/services/pvc-card");
      expect(homeSource).toContain("/services/document-printing");
      expect(homeSource).toContain("/services/lamination");
      expect(homeSource).toContain("/services/photo-printing");
      expect(homeSource).toContain("/shop");
    });

    it("should query verified shop settings rather than hardcoding business address", () => {
      expect(homeSource).toContain("getShopSettings()");
      expect(homeSource).toContain("shop.shopName");
      expect(homeSource).toContain("shop.cityTown");
      expect(homeSource).toContain("shop.openingHours");
      expect(homeSource).toContain("shop.upiId");
    });

    it("should query database-backed products and provide empty state fallback", () => {
      expect(homeSource).toContain("from(products)");
      expect(homeSource).toContain("where(eq(products.isAvailable, true))");
      expect(homeSource).toMatch(/Stationery Catalog Being Updated|productsWithImages\.length === 0/);
    });

    it("should respect prefers-reduced-motion for accessibility", () => {
      expect(homeSource).toContain("motion-reduce:transition-none");
    });

    it("should avoid fabricated customer reviews, fake awards or fake counters on the homepage", () => {
      expect(homeSource).not.toMatch(/10,000\+\s+happy|award\s+winning|5\s+star\s+rated\s+by\s+\d+/i);
    });

    it("should have clear primary and secondary calls to action", () => {
      expect(homeSource).toContain("Order Printing Online");
      expect(homeSource).toContain("Browse Stationery Shop");
    });
  });
});
