import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createSession,
  validateSession,
  getUserSessions,
  revokeSessionById,
  forceLogoutCustomer,
  blockCustomer,
  unblockCustomer,
  hashPassword,
} from "../src/lib/auth";
import { db } from "../src/db";
import { users, sessions, notifications } from "../src/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("Customer Session Management, Force Logout & Account Blocking", () => {
  const customerId = `usr_cust_${crypto.randomUUID().slice(0, 8)}`;
  const adminId = `usr_adm_${crypto.randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const passwordHash = await hashPassword("CustomerSecure123!");

    // Create test customer
    await db.insert(users).values({
      id: customerId,
      fullName: "Session Test Customer",
      email: "session.test.customer@example.com",
      phone: `91${Date.now().toString().slice(-8)}`,
      passwordHash,
      role: "customer",
      status: "active",
      isEmailVerified: true,
      isPhoneVerified: true,
    });

    // Create test admin
    await db.insert(users).values({
      id: adminId,
      fullName: "Session Test Admin",
      email: "session.test.admin@example.com",
      phone: `92${Date.now().toString().slice(-8)}`,
      passwordHash,
      role: "admin",
      status: "active",
      isEmailVerified: true,
      isPhoneVerified: true,
    });
  });

  afterAll(async () => {
    await db.delete(sessions).where(eq(sessions.userId, customerId));
    await db.delete(sessions).where(eq(sessions.userId, adminId));
    await db.delete(notifications).where(eq(notifications.recipientId, customerId));
    await db.delete(users).where(eq(users.id, customerId));
    await db.delete(users).where(eq(users.id, adminId));
  });

  beforeEach(async () => {
    await db.delete(sessions).where(eq(sessions.userId, customerId));
  });

  it("should record userAgent and ipAddress metadata on session creation", async () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BishnuTestBrowser/1.0";
    const ip = "203.0.113.42";

    const session = await createSession(customerId, {
      userAgent: ua,
      ipAddress: ip,
    });

    const activeSessions = await getUserSessions(customerId);
    expect(activeSessions.length).toBeGreaterThanOrEqual(1);

    const found = activeSessions.find((s) => s.id.startsWith("sess_"));
    expect(found).toBeDefined();
    expect(found?.userAgent).toBe(ua);
    expect(found?.ipAddress).toBe(ip);
    expect(found?.lastActiveAt).toBeDefined();
    // Verify sessionToken is NOT exposed in session metadata query
    expect((found as any).sessionToken).toBeUndefined();
  });

  it("should allow revoking an individual session without affecting others", async () => {
    const sess1 = await createSession(customerId, { userAgent: "Device 1", ipAddress: "10.0.0.1" });
    const sess2 = await createSession(customerId, { userAgent: "Device 2", ipAddress: "10.0.0.2" });

    // Verify both are valid
    expect(await validateSession(sess1.sessionToken)).not.toBeNull();
    expect(await validateSession(sess2.sessionToken)).not.toBeNull();

    // Revoke sess1
    const rows = await db.select().from(sessions).where(eq(sessions.sessionToken, sess1.sessionToken)).limit(1);
    const revokeResult = await revokeSessionById(rows[0].id);
    expect(revokeResult.success).toBe(true);

    // sess1 is now invalid, sess2 remains valid
    expect(await validateSession(sess1.sessionToken)).toBeNull();
    expect(await validateSession(sess2.sessionToken)).not.toBeNull();

    // Cleanup sess2
    await revokeSessionById((await db.select().from(sessions).where(eq(sessions.sessionToken, sess2.sessionToken)))[0].id);
  });

  it("should force logout all sessions for a customer while preserving Active account status", async () => {
    // Create multiple sessions
    const sessA = await createSession(customerId, { userAgent: "Desktop Chrome" });
    const sessB = await createSession(customerId, { userAgent: "Mobile Safari" });
    const sessC = await createSession(customerId, { userAgent: "Tablet App" });

    let active = await getUserSessions(customerId);
    expect(active.length).toBe(3);

    // Perform force logout
    const result = await forceLogoutCustomer(customerId, adminId);
    expect(result.success).toBe(true);

    // All sessions should be terminated
    active = await getUserSessions(customerId);
    expect(active.length).toBe(0);
    expect(await validateSession(sessA.sessionToken)).toBeNull();
    expect(await validateSession(sessB.sessionToken)).toBeNull();
    expect(await validateSession(sessC.sessionToken)).toBeNull();

    // Verify user account status remains ACTIVE (not blocked!)
    const userRows = await db.select().from(users).where(eq(users.id, customerId)).limit(1);
    expect(userRows[0].status).toBe("active");
    expect(userRows[0].blockedAt).toBeNull();

    // Verify security notification was created for customer
    const notifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, customerId));
    const forceLogoutNotif = notifs.find((n) => n.eventType === "force_logout");
    expect(forceLogoutNotif).toBeDefined();
    expect(forceLogoutNotif?.title).toBe("Session Terminated");
  });

  it("should block customer, revoke all sessions, and prevent subsequent session validation", async () => {
    const session = await createSession(customerId, { userAgent: "Active Customer Device" });
    expect(await validateSession(session.sessionToken)).not.toBeNull();

    // Block customer
    const blockRes = await blockCustomer({
      userId: customerId,
      adminId,
      reason: "Repeated fraudulent payment submissions",
      category: "fraud",
    });
    expect(blockRes.success).toBe(true);

    // User record updated
    const userRows = await db.select().from(users).where(eq(users.id, customerId)).limit(1);
    expect(userRows[0].status).toBe("blocked");
    expect(userRows[0].blockedReason).toBe("Repeated fraudulent payment submissions");
    expect(userRows[0].blockedCategory).toBe("fraud");

    // All active sessions must be terminated immediately
    expect(await validateSession(session.sessionToken)).toBeNull();
    const active = await getUserSessions(customerId);
    expect(active.length).toBe(0);

    // Unblock customer
    const unblockRes = await unblockCustomer({ userId: customerId, adminId });
    expect(unblockRes.success).toBe(true);

    const restoredUser = await db.select().from(users).where(eq(users.id, customerId)).limit(1);
    expect(restoredUser[0].status).toBe("active");
    expect(restoredUser[0].blockedAt).toBeNull();
  });

  it("should enforce admin self-protection against force logout or blocking", async () => {
    // Attempting to force logout an administrator must be rejected
    await expect(forceLogoutCustomer(adminId, adminId)).rejects.toThrow(
      "Cannot force logout an administrator account"
    );

    // Attempting to block an administrator must be rejected
    await expect(
      blockCustomer({
        userId: adminId,
        adminId,
        reason: "Test block",
        category: "other",
      })
    ).rejects.toThrow("Admin accounts cannot be blocked");
  });
});
