import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "fs";
import path from "path";
import { db } from "../src/db";
import {
  shopUpiAccounts,
  paymentSubmissions,
  payments,
  orders,
  users,
  shopSettings,
  developerProfile,
} from "../src/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  getActiveUpiAccount,
  getAllUpiAccounts,
  switchActiveUpiAccount,
  isValidUpiId,
  getDeveloperProfile,
  updateDeveloperProfile,
  DEFAULT_DEVELOPER_PROFILE,
} from "../src/lib/settings";
import * as authModule from "../src/lib/auth";
import { GET as getReconciliation, POST as postSwitchAccount } from "../src/app/api/admin/payments/reconciliation/route";
import { GET as exportReconciliationCsv } from "../src/app/api/admin/payments/reconciliation/export/route";
import { GET as getPublicDeveloper } from "../src/app/api/developer/route";
import { GET as getAdminDeveloper, PUT as putAdminDeveloper } from "../src/app/api/admin/developer/route";
import { NextRequest } from "next/server";

describe("Bishnu Studio — UPI Account History, Payment Reconciliation & Developer Credits", () => {
  let adminUser: any;
  let customerUser: any;
  let testOrderId: string;

  beforeAll(async () => {
    // 1. Get or create admin user
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);

    if (existingAdmin.length > 0) {
      adminUser = existingAdmin[0];
    } else {
      const now = Date.now();
      const newAdmin = {
        id: `user_admin_test_${now}`,
        email: `admin_${now}@bishnustudio.com`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
        fullName: "Test Admin",
        role: "admin" as const,
        phone: "9876543210",
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(users).values(newAdmin);
      adminUser = newAdmin;
    }

    // 2. Get or create customer user
    const existingCust = await db
      .select()
      .from(users)
      .where(eq(users.role, "customer"))
      .limit(1);

    if (existingCust.length > 0) {
      customerUser = existingCust[0];
    } else {
      const now = Date.now();
      const newCust = {
        id: `user_cust_test_${now}`,
        email: `cust_${now}@example.com`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
        fullName: "Test Customer",
        role: "customer" as const,
        phone: "9876543211",
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(users).values(newCust);
      customerUser = newCust;
    }
  });

  // =========================================================================
  // PART 1: Permanent UPI Receiving Account History & Immutability
  // =========================================================================
  describe("PART 1: Permanent Receiving UPI Account History", () => {
    it("should retrieve or bootstrap an active receiving UPI account", async () => {
      const active = await getActiveUpiAccount();
      expect(active).toBeDefined();
      expect(active.id).toBeDefined();
      expect(active.upiId).toContain("@");
      expect(active.isActive).toBe(true);
      expect(active.deactivatedAt).toBeNull();
    });

    it("should validate UPI ID handle format accurately", () => {
      expect(isValidUpiId("bishnustudio@icici")).toBe(true);
      expect(isValidUpiId("9735154080@slc")).toBe(true);
      expect(isValidUpiId("shop.owner@okaxis")).toBe(true);
      expect(isValidUpiId("invalid_no_bank")).toBe(false);
      expect(isValidUpiId("@nohandle")).toBe(false);
      expect(isValidUpiId("spaces in@handle")).toBe(false);
    });

    it("should switch active account without erasing or overwriting historical accounts", async () => {
      const initialActive = await getActiveUpiAccount();
      const uniqueSuffix = Date.now().toString().slice(-4);
      const newUpiId = `bishnu.new${uniqueSuffix}@sbi`;
      const newDisplayName = `Bishnu Studio SBI Current ${uniqueSuffix}`;

      const switched = await switchActiveUpiAccount({
        upiId: newUpiId,
        accountDisplayName: newDisplayName,
        merchantName: "Bishnu Studio",
        adminUserId: adminUser.id,
      });

      expect(switched.id).not.toBe(initialActive.id);
      expect(switched.upiId).toBe(newUpiId);
      expect(switched.accountDisplayName).toBe(newDisplayName);
      expect(switched.isActive).toBe(true);

      // Verify the previous account is now deactivated but preserved
      const prevAccountRows = await db
        .select()
        .from(shopUpiAccounts)
        .where(eq(shopUpiAccounts.id, initialActive.id));

      expect(prevAccountRows.length).toBe(1);
      expect(prevAccountRows[0].isActive).toBe(false);
      expect(prevAccountRows[0].deactivatedAt).toBeTypeOf("number");

      // Verify getAllUpiAccounts includes both
      const allAccounts = await getAllUpiAccounts();
      const foundSwitched = allAccounts.find((a) => a.id === switched.id);
      const foundPrevious = allAccounts.find((a) => a.id === initialActive.id);

      expect(foundSwitched).toBeDefined();
      expect(foundPrevious).toBeDefined();
      expect(foundSwitched?.isActive).toBe(true);
      expect(foundPrevious?.isActive).toBe(false);
    });

    it("should preserve snapshot on past orders even when receiving account changes later", async () => {
      const activeAccount = await getActiveUpiAccount();
      const now = Date.now();
      const testOrderId = `ord_rec_test_${now}`;
      const testSubId = `sub_rec_test_${now}`;

      // 1. Create a dummy order
      await db.insert(orders).values({
        id: testOrderId,
        orderReference: `BST-REC-${now.toString().slice(-6)}`,
        customerId: customerUser.id,
        status: "processing",
        paymentStatus: "awaiting_verification",
        orderType: "retail_product",
        subtotal: 499,
        totalAmount: 499,
        deliveryFee: 0,
        finalPayable: 499,
        deliveryType: "store_pickup",
        shippingAddressId: null,
        notes: "Reconciliation Test Order",
        createdAt: now,
        updatedAt: now,
      } as any);

      // 2. Submit payment recording snapshot of activeAccount
      await db.insert(paymentSubmissions).values({
        id: testSubId,
        orderId: testOrderId,
        customerId: customerUser.id,
        amount: 499,
        receivingAccountId: activeAccount.id,
        receivingUpiIdSnapshot: activeAccount.upiId,
        receivingAccountNameSnapshot: activeAccount.accountDisplayName,
        upiIdUsed: activeAccount.upiId,
        transactionId: `RECUTR${now.toString().slice(-8)}`,
        status: "pending_verification",
        submissionType: "standard",
        createdAt: now,
        updatedAt: now,
      });

      // 3. Switch receiving account to a brand new one
      const brandNewUpi = `future.acc${now.toString().slice(-4)}@hdfcbank`;
      await switchActiveUpiAccount({
        upiId: brandNewUpi,
        accountDisplayName: "Future HDFC Account",
        adminUserId: adminUser.id,
      });

      // 4. Assert that the past submission retains its original snapshot!
      const pastSubmission = await db
        .select()
        .from(paymentSubmissions)
        .where(eq(paymentSubmissions.id, testSubId))
        .limit(1);

      expect(pastSubmission.length).toBe(1);
      expect(pastSubmission[0].receivingAccountId).toBe(activeAccount.id);
      expect(pastSubmission[0].receivingUpiIdSnapshot).toBe(activeAccount.upiId);
      expect(pastSubmission[0].receivingAccountNameSnapshot).toBe(activeAccount.accountDisplayName);
      expect(pastSubmission[0].receivingUpiIdSnapshot).not.toBe(brandNewUpi);
    });
  });

  // =========================================================================
  // PART 2: Reconciliation API & Financial Isolation
  // =========================================================================
  describe("PART 2: Reconciliation API & Financial Isolation", () => {
    it("should reject non-admin access to reconciliation API with 403", async () => {
      vi.spyOn(authModule, "getAuthSession").mockResolvedValueOnce({
        user: { id: customerUser.id, email: customerUser.email, role: "customer", fullName: "Customer" },
        session: { id: "sess_1" } as any,
      });

      const req = new NextRequest("http://localhost:3000/api/admin/payments/reconciliation");
      const res = await getReconciliation(req);
      expect(res.status).toBe(403);
    });

    it("should return accounts, activeAccount, isolated metrics, and records for admin", async () => {
      vi.spyOn(authModule, "getAuthSession").mockResolvedValueOnce({
        user: { id: adminUser.id, email: adminUser.email, role: "admin", fullName: "Admin" },
        session: { id: "sess_1" } as any,
      });

      const req = new NextRequest("http://localhost:3000/api/admin/payments/reconciliation");
      const res = await getReconciliation(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.accounts)).toBe(true);
      expect(data.activeAccount).toBeDefined();
      expect(data.overallMetrics).toBeDefined();
      expect(typeof data.overallMetrics.totalVerifiedRevenue).toBe("number");
      expect(typeof data.overallMetrics.totalPendingReview).toBe("number");
      expect(typeof data.overallMetrics.totalRejectedAmount).toBe("number");
      expect(Array.isArray(data.records)).toBe(true);
      expect(data.pagination).toBeDefined();
    });

    it("should allow admin to switch active account via POST /api/admin/payments/reconciliation", async () => {
      vi.spyOn(authModule, "getAuthSession").mockResolvedValueOnce({
        user: { id: adminUser.id, email: adminUser.email, role: "admin", fullName: "Admin" },
        session: { id: "sess_1" } as any,
      });

      const postBody = {
        upiId: `switch.post${Date.now().toString().slice(-4)}@icici`,
        accountDisplayName: "API Switched Account",
        merchantName: "Bishnu Studio",
      };

      const req = new NextRequest("http://localhost:3000/api/admin/payments/reconciliation", {
        method: "POST",
        body: JSON.stringify(postBody),
      });

      const res = await postSwitchAccount(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.account.upiId).toBe(postBody.upiId);
    });
  });

  // =========================================================================
  // PART 3: Reconciliation CSV Export
  // =========================================================================
  describe("PART 3: Reconciliation CSV Export", () => {
    it("should reject unauthenticated or non-admin export requests with 403", async () => {
      vi.spyOn(authModule, "getAuthSession").mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/admin/payments/reconciliation/export");
      const res = await exportReconciliationCsv(req);
      expect(res.status).toBe(403);
    });

    it("should generate valid CSV attachment with snapshot column headers for admin", async () => {
      vi.spyOn(authModule, "getAuthSession").mockResolvedValueOnce({
        user: { id: adminUser.id, email: adminUser.email, role: "admin", fullName: "Admin" },
        session: { id: "sess_1" } as any,
      });

      const req = new NextRequest("http://localhost:3000/api/admin/payments/reconciliation/export");
      const res = await exportReconciliationCsv(req);
      expect(res.status).toBe(200);

      const contentType = res.headers.get("Content-Type");
      const contentDisposition = res.headers.get("Content-Disposition");
      expect(contentType).toContain("text/csv");
      expect(contentDisposition).toContain("attachment; filename=");

      const csvText = await res.text();
      expect(csvText).toContain("Order Reference");
      expect(csvText).toContain("Intended Receiving UPI ID");
      expect(csvText).toContain("Transaction ID / UTR");
      expect(csvText).toContain("Receiving Account Name");
    });
  });

  // =========================================================================
  // PART 4: Developer Profile & Credits Management
  // =========================================================================
  describe("PART 4: Developer Profile & Authorship Credits", () => {
    it("should return the developer profile with credits statement", async () => {
      const profile = await getDeveloperProfile();
      expect(profile).toBeDefined();
      expect(profile.developerName).toBeDefined();
      expect(profile.creditsStatement).toContain("Sayan");
      expect(profile.creditsStatement).toContain("Bishnu Studio");
      expect(Array.isArray(profile.skills)).toBe(true);
      expect(profile.skills.length).toBeGreaterThan(0);
    });

    it("should update developer profile cleanly with valid URLs", async () => {
      const updated = await updateDeveloperProfile(
        {
          developerName: "Sayan",
          professionalTitle: "Lead Full-Stack & Antigravity Systems Engineer",
          biography: "Lead architect of the Bishnu Studio digital platform, specialized in high-integrity payment systems.",
          portfolioUrl: "https://example.com/sayan",
          githubUrl: "https://github.com/sayan",
          isPublished: true,
        },
        adminUser.id
      );

      expect(updated.developerName).toBe("Sayan");
      expect(updated.professionalTitle).toBe("Lead Full-Stack & Antigravity Systems Engineer");
      expect(updated.portfolioUrl).toBe("https://example.com/sayan");
      expect(updated.isPublished).toBe(true);
    });

    it("should serve public profile via GET /api/developer when published", async () => {
      // Ensure published
      await updateDeveloperProfile({ isPublished: true });

      const res = await getPublicDeveloper();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.isPublished).toBe(true);
      expect(data.profile).toBeDefined();
      expect(data.profile.developerName).toBe("Sayan");
      expect(data.profile.creditsStatement).toContain("Bishnu Studio");
    });

    it("should return isPublished: false and null profile when unpublished", async () => {
      await updateDeveloperProfile({ isPublished: false });

      const res = await getPublicDeveloper();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.isPublished).toBe(false);
      expect(data.profile).toBeNull();

      // Restore to published
      await updateDeveloperProfile({ isPublished: true });
    });

    it("should enforce admin auth and validate URLs on admin developer profile API", async () => {
      // 1. Customer forbidden
      vi.spyOn(authModule, "getAuthSession").mockResolvedValueOnce({
        user: { id: customerUser.id, email: customerUser.email, role: "customer", fullName: "Customer" },
        session: { id: "sess_1" } as any,
      });

      const forbiddenReq = new NextRequest("http://localhost:3000/api/admin/developer", {
        method: "PUT",
        body: JSON.stringify({ developerName: "Test" }),
      });
      const forbiddenRes = await putAdminDeveloper(forbiddenReq);
      expect(forbiddenRes.status).toBe(403);

      // 2. Admin with invalid URL
      vi.spyOn(authModule, "getAuthSession").mockResolvedValueOnce({
        user: { id: adminUser.id, email: adminUser.email, role: "admin", fullName: "Admin" },
        session: { id: "sess_1" } as any,
      });

      const invalidReq = new NextRequest("http://localhost:3000/api/admin/developer", {
        method: "PUT",
        body: JSON.stringify({
          developerName: "Sayan",
          professionalTitle: "Engineer",
          biography: "This is a valid test bio with more than 10 characters.",
          creditsStatement: "Website developed by Sayan for Bishnu Studio.",
          portfolioUrl: "not-a-valid-url",
        }),
      });
      const invalidRes = await putAdminDeveloper(invalidReq);
      expect(invalidRes.status).toBe(400);
      const errData = await invalidRes.json();
      expect(errData.error).toContain("Must be a valid URL");
    });
  });

  // =========================================================================
  // PART 5: Codebase Architecture & UI Tokens Verification
  // =========================================================================
  describe("PART 5: Codebase Architecture & UI Tokens", () => {
    it("should have public developer page at src/app/developer/page.tsx", () => {
      const pagePath = path.join(process.cwd(), "src/app/developer/page.tsx");
      expect(fs.existsSync(pagePath)).toBe(true);
      const content = fs.readFileSync(pagePath, "utf8");
      expect(content).toContain("DeveloperCreditsPage");
      expect(content).toContain("creditsStatement");
      expect(content).toContain("Verified Engineering Profile");
    });

    it("should have admin reconciliation page at src/app/admin/payments/reconciliation/page.tsx", () => {
      const pagePath = path.join(process.cwd(), "src/app/admin/payments/reconciliation/page.tsx");
      expect(fs.existsSync(pagePath)).toBe(true);
      const content = fs.readFileSync(pagePath, "utf8");
      expect(content).toContain("PaymentReconciliationPage");
      expect(content).toContain("Switch Active Receiving UPI Account");
      expect(content).toContain("Confirmed Received Money");
      expect(content).toContain("Export Reconciliation CSV");
    });

    it("should have admin developer editor at src/app/admin/settings/developer/page.tsx", () => {
      const pagePath = path.join(process.cwd(), "src/app/admin/settings/developer/page.tsx");
      expect(fs.existsSync(pagePath)).toBe(true);
      const content = fs.readFileSync(pagePath, "utf8");
      expect(content).toContain("AdminDeveloperSettingsPage");
      expect(content).toContain("Developer Profile &amp; Authorship Credits");
      expect(content).toContain("creditsStatement");
    });

    it("should include website credits link in Footer.tsx", () => {
      const footerPath = path.join(process.cwd(), "src/components/Footer.tsx");
      expect(fs.existsSync(footerPath)).toBe(true);
      const content = fs.readFileSync(footerPath, "utf8");
      expect(content).toContain('href="/developer"');
      expect(content).toContain("Website Credits");
    });
  });
});
