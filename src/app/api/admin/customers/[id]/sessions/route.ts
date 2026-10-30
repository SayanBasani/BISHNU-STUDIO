import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, getUserSessions, revokeSessionById, forceLogoutCustomer } from "@/lib/auth";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminSession();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customerId = params.id;
    const userRows = await db
      .select({ id: users.id, role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, customerId))
      .limit(1);

    if (userRows.length === 0) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const activeSessions = await getUserSessions(customerId);

    return NextResponse.json({
      success: true,
      sessions: activeSessions,
    });
  } catch (error: any) {
    console.error("GET /api/admin/customers/[id]/sessions error:", error);
    return NextResponse.json(
      { error: "Failed to load customer sessions" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminSession();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customerId = params.id;
    const body = await req.json().catch(() => ({}));
    const targetSessionId = body.sessionId;

    // Self-Protection check: Admin cannot force-logout their own account via customer management
    if (customerId === auth.user.id) {
      return NextResponse.json(
        { error: "Admin self-protection: You cannot force logout your own account through customer management." },
        { status: 400 }
      );
    }

    // Verify target customer exists and is not an admin
    const userRows = await db
      .select({ id: users.id, role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, customerId))
      .limit(1);

    if (userRows.length === 0) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    if (userRows[0].role === "admin") {
      return NextResponse.json(
        { error: "Admin self-protection: Administrator accounts cannot be manipulated via customer session management." },
        { status: 403 }
      );
    }

    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

    if (targetSessionId) {
      // Revoke single session
      const targetSession = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, targetSessionId))
        .limit(1);

      if (targetSession.length === 0 || targetSession[0].userId !== customerId) {
        return NextResponse.json(
          { error: "Session not found or does not belong to this customer" },
          { status: 404 }
        );
      }

      await revokeSessionById(targetSessionId);

      await logAuditEvent({
        userId: auth.user.id,
        action: "revoke_customer_session",
        entityType: "auth",
        entityId: targetSessionId,
        ipAddress: ip,
        details: { customerId, targetSessionId },
      });

      return NextResponse.json({
        success: true,
        message: "Customer session revoked successfully",
      });
    } else {
      // Force logout all sessions for this customer
      await forceLogoutCustomer(customerId, auth.user.id);

      await logAuditEvent({
        userId: auth.user.id,
        action: "force_logout_customer_all_sessions",
        entityType: "user",
        entityId: customerId,
        ipAddress: ip,
        details: { customerId },
      });

      return NextResponse.json({
        success: true,
        message: "All customer sessions terminated successfully. The customer will need to log in again.",
      });
    }
  } catch (error: any) {
    console.error("DELETE /api/admin/customers/[id]/sessions error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to terminate customer session(s)" },
      { status: 500 }
    );
  }
}
