import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, invalidateSession, clearSessionCookie } from "@/lib/auth";
import { logAuthEvent } from "@/lib/audit";

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
      }
    }
    clearSessionCookie();
    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    clearSessionCookie();
    return NextResponse.json({ success: true });
  }
}
