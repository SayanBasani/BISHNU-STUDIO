import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, verifyPassword } from "@/lib/auth";
import { getDatabaseProviderManager, DatabaseOperatingMode } from "@/lib/db-provider";
import { logAuditEvent } from "@/lib/audit";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Super-Administrator privileges required to change database configuration." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { targetMode, reason, confirmation, adminPassword } = body;

    const validModes: DatabaseOperatingMode[] = [
      "neon_primary",
      "emergency_fallback",
      "local_development",
      "maintenance",
    ];

    if (!targetMode || !validModes.includes(targetMode)) {
      return NextResponse.json(
        { error: `Invalid target mode. Must be one of: ${validModes.join(", ")}` },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return NextResponse.json(
        { error: "A clear operational justification (at least 5 characters) is required for database mode switching." },
        { status: 400 }
      );
    }

    // Require explicit confirmation string
    if (confirmation !== "CONFIRM" && !adminPassword) {
      return NextResponse.json(
        { error: "Explicit confirmation required. Please confirm with 'CONFIRM' or enter your admin password." },
        { status: 400 }
      );
    }

    // If password provided, verify against database
    if (adminPassword) {
      const adminRows = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, auth.user.id))
        .limit(1);

      if (adminRows.length > 0) {
        const isValid = await verifyPassword(adminPassword, adminRows[0].passwordHash);
        if (!isValid) {
          return NextResponse.json(
            { error: "Invalid administrator password. Database switch denied." },
            { status: 401 }
          );
        }
      }
    }

    const manager = getDatabaseProviderManager();
    const result = await manager.switchOperatingMode({
      targetMode,
      adminUserId: auth.user.id,
      reason: reason.trim(),
    });

    // Record audit event
    await logAuditEvent({
      userId: auth.user.id,
      action: "database_mode_switch",
      entityType: "settings",
      entityId: "database_control_plane",
      details: {
        previousMode: result.state.mode,
        targetMode,
        activeProvider: result.state.activeProvider,
        fencingToken: result.state.fencingToken,
        reason: reason.trim(),
      },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      state: result.state,
    });
  } catch (error: any) {
    console.error("[Database Switch API] Switch failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to switch database operating mode." },
      { status: 400 }
    );
  }
}
