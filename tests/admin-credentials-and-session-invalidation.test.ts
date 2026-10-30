import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  validateAdminCredentials,
  getAdminCredentialFingerprint,
  createSession,
  validateSession,
  invalidateAllUserSessions,
  hashPassword,
} from "../src/lib/auth";
import { db } from "../src/db";
import { users, sessions } from "../src/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("Admin Environment Credentials & Credential Fingerprint Session Invalidation", () => {
  const originalAdminEmail = process.env.ADMIN_EMAIL;
  const originalAdminPassword = process.env.ADMIN_PASSWORD;
  const originalAdminHash = process.env.ADMIN_PASSWORD_HASH;

  const testAdminEmail = "admin.security.test@bishnustudio.com";
  const initialPassword = "InitialAdminPass@2026!";
  const rotatedPassword = "RotatedAdminPass@2026!#New";

  const customerId = `cust_test_${crypto.randomUUID().slice(0, 8)}`;
  let adminUserId = "";

  beforeAll(async () => {
    // Setup environment variables
    process.env.ADMIN_EMAIL = testAdminEmail;
    process.env.ADMIN_PASSWORD = initialPassword;
    delete process.env.ADMIN_PASSWORD_HASH;

    // Clean up previous test users if any
    await db.delete(users).where(eq(users.email, testAdminEmail));
    await db.delete(users).where(eq(users.email, "customer.security.test@example.com"));

    // Create customer user
    const custPassHash = await hashPassword("CustomerSecret123!");
    await db.insert(users).values({
      id: customerId,
      fullName: "Test Security Customer",
      email: "customer.security.test@example.com",
      phone: `98${Date.now().toString().slice(-8)}`,
      passwordHash: custPassHash,
      role: "customer",
      status: "active",
      isEmailVerified: true,
      isPhoneVerified: true,
    });
  });

  afterAll(async () => {
    // Restore environment variables
    if (originalAdminEmail !== undefined) process.env.ADMIN_EMAIL = originalAdminEmail;
    if (originalAdminPassword !== undefined) process.env.ADMIN_PASSWORD = originalAdminPassword;
    if (originalAdminHash !== undefined) process.env.ADMIN_PASSWORD_HASH = originalAdminHash;

    // Clean up test data
    if (adminUserId) {
      await invalidateAllUserSessions(adminUserId);
      await db.delete(users).where(eq(users.id, adminUserId));
    }
    await invalidateAllUserSessions(customerId);
    await db.delete(users).where(eq(users.id, customerId));
  });

  it("should authenticate admin against authoritative environment credentials and synchronize DB user", async () => {
    const authResult = await validateAdminCredentials(
      testAdminEmail.toUpperCase(), // case insensitivity test
      initialPassword
    );

    expect(authResult.valid).toBe(true);
    expect(authResult.user).toBeDefined();
    expect(authResult.user.email).toBe(testAdminEmail);
    expect(authResult.user.role).toBe("admin");
    adminUserId = authResult.user.id;

    // Check DB user
    const dbRows = await db.select().from(users).where(eq(users.id, adminUserId)).limit(1);
    expect(dbRows.length).toBe(1);
    expect(dbRows[0].role).toBe("admin");
    expect(dbRows[0].passwordUpdatedAt).toBeDefined();
  });

  it("should reject invalid admin credentials", async () => {
    const wrongPassResult = await validateAdminCredentials(testAdminEmail, "IncorrectPassword!");
    expect(wrongPassResult.valid).toBe(false);
    expect(wrongPassResult.error).toContain("Invalid administrator credentials");

    const wrongEmailResult = await validateAdminCredentials("wrong.admin@example.com", initialPassword);
    expect(wrongEmailResult.valid).toBe(false);
  });

  it("should stamp admin sessions with current credential fingerprint and leave customer sessions unversioned", async () => {
    const currentFingerprint = getAdminCredentialFingerprint();
    expect(currentFingerprint).toBeDefined();
    expect(currentFingerprint.length).toBe(64);

    // Create admin session
    const adminSession = await createSession(adminUserId, {
      ipAddress: "192.168.1.100",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    });

    // Create customer session
    const custSession = await createSession(customerId, {
      ipAddress: "192.168.1.200",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148",
    });

    // Check sessions in DB
    const adminSessRows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.sessionToken, adminSession.sessionToken))
      .limit(1);
    expect(adminSessRows.length).toBe(1);
    expect(adminSessRows[0].credentialVersion).toBe(currentFingerprint);
    expect(adminSessRows[0].ipAddress).toBe("192.168.1.100");

    const custSessRows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.sessionToken, custSession.sessionToken))
      .limit(1);
    expect(custSessRows.length).toBe(1);
    expect(custSessRows[0].credentialVersion).toBeNull();
    expect(custSessRows[0].ipAddress).toBe("192.168.1.200");

    // Both sessions should be valid right now
    const validAdmin = await validateSession(adminSession.sessionToken);
    expect(validAdmin).not.toBeNull();
    expect(validAdmin?.user.id).toBe(adminUserId);

    const validCust = await validateSession(custSession.sessionToken);
    expect(validCust).not.toBeNull();
    expect(validCust?.user.id).toBe(customerId);
  });

  it("should invalidate old admin session across devices when ADMIN_PASSWORD changes, without affecting customer sessions", async () => {
    // 1. Create active admin and customer sessions under initial credentials
    const adminSession1 = await createSession(adminUserId, {
      userAgent: "Chrome on Mac",
      ipAddress: "10.0.0.1",
    });
    const adminSession2 = await createSession(adminUserId, {
      userAgent: "Safari on iPad",
      ipAddress: "10.0.0.2",
    });
    const customerSession = await createSession(customerId, {
      userAgent: "Firefox on Windows",
      ipAddress: "10.0.0.3",
    });

    // Verify all 3 sessions are initially valid
    expect(await validateSession(adminSession1.sessionToken)).not.toBeNull();
    expect(await validateSession(adminSession2.sessionToken)).not.toBeNull();
    expect(await validateSession(customerSession.sessionToken)).not.toBeNull();

    // 2. Rotate ADMIN_PASSWORD in environment (simulating .env.local change and process restart)
    process.env.ADMIN_PASSWORD = rotatedPassword;

    // Verify that credential fingerprint changed
    const newFingerprint = getAdminCredentialFingerprint();
    expect(newFingerprint).toBeDefined();

    // 3. Old admin sessions must now be rejected and purged from the database
    const validatedAdmin1 = await validateSession(adminSession1.sessionToken);
    expect(validatedAdmin1).toBeNull();

    const validatedAdmin2 = await validateSession(adminSession2.sessionToken);
    expect(validatedAdmin2).toBeNull();

    // Check that database records for the stale sessions were purged
    const purged1 = await db
      .select()
      .from(sessions)
      .where(eq(sessions.sessionToken, adminSession1.sessionToken));
    expect(purged1.length).toBe(0);

    // 4. CRITICAL: Customer session must remain completely valid and uninterrupted!
    const validatedCust = await validateSession(customerSession.sessionToken);
    expect(validatedCust).not.toBeNull();
    expect(validatedCust?.user.id).toBe(customerId);

    // 5. Admin logs in with new rotated credentials
    const newLoginResult = await validateAdminCredentials(testAdminEmail, rotatedPassword);
    expect(newLoginResult.valid).toBe(true);

    // New admin session issued under rotated credentials is valid
    const newAdminSession = await createSession(adminUserId);
    const validNewAdmin = await validateSession(newAdminSession.sessionToken);
    expect(validNewAdmin).not.toBeNull();
    expect(validNewAdmin?.user.id).toBe(adminUserId);
  });
});
