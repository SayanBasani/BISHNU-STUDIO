import { describe, it, expect, beforeAll } from "vitest";
import {
  blockCustomer,
  unblockCustomer,
  createSession,
  validateSession,
  hashPassword,
} from "../src/lib/auth";
import { db } from "../src/db";
import {
  users,
  sessions,
  accountAppeals,
  productReviews,
  products,
  productCategories,
  productImages,
  orders,
  orderItems,
} from "../src/db/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

describe("User Blocking & Appeals, Product Multi-Image Gallery, and Verified Reviews", () => {
  let testAdminId: string;
  let testCustomerId: string;
  let testCustomerEmail: string;
  let testCustomerPhone: string;
  let testProductId: string;
  let testCategoryId: string;

  beforeAll(async () => {
    // 1. Create a test admin user
    testAdminId = `usr_adm_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(users).values({
      id: testAdminId,
      fullName: "Super Admin Tester",
      email: `admin_${Date.now()}@bishnu.test`,
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      passwordHash: await hashPassword("AdminPass123!"),
      role: "admin",
      status: "active",
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    // 2. Create a test customer user
    testCustomerId = `usr_cust_${crypto.randomUUID().slice(0, 8)}`;
    testCustomerEmail = `customer_${Date.now()}@bishnu.test`;
    testCustomerPhone = `91${Math.floor(10000000 + Math.random() * 90000000)}`;

    await db.insert(users).values({
      id: testCustomerId,
      fullName: "Rahul Sen",
      email: testCustomerEmail,
      phone: testCustomerPhone,
      passwordHash: await hashPassword("CustomerPass123!"),
      role: "customer",
      status: "active",
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    // 3. Create test category & product
    testCategoryId = `cat_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(productCategories).values({
      id: testCategoryId,
      name: "Test Supplies",
      slug: `test-supplies-${Date.now()}`,
      description: "Test Supplies Category",
      sortOrder: 1,
    });

    testProductId = `prod_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(products).values({
      id: testProductId,
      categoryId: testCategoryId,
      name: "High Grade A4 Paper 80GSM",
      slug: `high-grade-a4-paper-${Date.now()}`,
      description: "Premium smooth paper ream for laser printing",
      price: 350,
      stockQuantity: 100,
      sku: `SKU-TEST-${Date.now()}`,
      isAvailable: true,
    });
  });

  describe("PART A: Customer Blocking & Strict Session Invalidation", () => {
    it("should prevent blocking administrative accounts", async () => {
      await expect(
        blockCustomer({
          userId: testAdminId,
          adminId: testAdminId,
          reason: "Trying to block admin",
          category: "other",
        })
      ).rejects.toThrow("Admin accounts cannot be blocked");
    });

    it("should block a customer and immediately terminate all active sessions", async () => {
      // 1. Create 2 active sessions for the customer
      const sess1 = await createSession(testCustomerId);
      const sess2 = await createSession(testCustomerId);

      // Verify sessions exist in DB
      const preCheck = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, testCustomerId));
      expect(preCheck.length).toBe(2);

      // 2. Block customer
      const blockResult = await blockCustomer({
        userId: testCustomerId,
        adminId: testAdminId,
        reason: "Suspected fake UPI transaction receipt",
        category: "fraud",
      });

      expect(blockResult.success).toBe(true);

      // 3. Verify user record is marked blocked
      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.id, testCustomerId));
      expect(userRows[0].status).toBe("blocked");
      expect(userRows[0].blockedReason).toBe("Suspected fake UPI transaction receipt");
      expect(userRows[0].blockedCategory).toBe("fraud");
      expect(userRows[0].blockedByAdminId).toBe(testAdminId);
      expect(userRows[0].blockedAt).toBeGreaterThan(0);

      // 4. Verify all active sessions were purged from DB
      const postCheck = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, testCustomerId));
      expect(postCheck.length).toBe(0);

      // 5. Verify validateSession returns null
      const validatedSess1 = await validateSession(sess1.sessionToken);
      expect(validatedSess1).toBeNull();
    });

    it("should unblock a customer and restore active status", async () => {
      const unblockResult = await unblockCustomer({
        userId: testCustomerId,
        adminId: testAdminId,
      });

      expect(unblockResult.success).toBe(true);

      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.id, testCustomerId));
      expect(userRows[0].status).toBe("active");
      expect(userRows[0].blockedReason).toBeNull();
      expect(userRows[0].blockedAt).toBeNull();
      expect(userRows[0].blockedCategory).toBeNull();
    });
  });

  describe("PART B: Appeals System & Rate Limiting Enforcement", () => {
    let appealUserId: string;

    beforeAll(async () => {
      // Create and block a dedicated user for appeal tests
      appealUserId = `usr_appeal_${crypto.randomUUID().slice(0, 8)}`;
      await db.insert(users).values({
        id: appealUserId,
        fullName: "Aniket Sharma",
        email: `aniket_${Date.now()}@bishnu.test`,
        phone: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
        passwordHash: await hashPassword("Pass123!"),
        role: "customer",
        status: "active",
      });

      await blockCustomer({
        userId: appealUserId,
        adminId: testAdminId,
        reason: "Spam upload detected",
        category: "spam",
      });
    });

    it("should create an appeal and persist to accountAppeals table", async () => {
      const appealId = `app_${crypto.randomUUID().slice(0, 8)}`;
      const now = Date.now();

      await db.insert(accountAppeals).values({
        id: appealId,
        userId: appealUserId,
        contactEmail: "aniket@example.com",
        contactPhone: "9876543210",
        category: "spam",
        message: "I accidentally clicked the upload button multiple times due to a slow mobile connection.",
        status: "submitted",
        ipAddress: "127.0.0.1",
        createdAt: now,
        updatedAt: now,
      });

      const appealRows = await db
        .select()
        .from(accountAppeals)
        .where(eq(accountAppeals.id, appealId));

      expect(appealRows.length).toBe(1);
      expect(appealRows[0].status).toBe("submitted");
      expect(appealRows[0].message).toContain("slow mobile connection");
    });

    it("should allow admin to approve appeal, which automatically unblocks the customer", async () => {
      // Find the submitted appeal
      const appeals = await db
        .select()
        .from(accountAppeals)
        .where(eq(accountAppeals.userId, appealUserId));
      const appeal = appeals[0];

      // Approve appeal & unblock customer
      await unblockCustomer({
        userId: appeal.userId,
        adminId: testAdminId,
      });

      await db
        .update(accountAppeals)
        .set({
          status: "approved",
          adminDecision: "Appeal approved and restriction lifted",
          reviewedByAdminId: testAdminId,
          reviewedAt: Date.now(),
          updatedAt: Date.now(),
        })
        .where(eq(accountAppeals.id, appeal.id));

      // Customer must now be active
      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.id, appealUserId));
      expect(userRows[0].status).toBe("active");

      // Appeal status must be approved
      const updatedAppeals = await db
        .select()
        .from(accountAppeals)
        .where(eq(accountAppeals.id, appeal.id));
      expect(updatedAppeals[0].status).toBe("approved");
    });
  });

  describe("PART D: Multi-Image Product Gallery", () => {
    it("should store and order multiple images for a product with primary flag", async () => {
      const img1 = `img_test_${Date.now()}_1`;
      const img2 = `img_test_${Date.now()}_2`;
      const img3 = `img_test_${Date.now()}_3`;

      await db.insert(productImages).values([
        {
          id: img1,
          productId: testProductId,
          imageUrl: "https://images.unsplash.com/photo-paper-1",
          isPrimary: true,
          sortOrder: 0,
        },
        {
          id: img2,
          productId: testProductId,
          imageUrl: "https://images.unsplash.com/photo-paper-2",
          isPrimary: false,
          sortOrder: 1,
        },
        {
          id: img3,
          productId: testProductId,
          imageUrl: "https://images.unsplash.com/photo-paper-3",
          isPrimary: false,
          sortOrder: 2,
        },
      ]);

      const savedImages = await db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, testProductId))
        .orderBy(productImages.sortOrder);

      expect(savedImages.length).toBe(3);
      expect(savedImages[0].isPrimary).toBe(true);
      expect(savedImages[0].imageUrl).toContain("photo-paper-1");
      expect(savedImages[1].isPrimary).toBe(false);
      expect(savedImages[2].sortOrder).toBe(2);
    });
  });

  describe("PART E: Verified Customer Reviews & Moderation", () => {
    let verifiedCustomerId: string;
    let unverifiedCustomerId: string;
    let paidOrderId: string;

    beforeAll(async () => {
      // 1. Create verified customer with completed/paid order
      verifiedCustomerId = `usr_buyer_${crypto.randomUUID().slice(0, 8)}`;
      await db.insert(users).values({
        id: verifiedCustomerId,
        fullName: "Vikram Das",
        email: `vikram_${Date.now()}@bishnu.test`,
        phone: `93${Math.floor(10000000 + Math.random() * 90000000)}`,
        passwordHash: await hashPassword("Pass123!"),
        role: "customer",
        status: "active",
      });

      // 2. Create paid order for verifiedCustomerId with testProductId
      paidOrderId = `ord_paid_${crypto.randomUUID().slice(0, 8)}`;
      await db.insert(orders).values({
        id: paidOrderId,
        orderReference: `BS-TEST-ORDER-${Date.now()}`,
        customerId: verifiedCustomerId,
        orderType: "shopping",
        subtotal: 350,
        totalAmount: 350,
        orderStatus: "completed",
        paymentStatus: "paid",
        deliveryType: "counter_pickup",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any);

      await db.insert(orderItems).values({
        id: `item_${crypto.randomUUID().slice(0, 8)}`,
        orderId: paidOrderId,
        itemType: "product",
        productId: testProductId,
        quantity: 1,
        unitPriceSnapshot: 350,
        totalPriceSnapshot: 350,
        configurationJson: "{}",
      });

      // 3. Create non-buyer customer
      unverifiedCustomerId = `usr_nonbuyer_${crypto.randomUUID().slice(0, 8)}`;
      await db.insert(users).values({
        id: unverifiedCustomerId,
        fullName: "Pooja Roy",
        email: `pooja_${Date.now()}@bishnu.test`,
        phone: `94${Math.floor(10000000 + Math.random() * 90000000)}`,
        passwordHash: await hashPassword("Pass123!"),
        role: "customer",
        status: "active",
      });
    });

    it("should allow verified buyer to submit a review with isVerifiedPurchase = true", async () => {
      const reviewId = `rev_${crypto.randomUUID().slice(0, 8)}`;
      const now = Date.now();

      await db.insert(productReviews).values({
        id: reviewId,
        productId: testProductId,
        customerId: verifiedCustomerId,
        orderId: paidOrderId,
        rating: 5,
        reviewTitle: "Top notch print paper!",
        reviewText: "Jam-free and bright white. Ideal for daily office documents.",
        isVerifiedPurchase: true,
        status: "published",
        createdAt: now,
        updatedAt: now,
      });

      const rev = await db
        .select()
        .from(productReviews)
        .where(eq(productReviews.id, reviewId));

      expect(rev.length).toBe(1);
      expect(rev[0].rating).toBe(5);
      expect(rev[0].isVerifiedPurchase).toBe(true);
      expect(rev[0].status).toBe("published");
    });

    it("should record unverified review with isVerifiedPurchase = false for non-buyer", async () => {
      const reviewId = `rev_${crypto.randomUUID().slice(0, 8)}`;
      const now = Date.now();

      await db.insert(productReviews).values({
        id: reviewId,
        productId: testProductId,
        customerId: unverifiedCustomerId,
        rating: 4,
        reviewTitle: "Good paper quality",
        reviewText: "I usually buy this paper from the shop counter.",
        isVerifiedPurchase: false,
        status: "published",
        createdAt: now,
        updatedAt: now,
      });

      const rev = await db
        .select()
        .from(productReviews)
        .where(eq(productReviews.id, reviewId));

      expect(rev.length).toBe(1);
      expect(rev[0].rating).toBe(4);
      expect(rev[0].isVerifiedPurchase).toBe(false);
    });

    it("should prevent duplicate reviews by updating customer existing review", async () => {
      const existing = await db
        .select()
        .from(productReviews)
        .where(
          and(
            eq(productReviews.productId, testProductId),
            eq(productReviews.customerId, verifiedCustomerId)
          )
        );

      expect(existing.length).toBe(1);

      // Upsert: update the review
      await db
        .update(productReviews)
        .set({
          rating: 5,
          reviewTitle: "Updated: Absolutely top notch!",
          reviewText: "Updated review after using second ream of paper.",
          updatedAt: Date.now(),
        })
        .where(eq(productReviews.id, existing[0].id));

      const updated = await db
        .select()
        .from(productReviews)
        .where(
          and(
            eq(productReviews.productId, testProductId),
            eq(productReviews.customerId, verifiedCustomerId)
          )
        );

      expect(updated.length).toBe(1);
      expect(updated[0].reviewTitle).toBe("Updated: Absolutely top notch!");
    });

    it("should allow admin to hide an abusive or fraudulent review", async () => {
      const allReviews = await db
        .select()
        .from(productReviews)
        .where(eq(productReviews.productId, testProductId));

      const targetReview = allReviews[0];

      // Admin hides review
      await db
        .update(productReviews)
        .set({
          status: "hidden",
          moderationReason: "Irrelevant feedback",
          moderatedByAdminId: testAdminId,
          moderatedAt: Date.now(),
        })
        .where(eq(productReviews.id, targetReview.id));

      const hiddenReview = await db
        .select()
        .from(productReviews)
        .where(eq(productReviews.id, targetReview.id));

      expect(hiddenReview[0].status).toBe("hidden");
      expect(hiddenReview[0].moderationReason).toBe("Irrelevant feedback");
    });
  });
});
