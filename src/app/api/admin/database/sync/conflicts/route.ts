import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { dbSyncOutbox } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

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
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    const conflicts = await db
      .select({
        id: dbSyncOutbox.id,
        entityType: dbSyncOutbox.entityType,
        entityId: dbSyncOutbox.entityId,
        operation: dbSyncOutbox.operation,
        conflictDetails: dbSyncOutbox.conflictDetails,
        payloadJson: dbSyncOutbox.payloadJson,
        createdAt: dbSyncOutbox.createdAt,
      })
      .from(dbSyncOutbox)
      .where(eq(dbSyncOutbox.status, "conflict"))
      .orderBy(desc(dbSyncOutbox.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      conflicts,
      count: conflicts.length,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("[Sync Conflicts API] Error fetching conflicts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load conflicts." },
      { status: 500 }
    );
  }
}

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
    const { eventId, resolution } = body;

    if (!eventId || !["discard", "retry"].includes(resolution)) {
      return NextResponse.json(
        { error: "Invalid parameters. eventId and resolution ('discard' | 'retry') are required." },
        { status: 400 }
      );
    }

    if (resolution === "discard") {
      await db
        .update(dbSyncOutbox)
        .set({
          status: "synced", // Mark as acknowledged/discarded so it is no longer pending/conflict
          conflictDetails: JSON.stringify({ resolvedBy: auth.user.id, action: "discarded", resolvedAt: Date.now() }),
        })
        .where(eq(dbSyncOutbox.id, eventId));
    } else if (resolution === "retry") {
      await db
        .update(dbSyncOutbox)
        .set({
          status: "pending",
          conflictDetails: null,
        })
        .where(eq(dbSyncOutbox.id, eventId));
    }

    await logAuditEvent({
      userId: auth.user.id,
      action: "database_conflict_resolved",
      entityType: "settings",
      entityId: eventId,
      details: { resolution },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      eventId,
      resolution,
    });
  } catch (error: any) {
    console.error("[Sync Conflicts API] Error resolving conflict:", error);
    return NextResponse.json(
      { error: error.message || "Failed to resolve conflict." },
      { status: 500 }
    );
  }
}
