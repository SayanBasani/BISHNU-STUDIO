import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { runSynchronizationToPrimary } from "@/lib/db-sync";
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

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body.dryRun);

    const summary = await runSynchronizationToPrimary({
      adminUserId: auth.user.id,
      dryRun,
    });

    await logAuditEvent({
      userId: auth.user.id,
      action: dryRun ? "database_sync_dry_run" : "database_sync_executed",
      entityType: "settings",
      entityId: summary.historyId,
      details: {
        totalEvents: summary.totalEvents,
        syncedCount: summary.syncedCount,
        conflictsCount: summary.conflictsCount,
        failuresCount: summary.failuresCount,
        status: summary.status,
      },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    console.error("[Database Sync API] Synchronization error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute database synchronization." },
      { status: 500 }
    );
  }
}
