import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import * as React from "react";
import { db } from "@/db";
import { users, sessions, verificationTokens, accountAppeals } from "@/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";

export const SESSION_COOKIE_NAME = "bishnu_session";
const SESSION_MAX_AGE_DAYS = parseInt(
  process.env.SESSION_MAX_AGE_DAYS || "14",
  10
);

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateOtp(length: number = 6): string {
  // Cryptographically secure numeric OTP
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return crypto.randomInt(min, max + 1).toString();
}

export function getAdminCredentialFingerprint(): string {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const secret = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD_HASH || "";
  const salt = process.env.SESSION_SECRET || "bishnu-studio-default-salt";
  return crypto.createHmac("sha256", salt).update(`${email}:${secret}`).digest("hex");
}

export async function createSession(
  userId: string,
  metadata?: { userAgent?: string; ipAddress?: string }
) {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Check if user is admin to stamp credential version fingerprint
  const userRows = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const isAdmin = userRows.length > 0 && userRows[0].role === "admin";
  const credentialVersion = isAdmin ? getAdminCredentialFingerprint() : null;

  await db.insert(sessions).values({
    id: `sess_${crypto.randomUUID()}`,
    userId,
    sessionToken,
    expiresAt,
    credentialVersion,
    userAgent: metadata?.userAgent ? metadata.userAgent.slice(0, 500) : null,
    ipAddress: metadata?.ipAddress ? metadata.ipAddress.slice(0, 100) : null,
    lastActiveAt: now,
    createdAt: now,
  });

  return { sessionToken, expiresAt };
}

export async function invalidateSession(sessionToken: string) {
  await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
}

export async function invalidateAllUserSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function getUserSessions(userId: string) {
  const now = Date.now();
  const sessionList = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      lastActiveAt: sessions.lastActiveAt,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.lastActiveAt));

  return sessionList;
}

export async function revokeSessionById(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
  return { success: true };
}

export async function forceLogoutCustomer(userId: string, adminId: string) {
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (userRows.length === 0) {
    throw new Error("Customer not found");
  }
  const user = userRows[0];
  if (user.role === "admin") {
    throw new Error("Cannot force logout an administrator account through customer session management");
  }

  // Delete all sessions for this customer across all devices
  await db.delete(sessions).where(eq(sessions.userId, userId));

  // Note: Customer status is NOT set to blocked; they can log in again.
  // Dispatch persistent security notification to the customer
  try {
    const { createNotification } = await import("@/lib/notifications");
    await createNotification({
      recipientType: "customer",
      recipientId: userId,
      category: "account",
      eventType: "force_logout",
      title: "Session Terminated",
      message: "An administrator has terminated your active sessions. You can log in again at any time.",
      priority: "high",
    });
  } catch (err) {
    console.error("Failed to dispatch force logout notification:", err);
  }

  return { success: true, userId };
}

export async function blockCustomer({
  userId,
  adminId,
  reason,
  category,
}: {
  userId: string;
  adminId: string;
  reason: string;
  category: "spam" | "abusive" | "fraud" | "misuse" | "other" | string;
}) {
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (userRows.length === 0) {
    throw new Error("Customer not found");
  }
  const user = userRows[0];
  if (user.role === "admin") {
    throw new Error("Admin accounts cannot be blocked");
  }

  const now = Date.now();
  await db
    .update(users)
    .set({
      status: "blocked",
      blockedAt: now,
      blockedReason: reason.trim(),
      blockedCategory: category,
      blockedByAdminId: adminId,
    })
    .where(eq(users.id, userId));

  // Invalidate all sessions immediately across all devices
  await db.delete(sessions).where(eq(sessions.userId, userId));

  return { success: true, userId, blockedAt: now };
}

