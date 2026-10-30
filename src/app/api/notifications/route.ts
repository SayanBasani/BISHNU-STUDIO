import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";
import { createRequestTimer } from "@/lib/perf";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const timer = createRequestTimer(req);
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return timer.finish(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const { searchParams } = new URL(req.url);
    const scopeParam = searchParams.get("scope");
    const category = searchParams.get("category") || undefined;
    const isReadParam = searchParams.get("isRead");
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);
    const offsetParam = parseInt(searchParams.get("offset") || "0", 10);

    const isRead =
      isReadParam === "true" ? true : isReadParam === "false" ? false : undefined;

    // Determine recipientType and recipientId
    let recipientType: "admin" | "customer" = "customer";
    let recipientId: string | null = auth.user.id;

    if (auth.user.role === "admin") {
      if (scopeParam === "admin" || !scopeParam) {
        recipientType = "admin";
        recipientId = auth.user.id;
      } else {
        recipientType = "customer";
        recipientId = auth.user.id;
      }
    } else {
      // Non-admins can NEVER view admin notifications
      recipientType = "customer";
      recipientId = auth.user.id;
    }

    const result = await timer.measure("database.notifications.fetch", () =>
      getNotifications({
        recipientType,
        recipientId,
        isRead,
        category,
        limit: Math.min(Math.max(limitParam, 1), 100),
        offset: Math.max(offsetParam, 0),
      })
    );

    return timer.finish(
      NextResponse.json({
        success: true,
        ...result,
      })
    );
  } catch (error: any) {
    console.error("GET /api/notifications error:", error);
    return timer.finish(
      NextResponse.json(
        { error: "Failed to load notifications" },
        { status: 500 }
      )
    );
  }
}
