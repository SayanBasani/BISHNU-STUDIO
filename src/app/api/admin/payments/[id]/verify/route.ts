import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { paymentSubmissions, orders, payments } from "@/db/schema";
import { recordOrderEvent } from "@/lib/order-timeline";
import { logAuditEvent } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const verifySchema = z.object({
  verificationNote: z.string().optional(),
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

    // Fetch payment submission
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

    // Fetch related order
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, submission.orderId))
      .limit(1);

    if (orderRows.length === 0) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const order = orderRows[0];

    // Concurrency / state guard
    if (submission.status === "verified") {
      return NextResponse.json(
        { error: "This payment submission is already marked as verified." },
        { status: 400 }
      );
    }

    if (submission.status === "rejected") {
      return NextResponse.json(
        { error: "This payment submission was already rejected. Customer must submit updated proof." },
        { status: 400 }
      );
    }

    let note = "";
    try {
      const body = await req.json();
      const validation = verifySchema.safeParse(body);
      if (validation.success && validation.data.verificationNote) {
        note = validation.data.verificationNote.trim();
      }
    } catch {}

    const now = Date.now();

    // 1. Update payment submission to verified
    await db
      .update(paymentSubmissions)
      .set({
        status: "verified",
        verifiedByAdminId: auth.user.id,
        verifiedAt: now,
        verificationNote: note || "Verified by shop administrator against bank statement",
        updatedAt: now,
      })
      .where(eq(paymentSubmissions.id, id));

    // 2. Update order payment status to paid
    // If order was pending OR cancelled (Case K post-cancellation claim verified), confirm it!
    const isCancelledReopening = order.orderStatus === "cancelled";
    const newOrderStatus =
      order.orderStatus === "pending" || isCancelledReopening
        ? "confirmed"
        : order.orderStatus;

    await db
      .update(orders)
      .set({
        paymentStatus: "paid",
        orderStatus: newOrderStatus,
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));

    // 3. Record in master payments table if not already present
    const existingPay = await db
      .select()
      .from(payments)
      .where(eq(payments.transactionReference, submission.transactionId))
      .limit(1);

    if (existingPay.length === 0) {
      await db.insert(payments).values({
        id: `pay_${crypto.randomUUID()}`,
        orderId: order.id,
        paymentProvider: "upi",
        transactionReference: submission.transactionId,
        amount: submission.amount,
        amountVerified: submission.amount,
        currency: "INR",
        status: "successful",
        receivingAccountId: submission.receivingAccountId || null,
        receivingUpiIdSnapshot: submission.receivingUpiIdSnapshot || submission.upiIdUsed,
        receivingAccountNameSnapshot: submission.receivingAccountNameSnapshot || null,
        verifiedByAdminId: auth.user.id,
        verifiedAt: now,
        paymentMetadataJson: JSON.stringify({
          submissionId: id,
          receivingAccountId: submission.receivingAccountId || null,
          receivingUpiIdSnapshot: submission.receivingUpiIdSnapshot || submission.upiIdUsed,
          receivingAccountNameSnapshot: submission.receivingAccountNameSnapshot || null,
          verifiedByAdminId: auth.user.id,
          verifiedAt: now,
          verificationNote: note,
          isCancelledReopening,
        }),
        createdAt: now,
      });
    }

    // 4. Record order timeline history
    await recordOrderEvent({
      orderId: order.id,
      previousStatus: order.orderStatus,
      newStatus: newOrderStatus,
      previousPaymentStatus: order.paymentStatus,
      newPaymentStatus: "paid",
      changedByUserId: auth.user.id,
      actorRole: "admin",
      customerMessage: isCancelledReopening
        ? `Payment verified by shop administrator (UTR: ${submission.transactionId}). Cancelled order reopened and confirmed!`
        : `Payment of ₹${submission.amount.toFixed(
            2
          )} verified by shop owner (UTR: ${submission.transactionId}). Order confirmed!`,
      internalNote: isCancelledReopening
        ? `POST-CANCELLATION RECOVERY: Verified by admin ${auth.user.fullName}. Cancelled order reopened as Confirmed. Note: ${note}`.trim()
        : `Payment verified by admin ${auth.user.fullName}. Note: ${note}`.trim(),
    });

    // 5. Audit Log
    await logAuditEvent({
      userId: auth.user.id,
      action: "verify_payment",
      entityType: "payment",
      entityId: id,
      details: {
        orderReference: order.orderReference,
        amount: submission.amount,
        transactionId: submission.transactionId,
        isCancelledReopening,
        note,
      },
    });

    // 6. Customer Notification
    try {
      const { createNotification } = await import("@/lib/notifications");
      await createNotification({
        recipientType: "customer",
        recipientId: order.customerId,
        category: "payment",
        eventType: "payment_verified",
        title: `Payment Verified (${order.orderReference})`,
        message: `Your payment of ₹${submission.amount.toFixed(2)} (UTR: ${submission.transactionId}) has been verified. Order confirmed!`,
        entityType: "order",
        entityId: order.id,
        linkUrl: `/account/orders/${order.id}`,
        priority: "high",
        deduplicationKey: `notif_payment_verified_${id}`,
      });
    } catch (notifErr) {
      console.error("Failed to dispatch payment verification notification:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: isCancelledReopening
        ? "Payment verified. Cancelled order has been successfully reopened and confirmed for production."
        : "Payment successfully verified and order confirmed.",
    });
  } catch (error: any) {
    console.error("Verify payment error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment." },
      { status: 500 }
    );
  }
}
