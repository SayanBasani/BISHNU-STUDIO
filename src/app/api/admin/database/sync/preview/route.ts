import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { runSynchronizationToPrimary } from "@/lib/db-sync";

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

    const summary = await runSynchronizationToPrimary({
      adminUserId: auth.user.id,
      dryRun: true,
    });

    return NextResponse.json({
      success: true,
      preview: summary.details.preview || [],
      totalPending: summary.totalEvents,
      fencingToken: summary.fencingToken,
    });
  } catch (error: any) {
    console.error("[Sync Preview API] Error generating preview:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate preview." },
      { status: 500 }
    );
  }
}