export async function unblockCustomer({
  userId,
  adminId,
}: {
  userId: string;
  adminId?: string;
}) {
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (userRows.length === 0) {
    throw new Error("Customer not found");
  }

  await db
    .update(users)
    .set({
      status: "active",
      blockedAt: null,
      blockedReason: null,
      blockedCategory: null,
      blockedByAdminId: null,
    })
    .where(eq(users.id, userId));

  // Update any open appeals to approved
  const now = Date.now();
  await db
    .update(accountAppeals)
    .set({
      status: "approved",
      adminDecision: "Customer unblocked by administrator",
      reviewedByAdminId: adminId || null,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(and(eq(accountAppeals.userId, userId), eq(accountAppeals.status, "submitted")));

  return { success: true, userId };
}

export async function validateSession(sessionToken: string) {
  const now = Date.now();
  const sessionRows = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.sessionToken, sessionToken),
        gt(sessions.expiresAt, now)
      )
    )
    .limit(1);

  if (sessionRows.length === 0) {
    return null;
  }

  const { session, user } = sessionRows[0];

  if (user.status === "blocked") {
    // Immediately invalidate all active sessions for blocked user
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    return null;
  }

  // Admin credential invalidation check:
  // If the user is an admin, ensure the session was created with the CURRENT admin credentials fingerprint.
  if (user.role === "admin") {
    const currentFingerprint = getAdminCredentialFingerprint();
    if (!session.credentialVersion || session.credentialVersion !== currentFingerprint) {
      // Credentials rotated or session issued under outdated credentials!
      // Invalidate this session immediately across all devices
      await db.delete(sessions).where(eq(sessions.id, session.id));
      return null;
    }
  }

  // Throttled update of lastActiveAt (only update if > 5 minutes since last recorded activity)
  const lastActive = session.lastActiveAt ? Number(session.lastActiveAt) : 0;
  if (!lastActive || now - lastActive > 5 * 60 * 1000) {
    try {
      await db
        .update(sessions)
        .set({ lastActiveAt: now })
        .where(eq(sessions.id, session.id));
    } catch {
      // Non-blocking update failure
    }
  }

  const { passwordHash: _, ...safeUser } = user;

  return { session, user: safeUser };
}

const memoizeRequest =
  typeof (React as any).cache === "function"
    ? (React as any).cache
    : <T extends Function>(fn: T): T => fn;

export const getAuthSession = memoizeRequest(async () => {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }
    return await validateSession(token);
  } catch {
    return null;
  }
});

export function setSessionCookie(token: string, expiresAt: number) {
  const cookieStore = cookies();
  const isProduction = process.env.NODE_ENV === "production";
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

// Rate-limiting & Token generation for OTP / Password Reset
export async function createVerificationToken(
  identifier: string,
  type: "email_verify" | "phone_otp" | "password_reset",
  ttlMinutes: number = 10
) {
  // Check cooldown: do not allow resending if an active token was generated in last 60 seconds
  const oneMinuteAgo = Date.now() - 60 * 1000;
  const recentTokens = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.type, type),
        gt(verificationTokens.createdAt, oneMinuteAgo)
      )
    );

  if (recentTokens.length > 0) {
    throw new Error("Please wait at least 60 seconds before requesting another code.");
  }

  // Delete expired or previous tokens of this type for this identifier
  await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.type, type)
      )
    );

  const rawCode = generateOtp(6);
  const tokenHash = hashToken(rawCode);
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;

  await db.insert(verificationTokens).values({
    id: `tok_${crypto.randomUUID()}`,
    identifier,
    tokenHash,
    type,
    expiresAt,
    attempts: 0,
  });

  return { code: rawCode, expiresAt };
}

export async function verifyOtp(
  identifier: string,
  type: "email_verify" | "phone_otp" | "password_reset",
  code: string
): Promise<{ success: boolean; error?: string }> {
  const now = Date.now();
  const tokens = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.type, type),
        gt(verificationTokens.expiresAt, now)
      )
    )
    .limit(1);

  if (tokens.length === 0) {
    return {
      success: false,
      error: "Verification code has expired or does not exist. Please request a new one.",
    };
  }

  const record = tokens[0];

  if (record.attempts >= 5) {
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.id, record.id));
    return {
      success: false,
      error: "Maximum verification attempts exceeded. Please request a new code.",
    };
  }

  const inputHash = hashToken(code.trim());
  if (record.tokenHash !== inputHash) {
    // Increment attempts
    await db
      .update(verificationTokens)
      .set({ attempts: record.attempts + 1 })
      .where(eq(verificationTokens.id, record.id));

    return {
      success: false,
      error: `Invalid verification code. ${4 - record.attempts} attempt(s) remaining.`,
    };
  }

  // Successfully verified! Consume token immediately to prevent replay
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.id, record.id));

  return { success: true };
}

