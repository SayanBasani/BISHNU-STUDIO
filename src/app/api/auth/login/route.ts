import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword, validateAdminCredentials, createSession, setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAuditEvent, logAuthEvent } from "@/lib/audit";
import { eq, or } from "drizzle-orm";
import { z } from "zod";

const loginSchema = z.object({
  identifier: z.string().min(3, "Please enter your email or mobile number"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;
    const rateCheck = checkRateLimit(ip, "login", { limit: 10, windowMs: 60 * 1000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many login attempts. Please try again after ${rateCheck.retryAfterSec} seconds.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { identifier, password } = validation.data;
    const cleanIdentifier = identifier.trim().toLowerCase();

    const configAdminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const isAdminEmailLogin = Boolean(configAdminEmail && cleanIdentifier === configAdminEmail);

    // Query by email OR phone
    let userRows = await db
      .select()
      .from(users)
      .where(or(eq(users.email, cleanIdentifier), eq(users.phone, identifier.trim())))
      .limit(1);

    if (userRows.length === 0 && !isAdminEmailLogin) {
      await logAuthEvent({
        email: cleanIdentifier,
        eventType: "login_failure",
        ipAddress: ip,
        userAgent,
        status: "failure",
        failureReason: "User account not found",
      });
      return NextResponse.json(
        { error: "Invalid credentials. Please check your email/mobile and password." },
        { status: 401 }
      );
    }

    let user: any = userRows[0];

    // If user is admin or logging in with admin email, use authoritative admin validation
    if (isAdminEmailLogin || user?.role === "admin") {
      const authResult = await validateAdminCredentials(cleanIdentifier, password);
      if (!authResult.valid || !authResult.user) {
        await logAuthEvent({
          email: cleanIdentifier,
          eventType: "login_failure",
          ipAddress: ip,
          userAgent,
          status: "failure",
          failureReason: authResult.error || "Invalid administrator credentials",
        });
        return NextResponse.json(
          { error: authResult.error || "Invalid credentials. Please check your email/mobile and password." },
          { status: 401 }
        );
      }
      user = authResult.user;
    } else {
      const passwordValid = await verifyPassword(password, user.passwordHash);
      if (!passwordValid) {
        await logAuthEvent({
          userId: user.id,
          email: user.email,
          eventType: "login_failure",
          ipAddress: ip,
          userAgent,
          status: "failure",
          failureReason: "Incorrect password",
        });
        return NextResponse.json(
          { error: "Invalid credentials. Please check your email/mobile and password." },
          { status: 401 }
        );
      }
    }

    // Check if account is blocked
    if (user.status === "blocked") {
      await logAuthEvent({
        userId: user.id,
        email: user.email,
        eventType: "login_failure",
        ipAddress: ip,
        userAgent,
        status: "failure",
        failureReason: `Account blocked: ${user.blockedReason || "Policy violation"}`,
      });
      return NextResponse.json(
        {
          error: "Your account has been restricted by administration.",
          isBlocked: true,
          userId: user.id,
          blockedReason: user.blockedReason || "Violation of terms and service policies",
          blockedCategory: user.blockedCategory || "other",
          blockedAt: user.blockedAt,
          email: user.email,
          phone: user.phone,
        },
        { status: 403 }
      );
    }

    // Create session
    const { sessionToken, expiresAt } = await createSession(user.id, {
      ipAddress: ip,
      userAgent,
    });
    setSessionCookie(sessionToken, expiresAt);

    await logAuditEvent({
      userId: user.id,
      action: "user_login",
      entityType: "auth",
      entityId: user.id,
      ipAddress: ip,
    });

    await logAuthEvent({
      userId: user.id,
      email: user.email,
      eventType: "login_success",
      ipAddress: ip,
      userAgent,
      status: "success",
    });

    const { passwordHash: _, ...safeUser } = user;
    return NextResponse.json({
      success: true,
      user: safeUser,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Login failed. Please try again later." },
      { status: 500 }
    );
  }
}
