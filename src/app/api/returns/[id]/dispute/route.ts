import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { orderReturns, orders } from "@/db/schema";
import { recordOrderEvent } from "@/lib/order-timeline";
import { logAuditEvent } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const disputeSchema = z.object({
  disputeReason: z
    .string()
    .min(10, "Please provide a detailed explanation of the dispute (minimum 10 characters)."),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json(
        { error: "Authentication required to raise a dispute." },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const validation = disputeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const returnRows = await db
      .select()
      .from(orderReturns)
      .where(eq(orderReturns.id, id))
      .limit(1);

    if (returnRows.length === 0) {
      return NextResponse.json({ error: "Return record not found" }, { status: 404 });
    }

    const ret = returnRows[0];
    const isAdmin = auth.user.role === "admin" || auth.user.role === "staff";

    if (!isAdmin && ret.customerId !== auth.user.id) {
      return NextResponse.json(
        { error: "Forbidden. You can only dispute your own return requests." },
        { status: 403 }
      );
    }

    const now = Date.now();
    const disputeReason = validation.data.disputeReason.trim();

    await db
      .update(orderReturns)
      .set({
        refundStatus: "disputed",
        refundDisputeReason: disputeReason,
        refundDisputedAt: now,
        updatedAt: now,
      })
      .where(eq(orderReturns.id, id));

    await recordOrderEvent({
      orderId: ret.orderId,
      previousStatus: "completed",
      newStatus: "completed",
      previousPaymentStatus: "refunded",
      newPaymentStatus: "refunded",
      changedByUserId: auth.user.id,
      actorRole: isAdmin ? "admin" : "customer",
      customerMessage: `Dispute opened for Return #${ret.returnReference} refund. Our finance team is reviewing your report.`,
      internalNote: `Customer disputed refund for Return #${ret.returnReference}. Reason: "${disputeReason}".`,
    });

    await logAuditEvent({
      userId: auth.user.id,
      action: "refund_disputed",
      entityType: "order",
      entityId: ret.orderId,
      details: {
        returnId: id,
        returnReference: ret.returnReference,
        disputeReason,
      },
    });

    // Notify Admin of Urgent Dispute
    try {
      const { createNotification } = await import("@/lib/notifications");
      await createNotification({
        recipientType: "admin",
        category: "return",
        eventType: "refund_disputed",
        title: `URGENT: Refund Disputed (${ret.returnReference})`,
        message: `Customer reported an issue with refund payout for Return #${ret.returnReference}: "${disputeReason}"`,
        entityType: "return",
        entityId: id,
        linkUrl: `/admin/returns/${id}`,
        priority: "urgent",
        deduplicationKey: `notif_dispute_${id}_${now}`,
      });
    } catch (notifErr) {
      console.error("Failed to notify admin of dispute:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: "Refund dispute submitted successfully. Our team will review and resolve this with priority.",
    });
  } catch (error: any) {
    console.error("Refund dispute error:", error);
    return NextResponse.json(
      { error: "Failed to submit dispute" },
      { status: 500 }
    );
  }
}
