import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getDatabaseProviderManager } from "@/lib/db-provider";
import { getSyncStatusSummary } from "@/lib/db-sync";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized. Administrator access required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    const manager = getDatabaseProviderManager();
    const controlPlane = manager.getControlPlaneState();
    const hostingSafety = manager.getHostingSafetyAssessment();

    // Check health of primary and fallback (with caching to keep requests fast)
    const [primaryHealth, fallbackHealth, syncSummary] = await Promise.all([
      manager.checkPrimaryHealth(forceRefresh),
      manager.checkFallbackHealth(forceRefresh),
      getSyncStatusSummary(),
    ]);

    return NextResponse.json({
      success: true,
      controlPlane: {
        mode: controlPlane.mode,
        activeProvider: controlPlane.activeProvider,
        authoritativeDatabase: controlPlane.authoritativeDatabase,
        writesEnabled: controlPlane.writesEnabled,
        fencingToken: controlPlane.fencingToken,
        lastSwitchedAt: controlPlane.lastSwitchedAt,
        lastSwitchedBy: controlPlane.lastSwitchedBy,
        switchReason: controlPlane.switchReason,
        lastSyncAt: controlPlane.lastSyncAt,
        lastSyncStatus: controlPlane.lastSyncStatus,
      },
      health: {
        primary: primaryHealth,
        fallback: fallbackHealth,
      },
      hostingSafety,
      syncSummary,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error("[Database Status API] Error retrieving database status:", error);
    return NextResponse.json(
      { error: "Failed to retrieve database status: " + error.message },
      { status: 500 }
    );
  }
}
