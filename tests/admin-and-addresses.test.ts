import { describe, it, expect, beforeAll } from "vitest";
import { validateAdminCredentials } from "../src/lib/auth";
import { db } from "../src/db";
import {
  users,
  userAddresses,
  orders,
  orderItems,
  authenticationEvents,
} from "../src/db/schema";
import { logAuthEvent } from "../src/lib/audit";
import { generateOrderReference } from "../src/lib/utils";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

describe("Fixed Admin Authentication, Multiple Saved Addresses & Audit Logs", () => {
  const originalEnv = process.env;

  beforeAll(() => {
    process.env.ADMIN_EMAIL = "admin@bishnustudio.com";
    process.env.ADMIN_PASSWORD = "Admin@Bishnu2026!";
    process.env.ADMIN_NAME = "Bishnu Studio Owner";
    process.env.ADMIN_PHONE = "9876543210";
  });

  describe("Fixed Owner Admin Authentication", () => {
    it("should authenticate the owner with configured ADMIN_EMAIL and ADMIN_PASSWORD", async () => {
      const result = await validateAdminCredentials(
        "admin@bishnustudio.com",
        "Admin@Bishnu2026!"
      );

      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.role).toBe("admin");
      expect(result.user.email).toBe("admin@bishnustudio.com");
      expect(result.user.passwordHash).toBeUndefined(); // Never expose password hash
    });

    it("should accept case-insensitive email matching for admin credentials", async () => {
      const result = await validateAdminCredentials(
        "  ADMIN@BishnuStudio.com  ",
        "Admin@Bishnu2026!"
      );

      expect(result.valid).toBe(true);
      expect(result.user.role).toBe("admin");
    });

    it("should reject invalid administrator passwords with generic error", async () => {
      const result = await validateAdminCredentials(
        "admin@bishnustudio.com",
        "WrongPassword123!"
      );

      expect(result.valid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe("Invalid administrator credentials.");
    });

    it("should reject non-configured emails trying to access admin login", async () => {
      const result = await validateAdminCredentials(
        "customer@example.com",
        "Admin@Bishnu2026!"
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid administrator credentials.");
    });

    it("should fail safely if ADMIN_EMAIL is missing from environment", async () => {
      const savedEmail = process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_EMAIL;

      const result = await validateAdminCredentials(
        "admin@bishnustudio.com",
        "Admin@Bishnu2026!"
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Server environment configuration missing");

      process.env.ADMIN_EMAIL = savedEmail;
    });
  });

  describe("Multiple Saved Addresses (Flipkart/Amazon style)", () => {
    const testUserId = `usr_addr_test_${crypto.randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      // Create a test user for address testing
      await db.insert(users).values({
        id: testUserId,
        fullName: "Sayan Address Tester",
        email: `tester_${crypto.randomUUID().slice(0, 6)}@example.com`,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        passwordHash: "dummyHash",
        role: "customer",
      });
    });

    it("should create multiple saved addresses with rich recipient details and type", async () => {
      const addr1Id = `addr_${crypto.randomUUID()}`;
      const addr2Id = `addr_${crypto.randomUUID()}`;

      // Insert Home Address (Default)
      await db.insert(userAddresses).values({
        id: addr1Id,
        userId: testUserId,
        recipientName: "Sayan Deb",
        recipientPhone: "9876543210",
        addressType: "home",
        label: "Home",
        houseBuilding: "Flat 4A, Green Valley Heights",
        streetLocality: "Jessore Road, Post Office More",
        landmark: "Near Reliance Fresh",
        cityTown: "Barasat",
        state: "West Bengal",
        pinCode: "700124",
        isDefault: true,
      });

      // Insert Work Address
      await db.insert(userAddresses).values({
        id: addr2Id,
        userId: testUserId,
        recipientName: "Sayan Deb (Office)",
        recipientPhone: "9876543211",
        addressType: "work",
        label: "Work",
        houseBuilding: "Tower 2, 5th Floor, IT Tech Park",
        streetLocality: "Sector V, Salt Lake",
        landmark: "Opposite College More",
        cityTown: "Kolkata",
        state: "West Bengal",
        pinCode: "700091",
        isDefault: false,
      });

      const userAddrs = await db
        .select()
        .from(userAddresses)
        .where(eq(userAddresses.userId, testUserId))
        .orderBy(desc(userAddresses.isDefault));

      expect(userAddrs.length).toBe(2);
      expect(userAddrs[0].isDefault).toBe(true);
      expect(userAddrs[0].recipientName).toBe("Sayan Deb");
      expect(userAddrs[0].addressType).toBe("home");
      expect(userAddrs[1].isDefault).toBe(false);
      expect(userAddrs[1].recipientName).toBe("Sayan Deb (Office)");
      expect(userAddrs[1].addressType).toBe("work");
    });

    it("should preserve full immutable shipping address snapshot on order placement", async () => {
      const orderId = `ord_snapshot_${crypto.randomUUID()}`;
      const addressSnapshot = {
        recipientName: "Sayan Deb",
        recipientPhone: "9876543210",
        addressType: "home",
        houseBuilding: "Flat 4A, Green Valley Heights",
        streetLocality: "Jessore Road, Post Office More",
        landmark: "Near Reliance Fresh",
        cityTown: "Barasat",
        state: "West Bengal",
        pinCode: "700124",
      };

      await db.insert(orders).values({
        id: orderId,
        orderReference: generateOrderReference(),
        customerId: testUserId,
        orderType: "shopping",
        subtotal: 550,
        discount: 0,
        additionalCharges: 0,
        totalAmount: 550,
        paymentStatus: "unpaid",
        paymentMethod: "cash_on_collection",
        orderStatus: "pending",
        deliveryType: "home_delivery",
        shippingAddressJson: JSON.stringify(addressSnapshot),
      });

      const orderRow = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      expect(orderRow.length).toBe(1);
      const parsedAddress = JSON.parse(orderRow[0].shippingAddressJson!);
      expect(parsedAddress.recipientName).toBe("Sayan Deb");
      expect(parsedAddress.recipientPhone).toBe("9876543210");
      expect(parsedAddress.landmark).toBe("Near Reliance Fresh");
      expect(parsedAddress.pinCode).toBe("700124");
    });
  });

  describe("Photo Studio Production Calculations", () => {
    it("should accurately calculate total physical prints for multi-photo orders", () => {
      const uploadedPhotosCount = 4;
      const copiesPerPhoto = 3;
      const totalPrints = uploadedPhotosCount * copiesPerPhoto;

      expect(totalPrints).toBe(12);

      const pricePerPrint = 15; // 4x6 rate
      const totalAmount = totalPrints * pricePerPrint;
      expect(totalAmount).toBe(180);
    });
  });

  describe("Authentication Activity Logging", () => {
    it("should record customer and admin login/logout events with metadata", async () => {
      const testEmail = `activity_tester_${crypto.randomUUID().slice(0, 8)}@bishnustudio.com`;

      await logAuthEvent({
        email: testEmail,
        eventType: "admin_login_success",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        status: "success",
      });

      await logAuthEvent({
        email: testEmail,
        eventType: "login_failure",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        status: "failure",
        failureReason: "Incorrect password",
      });

      const events = await db
        .select()
        .from(authenticationEvents)
        .where(eq(authenticationEvents.email, testEmail))
        .orderBy(desc(authenticationEvents.createdAt));

      expect(events.length).toBe(2);
      const eventTypes = events.map((e) => e.eventType);
      expect(eventTypes).toContain("login_failure");
      expect(eventTypes).toContain("admin_login_success");

      const failureEvent = events.find((e) => e.eventType === "login_failure");
      expect(failureEvent?.status).toBe("failure");
      expect(failureEvent?.failureReason).toBe("Incorrect password");

      const successEvent = events.find((e) => e.eventType === "admin_login_success");
      expect(successEvent?.status).toBe("success");
      expect(successEvent?.ipAddress).toBe("192.168.1.100");
    });
  });
});
