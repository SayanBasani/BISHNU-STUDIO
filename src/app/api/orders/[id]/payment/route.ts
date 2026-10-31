import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import {
  orders,
  orderFiles,
  paymentSubmissions,
  users,
} from "@/db/schema";
import {
  getShopSettings,
  getActiveUpiAccount,
  buildUpiPaymentUri,
  getUpiAppLinks,
  generateQrCodeDataUrl,
  normalizeTransactionId,
  isValidTransactionId,
} from "@/lib/settings";
import { recordOrderEvent } from "@/lib/order-timeline";
import { logAuditEvent } from "@/lib/audit";
import { recordMutationIfInFallback } from "@/lib/db-sync";
import { eq, and, desc, ne } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const submitPaymentProofSchema = z.object({
  transactionId: z.string().min(8, "Transaction ID must be at least 8 characters"),
  screenshotFileId: z.string().min(1, "Payment screenshot is required"),
  idempotencyKey: z.string().optional(),
});

// GET /api/orders/[id]/payment
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Fetch order
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (orderRows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderRows[0];
    const isAdmin = auth.user.role === "admin";

    if (!isAdmin && order.customerId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch payment submissions for this order
    const submissions = await db
      .select({
        id: paymentSubmissions.id,
        orderId: paymentSubmissions.orderId,
        amount: paymentSubmissions.amount,
        paymentMethod: paymentSubmissions.paymentMethod,
        upiIdUsed: paymentSubmissions.upiIdUsed,
        receivingAccountId: paymentSubmissions.receivingAccountId,
        receivingUpiIdSnapshot: paymentSubmissions.receivingUpiIdSnapshot,
        receivingAccountNameSnapshot: paymentSubmissions.receivingAccountNameSnapshot,
        transactionId: paymentSubmissions.transactionId,
        screenshotFileId: paymentSubmissions.screenshotFileId,
        screenshotUrl: paymentSubmissions.screenshotUrl,
        status: paymentSubmissions.status,
        submissionType: paymentSubmissions.submissionType,
        isDuplicateFlagged: paymentSubmissions.isDuplicateFlagged,
        duplicateNotes: paymentSubmissions.duplicateNotes,
        rejectionReason: paymentSubmissions.rejectionReason,
        rejectionNote: paymentSubmissions.rejectionNote,
        verifiedAt: paymentSubmissions.verifiedAt,
        verificationNote: paymentSubmissions.verificationNote,
        attemptNumber: paymentSubmissions.attemptNumber,
        createdAt: paymentSubmissions.createdAt,
      })
      .from(paymentSubmissions)
      .where(eq(paymentSubmissions.orderId, id))
      .orderBy(desc(paymentSubmissions.createdAt));

    // Get latest submission
    const latestSubmission = submissions.length > 0 ? submissions[0] : null;

    // Fetch active shop settings and active receiving account
    const settings = await getShopSettings();
    const activeAccount = await getActiveUpiAccount();

    // Preserve original receiving account if this order was already submitted with a specific account
    let targetUpiId = activeAccount.upiId;
    let targetMerchantName = activeAccount.merchantName || settings.merchantName || settings.shopName;
    let targetDisplayName = activeAccount.accountDisplayName;
    let targetAccountId = activeAccount.id;
    let targetQrMode = activeAccount.qrMode || settings.qrMode;
    let targetQrImageUrl = activeAccount.uploadedQrImageUrl || settings.uploadedQrImageUrl;

    if (latestSubmission?.receivingUpiIdSnapshot || latestSubmission?.upiIdUsed) {
      targetUpiId = latestSubmission.receivingUpiIdSnapshot || latestSubmission.upiIdUsed;
      if (latestSubmission.receivingAccountNameSnapshot) {
        targetDisplayName = latestSubmission.receivingAccountNameSnapshot;
      }
      if (latestSubmission.receivingAccountId) {
        targetAccountId = latestSubmission.receivingAccountId;
      }
    }

    // Generate UPI URI & QR Code for the intended account
    let upiUri: string | null = null;
    let upiAppLinks: Record<string, string> | null = null;
    let qrCodeDataUrl: string | null = null;

    if (settings.upiEnabled) {
      upiUri = buildUpiPaymentUri({
        upiId: targetUpiId,
        merchantName: targetMerchantName,
        amount: order.totalAmount,
        orderReference: order.orderReference,
      });

      upiAppLinks = getUpiAppLinks(upiUri);

      if (targetQrMode === "uploaded_image" && targetQrImageUrl) {
        qrCodeDataUrl = targetQrImageUrl;
      } else {
        qrCodeDataUrl = await generateQrCodeDataUrl(upiUri);
      }
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderReference: order.orderReference,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        orderStatus: order.orderStatus,
        deliveryType: order.deliveryType,
        createdAt: order.createdAt,
      },
      paymentConfig: {
        upiEnabled: settings.upiEnabled,
        merchantName: targetMerchantName,
        accountDisplayName: targetDisplayName,
        receivingAccountId: targetAccountId,
        upiId: targetUpiId,
        receivingAccountLabel: "Intended receiving UPI ID",
        qrMode: targetQrMode,
        qrCodeDataUrl,
        upiUri,
        upiAppLinks,
        paymentInstructions: settings.paymentInstructions,
      },
      latestSubmission,
      submissionsHistory: submissions,
      canReportPayment: order.orderStatus === "cancelled" && order.paymentStatus !== "paid",
    });
  } catch (error: any) {
    console.error("Fetch order payment details error:", error);
    return NextResponse.json(
      { error: "Failed to load payment details." },
      { status: 500 }
    );
  }
}

