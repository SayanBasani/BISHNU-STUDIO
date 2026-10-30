import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { paymentSubmissions, orders } from "@/db/schema";
import { recordOrderEvent } from "@/lib/order-timeline";
import { logAuditEvent } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const rejectSchema = z.object({
  rejectionReason: z.string().min(2, "Rejection reason is required"),
  rejectionNote: z.string().optional(),
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

    const subRows = await db
      .select()
      .from(paymentSubmissions)
      .where(eq(paymentSubmissions.id, id))
      .limit(1);

    if (subRows.length === 0) {
      return NextResponse.json(
        { error: "Payment submission not found." },
        { status: 404 }
      );
    }

    const submission = subRows[0];

    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, submission.orderId))
      .limit(1);

    if (orderRows.length === 0) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const order = orderRows[0];

    // Case O Concurrency Check:
    if (submission.status === "verified" || order.paymentStatus === "paid") {
      return NextResponse.json(
        { error: "Cannot reject a payment that has already been verified." },
        { status: 400 }
      );
    }

    if (submission.status === "rejected") {
      return NextResponse.json(
        { error: "This payment submission has already been rejected." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validation = rejectSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { rejectionReason, rejectionNote } = validation.data;
    const now = Date.now();

    // 1. Update payment submission to rejected
    await db
      .update(paymentSubmissions)
      .set({
        status: "rejected",
        rejectionReason: rejectionReason.trim(),
        rejectionNote: rejectionNote?.trim() || null,
        verifiedByAdminId: auth.user.id,
        verifiedAt: now,
        updatedAt: now,
      })
      .where(eq(paymentSubmissions.id, id));

    // 2. Ensure order remains UNPAID
    await db
      .update(orders)
      .set({
        paymentStatus: "unpaid",
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));

    // 3. Record timeline event
    await recordOrderEvent({
      orderId: order.id,
      previousStatus: order.orderStatus,
      newStatus: order.orderStatus,
      previousPaymentStatus: order.paymentStatus,
      newPaymentStatus: "unpaid",
      changedByUserId: auth.user.id,
      actorRole: "admin",
      customerMessage: `Payment proof was rejected: ${rejectionReason}. Please resubmit valid payment evidence.`,
      internalNote: `Payment rejected by ${auth.user.fullName}: ${rejectionReason}. ${
        rejectionNote || ""
      }`.trim(),
    });

    // 4. Audit Log
    await logAuditEvent({
      userId: auth.user.id,
      action: "reject_payment",
      entityType: "payment",
      entityId: id,
      details: {
        orderReference: order.orderReference,
        rejectionReason,
        rejectionNote,
        transactionId: submission.transactionId,
      },
    });

    // 5. Customer Notification
    try {
      const { createNotification } = await import("@/lib/notifications");
      await createNotification({
        recipientType: "customer",
        recipientId: order.customerId,
        category: "payment",
        eventType: "payment_rejected",
        title: `Payment Proof Rejected (${order.orderReference})`,
        message: `Your payment proof (UTR: ${submission.transactionId}) was rejected: ${rejectionReason}. Please resubmit valid payment evidence.`,
        entityType: "order",
        entityId: order.id,
        linkUrl: `/account/orders/${order.id}`,
        priority: "high",
        deduplicationKey: `notif_payment_rejected_${id}`,
      });
    } catch (notifErr) {
      console.error("Failed to dispatch payment rejection notification:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: "Payment submission rejected. Customer can resubmit proof.",
    });
  } catch (error: any) {
    console.error("Reject payment error:", error);
    return NextResponse.json(
      { error: "Failed to reject payment." },
      { status: 500 }
    );
  }
}
