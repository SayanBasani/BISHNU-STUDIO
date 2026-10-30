import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unblockCustomer } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    await unblockCustomer({
      userId: id,
      adminId: auth.user.id,
    });

    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    await logAuditEvent({
      userId: auth.user.id,
      action: "unblock_customer",
      entityType: "user",
      entityId: id,
      ipAddress: ip,
    });

    // Customer Notification
    try {
      const { createNotification } = await import("@/lib/notifications");
      await createNotification({
        recipientType: "customer",
        recipientId: id,
        category: "account",
        eventType: "account_unblocked",
        title: "Account Restored",
        message: "Your Bishnu Studio account has been reviewed and restored to active status. You can now access all services.",
        entityType: "user",
        entityId: id,
        priority: "high",
      });
    } catch (notifErr) {
      console.error("Failed to dispatch unblock notification:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: "Customer account restored to active status successfully.",
    });
  } catch (error: any) {
    console.error("Unblock customer error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to unblock customer." },
      { status: 500 }
    );
  }
}
