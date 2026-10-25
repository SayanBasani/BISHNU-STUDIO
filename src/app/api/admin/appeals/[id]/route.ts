import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unblockCustomer } from "@/lib/auth";
import { db } from "@/db";
import { accountAppeals } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { z } from "zod";

const decisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  notes: z.string().optional().default(""),
});

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
    const body = await req.json().catch(() => ({}));
    const validation = decisionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { action, notes } = validation.data;

    const appealRows = await db
      .select()
      .from(accountAppeals)
      .where(eq(accountAppeals.id, id))
      .limit(1);

    if (appealRows.length === 0) {
      return NextResponse.json({ error: "Appeal record not found." }, { status: 404 });
    }

    const appeal = appealRows[0];
    const now = Date.now();

    if (action === "approve") {
      // Unblock the customer
      await unblockCustomer({
        userId: appeal.userId,
        adminId: auth.user.id,
      });

      // Update appeal record
      await db
        .update(accountAppeals)
        .set({
          status: "approved",
          adminDecision: "Appeal approved and restriction lifted",
          adminResponseNote: notes.trim() || "Account reactivated after review.",
          reviewedByAdminId: auth.user.id,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(accountAppeals.id, id));

      await logAuditEvent({
        userId: auth.user.id,
        action: "appeal_approved",
        entityType: "account_appeal",
        entityId: id,
        details: { customerId: appeal.userId, notes },
      });

      return NextResponse.json({
        success: true,
        message: "Appeal approved successfully. The customer account has been restored to active status.",
      });
    } else {
      // Reject appeal
      await db
        .update(accountAppeals)
        .set({
          status: "rejected",
          adminDecision: "Appeal rejected",
          adminResponseNote: notes.trim() || "The restriction on this account remains in place.",
          reviewedByAdminId: auth.user.id,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(accountAppeals.id, id));

      await logAuditEvent({
        userId: auth.user.id,
        action: "appeal_rejected",
        entityType: "account_appeal",
        entityId: id,
        details: { customerId: appeal.userId, notes },
      });

      return NextResponse.json({
        success: true,
        message: "Appeal rejected. The customer account remains restricted.",
      });
    }
  } catch (error: any) {
    console.error("Appeal review error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process appeal decision." },
      { status: 500 }
    );
  }
}