// POST /api/orders/[id]/payment - Submit payment proof or report transfer
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (orderRows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderRows[0];
    const isAdmin = auth.user.role === "admin";

    if (!isAdmin && order.customerId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if order is already paid
    if (order.paymentStatus === "paid") {
      return NextResponse.json(
        { error: "This order is already paid and verified." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validation = submitPaymentProofSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { transactionId, screenshotFileId, idempotencyKey } = validation.data;
    const cleanTrId = normalizeTransactionId(transactionId);

    // Validate transaction reference format
    if (!isValidTransactionId(cleanTrId)) {
      return NextResponse.json(
        {
          error:
            "Invalid UPI Transaction Reference / UTR format. Please provide an authentic 8 to 30 character alphanumeric transaction ID.",
        },
        { status: 400 }
      );
    }

    // Case H: Check for identical pending submission for this order (idempotency guard)
    const existingSubmission = await db
      .select()
      .from(paymentSubmissions)
      .where(
        and(
          eq(paymentSubmissions.orderId, id),
          eq(paymentSubmissions.transactionId, cleanTrId)
        )
      )
      .limit(1);

    if (
      existingSubmission.length > 0 &&
      (existingSubmission[0].status === "pending_verification" ||
        existingSubmission[0].status === "review_required")
    ) {
      return NextResponse.json({
        success: true,
        message: "Payment proof is already recorded and awaiting verification.",
        submissionId: existingSubmission[0].id,
        isIdempotent: true,
      });
    }

    // Verify screenshot file exists
    const fileRows = await db
      .select()
      .from(orderFiles)
      .where(eq(orderFiles.id, screenshotFileId))
      .limit(1);

    if (fileRows.length === 0) {
      return NextResponse.json(
        { error: "Uploaded screenshot file not found. Please upload again." },
        { status: 400 }
      );
    }

    const screenshotFile = fileRows[0];

    // Case K: Order is cancelled, but customer already transferred money
    const isCancelledOrder = order.orderStatus === "cancelled";
    const submissionType = isCancelledOrder ? "post_cancellation_claim" : "standard";

    // Duplicate UTR check across OTHER orders
    const duplicateVerified = await db
      .select()
      .from(paymentSubmissions)
      .where(
        and(
          eq(paymentSubmissions.transactionId, cleanTrId),
          eq(paymentSubmissions.status, "verified"),
          ne(paymentSubmissions.orderId, id)
        )
      )
      .limit(1);

    if (duplicateVerified.length > 0) {
      return NextResponse.json(
        {
          error:
            "This Transaction Reference (UTR) has already been verified for another order. Please check your bank transaction details or contact shop support.",
        },
        { status: 400 }
      );
    }

    // Check if another order has a pending submission with the exact same UTR (Case L)
    const duplicatePending = await db
      .select()
      .from(paymentSubmissions)
      .where(
        and(
          eq(paymentSubmissions.transactionId, cleanTrId),
          eq(paymentSubmissions.status, "pending_verification"),
          ne(paymentSubmissions.orderId, id)
        )
      )
      .limit(1);

    let isDuplicateFlagged = false;
    let duplicateNotes: string | null = null;

    if (duplicatePending.length > 0) {
      isDuplicateFlagged = true;
      duplicateNotes = `Same UTR ${cleanTrId} is also pending verification on another order (${duplicatePending[0].orderId}). Flagged for manual bank statement reconciliation.`;
    }

    // Determine target payment state:
    // If order is cancelled OR duplicate is flagged -> 'review_required'
    // Otherwise -> 'pending_verification'
    const targetSubmissionStatus =
      isCancelledOrder || isDuplicateFlagged ? "review_required" : "pending_verification";
    const targetOrderPaymentStatus =
      isCancelledOrder || isDuplicateFlagged ? "review_required" : "pending_verification";

    // Check existing attempts for this order to increment attempt count
    const existingAttempts = await db
      .select()
      .from(paymentSubmissions)
      .where(eq(paymentSubmissions.orderId, id));

    const attemptNumber = existingAttempts.length + 1;
    const submissionId = `pay_sub_${crypto.randomUUID()}`;
    const settings = await getShopSettings();
    const activeAccount = await getActiveUpiAccount();

    // Preserve previous receiving account if already established for this order
    let targetAccountId = activeAccount.id;
    let targetUpiId = activeAccount.upiId;
    let targetAccountName = activeAccount.accountDisplayName;

    if (existingAttempts.length > 0) {
      const prior = existingAttempts[existingAttempts.length - 1];
      if (prior.receivingAccountId) targetAccountId = prior.receivingAccountId;
      if (prior.receivingUpiIdSnapshot) targetUpiId = prior.receivingUpiIdSnapshot;
      if (prior.receivingAccountNameSnapshot) targetAccountName = prior.receivingAccountNameSnapshot;
    }

    // Link file to order
    await db
      .update(orderFiles)
      .set({ orderId: id })
      .where(eq(orderFiles.id, screenshotFile.id));

    await recordMutationIfInFallback(db, {
      entityType: "order_files",
      entityId: screenshotFile.id,
      operation: "UPDATE",
      payload: { orderId: id },
    });

    const now = Date.now();
    const submissionData = {
      id: submissionId,
      orderId: id,
      customerId: order.customerId,
      amount: order.totalAmount,
      paymentMethod: "upi" as const,
      upiIdUsed: targetUpiId,
      receivingAccountId: targetAccountId,
      receivingUpiIdSnapshot: targetUpiId,
      receivingAccountNameSnapshot: targetAccountName,
      transactionId: cleanTrId,
      screenshotFileId: screenshotFile.id,
      screenshotUrl: `/api/files/download/${screenshotFile.id}`,
      status: targetSubmissionStatus as any,
      submissionType: submissionType as any,
      isDuplicateFlagged,
      duplicateNotes,
      idempotencyKey: idempotencyKey || null,
      attemptNumber,
      createdAt: now,
      updatedAt: now,
    };

    // Insert payment submission with immutable receiving account snapshot
    await db.insert(paymentSubmissions).values(submissionData);
    await recordMutationIfInFallback(db, {
      entityType: "payment_submissions",
      entityId: submissionId,
      operation: "INSERT",
      payload: submissionData,
    });

    const orderUpdates = {
      paymentStatus: targetOrderPaymentStatus as any,
      paymentMethod: "upi_mock" as any,
      updatedAt: now,
    };

    // Update order payment status
    await db
      .update(orders)
      .set(orderUpdates)
      .where(eq(orders.id, id));

    await recordMutationIfInFallback(db, {
      entityType: "orders",
      entityId: id,
      operation: "UPDATE",
      payload: orderUpdates,
    });

    // Record timeline event
    await recordOrderEvent({
      orderId: id,
      previousStatus: order.orderStatus,
      newStatus: order.orderStatus,
      previousPaymentStatus: order.paymentStatus,
      newPaymentStatus: targetOrderPaymentStatus,
      changedByUserId: auth.user.id,
      actorRole: "customer",
      customerMessage: isCancelledOrder
        ? `Customer reported UPI transfer for cancelled order (UTR: ${cleanTrId}). Submitted for administrative review.`
        : isDuplicateFlagged
        ? `Customer submitted UPI payment proof (UTR: ${cleanTrId}). Reference flagged for investigation.`
        : `Customer submitted UPI payment proof (UTR: ${cleanTrId}). Awaiting shop verification.`,
      internalNote: isCancelledOrder
        ? `POST-CANCELLATION CLAIM: Customer submitted UTR ${cleanTrId} after cancellation. Case set to REVIEW_REQUIRED.`
        : isDuplicateFlagged
        ? `DUPLICATE UTR DETECTED: UTR ${cleanTrId} also appears on order ${duplicatePending[0].orderId}. Set to REVIEW_REQUIRED.`
        : `Payment attempt #${attemptNumber} submitted with UTR ${cleanTrId}. Screenshot linked.`,
    });

    // Audit log
    await logAuditEvent({
      userId: auth.user.id,
      action: isCancelledOrder ? "report_cancelled_order_payment" : "submit_payment_proof",
      entityType: "payment",
      entityId: submissionId,
      details: {
        orderReference: order.orderReference,
        transactionId: cleanTrId,
        attemptNumber,
        amount: order.totalAmount,
        isCancelledOrder,
        isDuplicateFlagged,
      },
    });

    // Dispatch persistent notifications
    try {
      const { createNotification } = await import("@/lib/notifications");
      // Admin notification
      await createNotification({
        recipientType: "admin",
        category: "payment",
        eventType: "payment_proof_submitted",
        title: `Payment Proof Submitted (${order.orderReference})`,
        message: `Customer submitted payment proof (UTR: ${cleanTrId}) for ₹${order.totalAmount.toFixed(2)}. ${isDuplicateFlagged ? "FLAGGED: Possible duplicate." : "Requires verification."}`,
        entityType: "payment",
        entityId: submissionId,
        linkUrl: `/admin/orders/${id}`,
        priority: isDuplicateFlagged ? "urgent" : "high",
        deduplicationKey: `notif_admin_pay_sub_${submissionId}`,
      });

      // Customer notification
      await createNotification({
        recipientType: "customer",
        recipientId: auth.user.id,
        category: "payment",
        eventType: "payment_proof_submitted",
        title: `Payment Proof Received (${order.orderReference})`,
        message: `Your payment proof (UTR: ${cleanTrId}) has been submitted and is pending shop verification.`,
        entityType: "payment",
        entityId: submissionId,
        linkUrl: `/account/orders/${id}`,
        deduplicationKey: `notif_cust_pay_sub_${submissionId}`,
      });
    } catch (notifErr) {
      console.error("Failed to dispatch payment submission notifications:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: isCancelledOrder
        ? "Your payment report has been submitted. Our team will review your transfer and contact you regarding fulfilment or refund."
        : isDuplicateFlagged
        ? "Payment proof submitted. Note: this transaction reference was flagged for standard administrative verification."
        : "Payment proof submitted successfully. The shop will verify your payment against bank records.",
      submissionId,
      status: targetSubmissionStatus,
    });
  } catch (error: any) {
    console.error("Submit payment proof error:", error);
    return NextResponse.json(
      { error: "Failed to submit payment proof. Please try again." },
      { status: 500 }
    );
  }
}