export async function validateAdminCredentials(
  email: string,
  password: string
): Promise<{ valid: boolean; error?: string; user?: any }> {
  const configuredEmail = process.env.ADMIN_EMAIL;
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const configuredHash = process.env.ADMIN_PASSWORD_HASH;

  if (!configuredEmail || (!configuredPassword && !configuredHash)) {
    console.error(
      "ADMIN_EMAIL or ADMIN_PASSWORD/ADMIN_PASSWORD_HASH is not set in environment variables."
    );
    return {
      valid: false,
      error:
        "Admin authentication is temporarily unavailable. Server environment configuration missing.",
    };
  }

  // 1. Verify Email (case-insensitive, trimmed)
  const cleanInputEmail = email.trim().toLowerCase();
  const cleanConfigEmail = configuredEmail.trim().toLowerCase();
  if (cleanInputEmail !== cleanConfigEmail) {
    return { valid: false, error: "Invalid administrator credentials." };
  }

  // 2. Authoritative Environment Password Check
  // Environment variables are the primary authority for administrator credentials.
  let isPasswordValid = false;
  if (configuredHash) {
    isPasswordValid = await bcrypt.compare(password, configuredHash);
  } else if (configuredPassword) {
    if (
      configuredPassword.startsWith("$2a$") ||
      configuredPassword.startsWith("$2b$") ||
      configuredPassword.startsWith("$2y$")
    ) {
      isPasswordValid = await bcrypt.compare(password, configuredPassword);
    } else {
      const inputBuf = Buffer.from(password);
      const configBuf = Buffer.from(configuredPassword);
      if (inputBuf.length === configBuf.length) {
        isPasswordValid = crypto.timingSafeEqual(inputBuf, configBuf);
      }
    }
  }

  // 3. Keep DB user in sync with authoritative environment credentials
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, cleanConfigEmail))
    .limit(1);

  // If environment check didn't match, check database password hash (supports dashboard UI updates)
  if (!isPasswordValid && existingUsers.length > 0 && existingUsers[0].passwordHash) {
    isPasswordValid = await bcrypt.compare(password, existingUsers[0].passwordHash);
  }

  if (!isPasswordValid) {
    return { valid: false, error: "Invalid administrator credentials." };
  }

  const passHash = await hashPassword(password);
  const now = Date.now();
  let adminUser: any;

  if (existingUsers.length > 0) {
    adminUser = existingUsers[0];
    await db
      .update(users)
      .set({
        role: "admin",
        status: "active",
        passwordHash: passHash,
        passwordUpdatedAt: now,
      })
      .where(eq(users.id, adminUser.id));

    adminUser.role = "admin";
    adminUser.status = "active";
    adminUser.passwordUpdatedAt = now;
  } else {
    // Create admin user record on initial bootstrap
    const adminId = `usr_admin_${crypto.randomUUID().slice(0, 8)}`;
    let adminPhone = process.env.ADMIN_PHONE || "9876543210";
    const existingPhone = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, adminPhone))
      .limit(1);
    if (existingPhone.length > 0) {
      adminPhone = `98${Date.now().toString().slice(-8)}`;
    }

    await db.insert(users).values({
      id: adminId,
      fullName: process.env.ADMIN_NAME || "Bishnu Studio Admin",
      email: cleanConfigEmail,
      phone: adminPhone,
      passwordHash: passHash,
      role: "admin",
      status: "active",
      isEmailVerified: true,
      isPhoneVerified: true,
      passwordUpdatedAt: now,
    });
    adminUser = {
      id: adminId,
      fullName: process.env.ADMIN_NAME || "Bishnu Studio Admin",
      email: cleanConfigEmail,
      phone: adminPhone,
      role: "admin",
      status: "active",
      isEmailVerified: true,
      isPhoneVerified: true,
      passwordUpdatedAt: now,
    };
  }

  const { passwordHash: _, ...safeUser } = adminUser;
  return { valid: true, user: safeUser };
}

export async function requireAdminSession() {
  const auth = await getAuthSession();
  if (!auth?.user || auth.user.role !== "admin") {
    return null;
  }
  return auth;
}
