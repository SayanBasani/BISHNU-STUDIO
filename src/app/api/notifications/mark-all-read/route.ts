import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { markAllNotificationsAsRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const category = body.category || undefined;
    const scopeParam = body.scope || undefined;

    let recipientType: "admin" | "customer" = "customer";
    if (auth.user.role === "admin") {
      recipientType = scopeParam === "customer" ? "customer" : "admin";
    } else {
      recipientType = "customer";
    }

    const result = await markAllNotificationsAsRead({
      recipientType,
      recipientId: auth.user.id,
      category,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("POST /api/notifications/mark-all-read error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
