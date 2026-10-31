import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { retryFailedOutboxEvents } from "@/lib/db-sync";
import { logAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized. Administrator access required." },
        { status: 403 }
      );
    }

    const { resetCount } = await retryFailedOutboxEvents();

    await logAuditEvent({
      userId: auth.user.id,
      action: "database_sync_retry_failed",
      entityType: "settings",
      entityId: "db_sync_outbox",
      details: { resetCount },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      resetCount,
      message: `Reset ${resetCount} failed synchronization event(s) for retry.`,
    });
  } catch (error: any) {
    console.error("[Sync Retry API] Error resetting failed events:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reset events." },
      { status: 500 }
    );
  }
}
