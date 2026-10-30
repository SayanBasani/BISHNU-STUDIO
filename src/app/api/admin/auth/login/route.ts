import { NextRequest, NextResponse } from "next/server";
import { validateAdminCredentials, createSession, setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAuditEvent, logAuthEvent } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const adminLoginSchema = z.object({
  email: z.string().email("Please provide a valid administrator email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    // Rate-limiting: max 5 attempts per 15 minutes per IP
    const rateCheck = checkRateLimit(ip, "admin_login", {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateCheck.allowed) {
      const retryMinutes = rateCheck.retryAfterSec
        ? Math.ceil(rateCheck.retryAfterSec / 60)
        : 15;
      return NextResponse.json(
        {
          error: `Too many failed administrator login attempts. Locked out for security. Try again in ${retryMinutes} minute(s).`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = adminLoginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;
    const authResult = await validateAdminCredentials(email, password);

    if (!authResult.valid || !authResult.user) {
      await logAuthEvent({
        email: email.trim().toLowerCase(),
        eventType: "admin_login_failure",
        ipAddress: ip,
        userAgent,
        status: "failure",
        failureReason: authResult.error || "Invalid credentials",
      });

      return NextResponse.json(
        { error: authResult.error || "Invalid administrator credentials." },
        { status: 401 }
      );
    }

    const adminUser = authResult.user;

    // Create session and set HTTP-only cookie
    const { sessionToken, expiresAt } = await createSession(adminUser.id, {
      ipAddress: ip,
      userAgent,
    });
    setSessionCookie(sessionToken, expiresAt);

    await logAuditEvent({
      userId: adminUser.id,
      action: "admin_portal_login",
      entityType: "auth",
      entityId: adminUser.id,
      ipAddress: ip,
      details: { email: adminUser.email },
    });

    await logAuthEvent({
      userId: adminUser.id,
      email: adminUser.email,
      eventType: "admin_login_success",
      ipAddress: ip,
      userAgent,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      message: "Admin authentication successful",
      user: adminUser,
    });
  } catch (error: any) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { error: "Authentication system error. Please try again." },
      { status: 500 }
    );
  }
}
