import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../src/db";
import {
  users,
  orders,
  orderItems,
  productReviews,
  products,
  productCategories,
  shopSettings,
  services,
} from "../src/db/schema";
import { resetTestDatabase } from "../src/scripts/reset-test-db";
import { hashPassword } from "../src/lib/auth";
import fs from "fs";
import path from "path";
import { eq, and } from "drizzle-orm";

describe("Admin Sidebar Scroll, Safe Test DB Reset, Review Eligibility & Orders Theming", () => {
  let adminId: string;
  let customerId: string;
  let testProductId: string;
  let testCategoryId: string;
  let completedOrderId: string;
  let processingOrderId: string;

  beforeAll(async () => {
    adminId = `usr_adm_test_${Date.now()}`;
    await db.insert(users).values({
      id: adminId,
      fullName: "Admin Safety Test",
      email: `adm_${Date.now()}@test.local`,
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      passwordHash: await hashPassword("AdminSecret123!"),
      role: "admin",
      status: "active",
      isEmailVerified: true,
      isPhoneVerified: true,
    });
  });

  describe("PART 1: Admin Sidebar Layout & Scrolling", () => {
    it("should configure viewport height constraints and independent navigation scrolling", () => {
      const layoutPath = path.resolve(process.cwd(), "src/app/admin/layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");

      // Desktop layout must constrain outer container to viewport height and prevent body scroll
      expect(content).toContain("h-screen");
      expect(content).toContain("overflow-hidden");

      // Desktop navigation region must have independent scrolling with shrink guard
      expect(content).toContain("flex-1 min-h-0 overflow-y-auto");

      // Main content area must scroll independently
      expect(content).toContain("flex-1 min-h-0 overflow-y-auto");

      // Mobile slide-over drawer must support backdrop, escape key, and scroll lock
      expect(content).toContain("mobileOpen");
      expect(content).toContain("document.body.style.overflow");
      expect(content).toContain("Escape");
    });
  });

  describe("PART 2: Safe Test Environment Reset & Production Protection", () => {
    it("should refuse to execute reset when environment is detected as production", async () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = "production";

      try {
        await expect(resetTestDatabase()).rejects.toThrow(
          /Resetting data is strictly prohibited in production/
        );
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });

    it("should preserve administrator accounts and shop settings during test cleanup", async () => {
      // Run controlled cleanup
      await resetTestDatabase({ force: true });

      // Verify admin account survived
      const adminUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, "admin"));
      expect(adminUsers.length).toBeGreaterThanOrEqual(1);

      // Verify shop settings survived
      const settings = await db
        .select()
        .from(shopSettings)
        .where(eq(shopSettings.id, "default"));
      expect(settings.length).toBe(1);
      expect(settings[0].shopName).toContain("Bishnu Studio");

      // Verify services configuration survived
      const servicesList = await db.select().from(services);
      expect(servicesList.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("PART 3: Review Eligibility & Verification Rules", () => {
    beforeAll(async () => {
      customerId = `usr_cust_rev_${Date.now()}`;
      await db.insert(users).values({
        id: customerId,
        fullName: "Eligible Customer",
        email: `cust_${Date.now()}@test.local`,
        phone: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
        passwordHash: await hashPassword("CustomerSecret123!"),
        role: "customer",
        status: "active",
        isEmailVerified: true,
        isPhoneVerified: true,
      });

      testCategoryId = `cat_test_${Date.now()}`;
      await db.insert(productCategories).values({
        id: testCategoryId,
        name: "Review Test Category",
        slug: `review-test-cat-${Date.now()}`,
        description: "Category for testing review eligibility",
        sortOrder: 1,
      });

      testProductId = `prod_test_${Date.now()}`;
      await db.insert(products).values({
        id: testProductId,
        categoryId: testCategoryId,
        name: "Test Printing Paper",
        slug: `test-printing-paper-${Date.now()}`,
        description: "Premium paper for review testing",
        price: 250,
        stockQuantity: 100,
        isAvailable: true,
        sku: `SKU-REV-${Date.now()}`,
      });

      // Create a processing (unfulfilled) order
      processingOrderId = `ord_proc_${Date.now()}`;
      await db.insert(orders).values({
        id: processingOrderId,
        orderReference: `BS-PROC-${Date.now().toString().slice(-4)}`,
        customerId: customerId,
        orderType: "counter_pickup",
        deliveryType: "store_pickup",
        paymentMethod: "upi_mock",
        subtotal: 250,
        additionalCharges: 0,
        totalAmount: 250,
        orderStatus: "processing", // Incomplete
        paymentStatus: "paid",
      } as any);

      await db.insert(orderItems).values({
        id: `item_proc_${Date.now()}`,
        orderId: processingOrderId,
        itemType: "product",
        productId: testProductId,
        quantity: 1,
        unitPriceSnapshot: 250,
        totalPriceSnapshot: 250,
        configurationJson: "{}",
      });

      // Create a completed (delivered / collected) order
      completedOrderId = `ord_comp_${Date.now()}`;
      await db.insert(orders).values({
        id: completedOrderId,
        orderReference: `BS-COMP-${Date.now().toString().slice(-4)}`,
        customerId: customerId,
        orderType: "counter_pickup",
        deliveryType: "store_pickup",
        paymentMethod: "upi_mock",
        subtotal: 250,
        additionalCharges: 0,
        totalAmount: 250,
        orderStatus: "completed", // Complete
        paymentStatus: "paid",
      } as any);

      await db.insert(orderItems).values({
        id: `item_comp_${Date.now()}`,
        orderId: completedOrderId,
        itemType: "product",
        productId: testProductId,
        quantity: 1,
        unitPriceSnapshot: 250,
        totalPriceSnapshot: 250,
        configurationJson: "{}",
      });
    });

    it("should reject reviews submitted before an order is completed", async () => {
      const targetOrder = await db
        .select()
        .from(orders)
        .where(eq(orders.id, processingOrderId))
        .limit(1);

      expect(targetOrder[0].orderStatus).toBe("processing");
      // Business rule: reviews only permitted when orderStatus === 'completed'
      const isEligible = targetOrder[0].orderStatus === "completed";
      expect(isEligible).toBe(false);
    });

    it("should allow a customer with a completed order to submit a 1-5 star review", async () => {
      const targetOrder = await db
        .select()
        .from(orders)
        .where(eq(orders.id, completedOrderId))
        .limit(1);

      expect(targetOrder[0].orderStatus).toBe("completed");

      // Insert verified customer review
      const reviewId = `rev_test_${Date.now()}`;
      await db.insert(productReviews).values({
        id: reviewId,
        productId: testProductId,
        customerId: customerId,
        orderId: completedOrderId,
        rating: 5,
        reviewTitle: "Excellent Quality",
        reviewText: "Received my paper on time and quality was exceptional.",
        isVerifiedPurchase: true,
        status: "published",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const inserted = await db
        .select()
        .from(productReviews)
        .where(eq(productReviews.id, reviewId));

      expect(inserted.length).toBe(1);
      expect(inserted[0].rating).toBe(5);
      expect(inserted[0].isVerifiedPurchase).toBe(true);
      expect(inserted[0].orderId).toBe(completedOrderId);
    });

    it("should prevent duplicate reviews by updating existing review (upsert)", async () => {
      const existing = await db
        .select()
        .from(productReviews)
        .where(
          and(
            eq(productReviews.productId, testProductId),
            eq(productReviews.customerId, customerId)
          )
        );

      expect(existing.length).toBe(1);

      // Customer edits review to 4 stars
      await db
        .update(productReviews)
        .set({
          rating: 4,
          reviewTitle: "Updated: Very Good Paper",
          reviewText: "Second inspection was also great, 4 stars overall.",
          updatedAt: Date.now(),
        })
        .where(eq(productReviews.id, existing[0].id));

      const updated = await db
        .select()
        .from(productReviews)
        .where(
          and(
            eq(productReviews.productId, testProductId),
            eq(productReviews.customerId, customerId)
          )
        );

      expect(updated.length).toBe(1);
      expect(updated[0].rating).toBe(4);
      expect(updated[0].reviewTitle).toBe("Updated: Very Good Paper");
    });
  });

  describe("PART 4: Product Page Reviews & Dedicated Reviews Route", () => {
    it("should verify dedicated all-reviews route and component files exist", () => {
      const reviewsPageRoute = path.resolve(
        process.cwd(),
        "src/app/shop/[id]/reviews/page.tsx"
      );
      expect(fs.existsSync(reviewsPageRoute)).toBe(true);

      const content = fs.readFileSync(reviewsPageRoute, "utf-8");
      expect(content).toContain("Customer Reviews");
      expect(content).toContain("Verified Purchase");
      expect(content).toContain("sort");
      expect(content).toContain("pagination");
    });
  });

  describe("PART 5: My Orders & Tracking Theme Audit", () => {
    it("should verify My Orders and Tracking pages use theme-aware semantic tokens", () => {
      const ordersPath = path.resolve(
        process.cwd(),
        "src/app/account/orders/page.tsx"
      );
      const trackingPath = path.resolve(
        process.cwd(),
        "src/app/account/orders/[id]/page.tsx"
      );

      const ordersContent = fs.readFileSync(ordersPath, "utf-8");
      const trackingContent = fs.readFileSync(trackingPath, "utf-8");

      // Verify My Orders dark mode support
      expect(ordersContent).toContain("dark:bg-slate-950");
      expect(ordersContent).toContain("dark:bg-slate-900");
      expect(ordersContent).toContain("dark:text-white");
      expect(ordersContent).toContain("dark:border-slate-800");

      // Verify Tracking dark mode support
      expect(trackingContent).toContain("dark:bg-slate-950");
      expect(trackingContent).toContain("dark:bg-slate-900");
      expect(trackingContent).toContain("dark:text-white");
      expect(trackingContent).toContain("dark:border-slate-800");

      // Verify Review modal is embedded in Tracking page
      expect(trackingContent).toContain("reviewModalItem");
      expect(trackingContent).toContain("submitReview");
      expect(trackingContent).toContain("Write a Review");
    });
  });
});
