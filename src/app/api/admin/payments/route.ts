import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import {
  paymentSubmissions,
  orders,
  users,
} from "@/db/schema";
import { eq, desc, inArray, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

export interface AdminPaymentRow {
  id: string; // paymentSubmission id OR synthesized `unpaid_${orderId}`
  orderId: string;
  orderReference: string;
  orderStatus: string;
  orderPaymentStatus: string;
  orderType: string;
  deliveryType: string;
  amount: number;
  paymentMethod: string;
  orderCreatedAt: number;
  customer: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  };
  // Submission details (null if customer has not submitted yet)
  hasSubmission: boolean;
  submissionId: string | null;
  transactionId: string | null;
  screenshotFileId: string | null;
  screenshotUrl: string | null;
  submissionStatus: "awaiting_payment" | "pending_verification" | "verified" | "rejected" | "review_required";
  submissionType: "standard" | "post_cancellation_claim" | null;
  isDuplicateFlagged: boolean;
  duplicateNotes: string | null;
  rejectionReason: string | null;
  rejectionNote: string | null;
  verifiedAt: number | null;
  verificationNote: string | null;
  attemptNumber: number;
  submittedAt: number | null;
  // Synthesized audit & status labels
  statusLabel: string;
  nextRequiredAction: string;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") || "all";
    const search = searchParams.get("search")?.toLowerCase().trim();

    // 1. Fetch all orders that require payment or have submissions
    const allRelevantOrders = await db
      .select({
        id: orders.id,
        orderReference: orders.orderReference,
        orderStatus: orders.orderStatus,
        paymentStatus: orders.paymentStatus,
        paymentMethod: orders.paymentMethod,
        orderType: orders.orderType,
        deliveryType: orders.deliveryType,
        totalAmount: orders.totalAmount,
        createdAt: orders.createdAt,
        customerId: orders.customerId,
        customerName: users.fullName,
        customerEmail: users.email,
        customerPhone: users.phone,
      })
      .from(orders)
      .innerJoin(users, eq(orders.customerId, users.id))
      .orderBy(desc(orders.createdAt));

    // 2. Fetch all payment submissions
    const allSubmissions = await db
      .select()
      .from(paymentSubmissions)
      .orderBy(desc(paymentSubmissions.createdAt));

    // Group submissions by orderId
    const submissionsByOrder = new Map<string, typeof allSubmissions>();
    for (const sub of allSubmissions) {
      if (!submissionsByOrder.has(sub.orderId)) {
        submissionsByOrder.set(sub.orderId, []);
      }
      submissionsByOrder.get(sub.orderId)!.push(sub);
    }

    // 3. Synthesize payment rows
    const rows: AdminPaymentRow[] = [];

    for (const ord of allRelevantOrders) {
      const ordSubs = submissionsByOrder.get(ord.id) || [];
      const isUpiOrOnline = ord.paymentMethod === "upi_mock" || ord.paymentMethod === "online";

      // If there are submissions, create row for the latest submission
      if (ordSubs.length > 0) {
        const latest = ordSubs[0];

        let statusLabel = "Proof submitted — awaiting verification";
        let nextRequiredAction = "Verify UTR in bank account & match order total";

        if (latest.status === "verified" || ord.paymentStatus === "paid") {
          statusLabel = "Payment verified";
          nextRequiredAction = "None (Payment Confirmed)";
        } else if (ord.orderStatus === "cancelled" || latest.status === "review_required") {
          statusLabel = ord.orderStatus === "cancelled"
            ? "Order cancelled — payment claim requires review"
            : "Payment outcome requires investigation";
          nextRequiredAction = "Reconcile transfer against bank records; resolve refund or reopen";
        } else if (latest.status === "rejected") {
          statusLabel = "Payment rejected — correction required";
          nextRequiredAction = "Awaiting customer resubmission";
        }

        const effectiveStatus: AdminPaymentRow["submissionStatus"] =
          latest.status === "verified" || ord.paymentStatus === "paid"
            ? "verified"
            : ord.orderStatus === "cancelled" || latest.status === "review_required" || latest.isDuplicateFlagged
            ? "review_required"
            : latest.status === "rejected"
            ? "rejected"
            : "pending_verification";

        rows.push({
          id: latest.id,
          orderId: ord.id,
          orderReference: ord.orderReference,
          orderStatus: ord.orderStatus,
          orderPaymentStatus: ord.paymentStatus,
          orderType: ord.orderType,
          deliveryType: ord.deliveryType,
          amount: latest.amount || ord.totalAmount,
          paymentMethod: ord.paymentMethod,
          orderCreatedAt: ord.createdAt,
          customer: {
            id: ord.customerId,
            fullName: ord.customerName || "Customer",
            email: ord.customerEmail || "",
            phone: ord.customerPhone,
          },
          hasSubmission: true,
          submissionId: latest.id,
          transactionId: latest.transactionId,
          screenshotFileId: latest.screenshotFileId,
          screenshotUrl: latest.screenshotUrl,
          submissionStatus: effectiveStatus,
          submissionType: latest.submissionType as any,
          isDuplicateFlagged: Boolean(latest.isDuplicateFlagged),
          duplicateNotes: latest.duplicateNotes,
          rejectionReason: latest.rejectionReason,
          rejectionNote: latest.rejectionNote,
          verifiedAt: latest.verifiedAt,
          verificationNote: latest.verificationNote,
          attemptNumber: latest.attemptNumber || 1,
          submittedAt: latest.createdAt,
          statusLabel,
          nextRequiredAction,
        });
      } else if (isUpiOrOnline && ord.paymentStatus !== "paid") {
        // Order was placed with UPI / Online, but customer has NOT submitted proof yet!
        rows.push({
          id: `unpaid_${ord.id}`,
          orderId: ord.id,
          orderReference: ord.orderReference,
          orderStatus: ord.orderStatus,
          orderPaymentStatus: ord.paymentStatus,
          orderType: ord.orderType,
          deliveryType: ord.deliveryType,
          amount: ord.totalAmount,
          paymentMethod: ord.paymentMethod,
          orderCreatedAt: ord.createdAt,
          customer: {
            id: ord.customerId,
            fullName: ord.customerName || "Customer",
            email: ord.customerEmail || "",
            phone: ord.customerPhone,
          },
          hasSubmission: false,
          submissionId: null,
          transactionId: null,
          screenshotFileId: null,
          screenshotUrl: null,
          submissionStatus: "awaiting_payment",
          submissionType: null,
          isDuplicateFlagged: false,
          duplicateNotes: null,
          rejectionReason: null,
          rejectionNote: null,
          verifiedAt: null,
          verificationNote: null,
          attemptNumber: 0,
          submittedAt: null,
          statusLabel: "Awaiting customer payment",
          nextRequiredAction: "Customer has not submitted payment proof",
        });
      }
    }

    // 4. Calculate counts across all categories
    const counts = {
      all: rows.length,
      awaiting_payment: rows.filter((r) => r.submissionStatus === "awaiting_payment").length,
      pending_verification: rows.filter((r) => r.submissionStatus === "pending_verification").length,
      verified: rows.filter((r) => r.submissionStatus === "verified").length,
      rejected: rows.filter((r) => r.submissionStatus === "rejected").length,
      review_required: rows.filter((r) => r.submissionStatus === "review_required").length,
    };

    // 5. Apply filters
    const filtered = rows.filter((row) => {
      // Status filter
      if (statusFilter && statusFilter !== "all") {
        if (row.submissionStatus !== statusFilter) {
          return false;
        }
      }

      // Search filter
      if (search) {
        const matchesRef = row.orderReference.toLowerCase().includes(search);
        const matchesName = row.customer.fullName.toLowerCase().includes(search);
        const matchesEmail = row.customer.email.toLowerCase().includes(search);
        const matchesPhone = row.customer.phone?.includes(search);
        const matchesTrId = row.transactionId?.toLowerCase().includes(search);
        return Boolean(matchesRef || matchesName || matchesEmail || matchesPhone || matchesTrId);
      }

      return true;
    });

    return NextResponse.json({
      success: true,
      payments: filtered,
      counts,
    });
  } catch (error: any) {
    console.error("Fetch admin payments queue error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve payments list." },
      { status: 500 }
    );
  }
}
