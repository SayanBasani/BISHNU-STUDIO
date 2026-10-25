import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, invalidateSession, clearSessionCookie } from "@/lib/auth";
import { logAuthEvent, logAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    if (auth?.session) {
      await invalidateSession(auth.session.sessionToken);
      if (auth.user) {
        await logAuthEvent({
          userId: auth.user.id,
          email: auth.user.email,
          eventType: "logout",
          ipAddress: ip,
          userAgent,
          status: "success",
        });

        await logAuditEvent({
          userId: auth.user.id,
          action: "admin_portal_logout",
          entityType: "auth",
          entityId: auth.user.id,
          ipAddress: ip,
        });
      }
    }

    clearSessionCookie();
    return NextResponse.json({
      success: true,
      message: "Admin logged out successfully",
    });
  } catch (error) {
    clearSessionCookie();
    return NextResponse.json({ success: true });
  }
}
