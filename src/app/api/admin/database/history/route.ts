import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { dbSyncHistory } from "@/db/schema";
import { desc } from "drizzle-orm";

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
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    const history = await db
      .select()
      .from(dbSyncHistory)
      .orderBy(desc(dbSyncHistory.startedAt))
      .limit(limit);

    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error: any) {
    console.error("[Database History API] Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch database synchronization history: " + error.message },
      { status: 500 }
    );
  }
}
