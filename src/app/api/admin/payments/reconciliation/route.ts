import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import {
  shopUpiAccounts,
  paymentSubmissions,
  payments,
  orders,
  users,
} from "@/db/schema";
import {
  getAllUpiAccounts,
  getActiveUpiAccount,
  switchActiveUpiAccount,
  isValidUpiId,
} from "@/lib/settings";
import { eq, desc, and, or, like, sql, gte, lte } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const switchAccountSchema = z.object({
  upiId: z.string().min(3, "UPI ID is required"),
  accountDisplayName: z.string().min(2, "Account display name is required"),
  merchantName: z.string().optional(),
  qrMode: z.enum(["uploaded_image", "generated_upi_id"]).optional(),
  uploadedQrImageUrl: z.string().optional().nullable(),
  paymentInstructions: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Administrator privileges required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const accountIdFilter = searchParams.get("accountId") || "all";
    const statusFilter = searchParams.get("status") || "all";
    const searchQuery = (searchParams.get("search") || "").trim();
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(5, parseInt(searchParams.get("limit") || "20", 10)));

    // 1. Fetch all receiving accounts & active account
    const accounts = await getAllUpiAccounts();
    const activeAccount = await getActiveUpiAccount();

    // 2. Fetch all payment submissions with customer & order metadata for aggregation
    const allSubmissions = await db
      .select({
        id: paymentSubmissions.id,
        orderId: paymentSubmissions.orderId,
        orderReference: orders.orderReference,
        customerId: paymentSubmissions.customerId,
        customerName: users.fullName,
        customerEmail: users.email,
        amount: paymentSubmissions.amount,
        receivingAccountId: paymentSubmissions.receivingAccountId,
        receivingUpiIdSnapshot: paymentSubmissions.receivingUpiIdSnapshot,
        receivingAccountNameSnapshot: paymentSubmissions.receivingAccountNameSnapshot,
        upiIdUsed: paymentSubmissions.upiIdUsed,
        transactionId: paymentSubmissions.transactionId,
        status: paymentSubmissions.status,
        submissionType: paymentSubmissions.submissionType,
        isDuplicateFlagged: paymentSubmissions.isDuplicateFlagged,
        rejectionReason: paymentSubmissions.rejectionReason,
        rejectionNote: paymentSubmissions.rejectionNote,
        verifiedByAdminId: paymentSubmissions.verifiedByAdminId,
        verifiedAt: paymentSubmissions.verifiedAt,
        verificationNote: paymentSubmissions.verificationNote,
        createdAt: paymentSubmissions.createdAt,
      })
      .from(paymentSubmissions)
      .innerJoin(orders, eq(paymentSubmissions.orderId, orders.id))
      .innerJoin(users, eq(paymentSubmissions.customerId, users.id));

    // Fetch verified payments master records
    const allVerifiedPayments = await db.select().from(payments);

    // Fetch admin users for resolver
    const adminUsers = await db
      .select({ id: users.id, fullName: users.fullName, email: users.email })
      .from(users)
      .where(eq(users.role, "admin"));
    const adminMap = new Map(adminUsers.map((a) => [a.id, a.fullName]));

    // 3. Compute per-account metrics
    const accountMetrics = accounts.map((acc) => {
      // An item belongs to this account if receivingAccountId matches, or if receivingUpiIdSnapshot matches
      const associated = allSubmissions.filter(
        (s) =>
          s.receivingAccountId === acc.id ||
          (!s.receivingAccountId &&
            (s.receivingUpiIdSnapshot === acc.upiId || s.upiIdUsed === acc.upiId))
      );

      const verified = associated.filter((s) => s.status === "verified");
      const pending = associated.filter(
        (s) => s.status === "pending_verification" || s.status === "review_required"
      );
      const rejected = associated.filter((s) => s.status === "rejected");

      const verifiedAmount = verified.reduce((sum, s) => sum + s.amount, 0);
      const pendingAmount = pending.reduce((sum, s) => sum + s.amount, 0);
      const rejectedAmount = rejected.reduce((sum, s) => sum + s.amount, 0);

      return {
        ...acc,
        totalPaymentsCount: associated.length,
        verifiedAmount: Math.round(verifiedAmount * 100) / 100,
        verifiedCount: verified.length,
        pendingAmount: Math.round(pendingAmount * 100) / 100,
        pendingCount: pending.length,
        rejectedAmount: Math.round(rejectedAmount * 100) / 100,
        rejectedCount: rejected.length,
      };
    });

    // 4. Overall system metrics
    const totalVerifiedRevenue = allSubmissions
      .filter((s) => s.status === "verified")
      .reduce((sum, s) => sum + s.amount, 0);
    const totalPendingReview = allSubmissions
      .filter((s) => s.status === "pending_verification" || s.status === "review_required")
      .reduce((sum, s) => sum + s.amount, 0);
    const totalRejectedAmount = allSubmissions
      .filter((s) => s.status === "rejected")
      .reduce((sum, s) => sum + s.amount, 0);

    // 5. Filter ledger records
    let filtered = [...allSubmissions];

    if (accountIdFilter !== "all") {
      filtered = filtered.filter(
        (s) =>
          s.receivingAccountId === accountIdFilter ||
          (!s.receivingAccountId &&
            accounts.find((a) => a.id === accountIdFilter)?.upiId === (s.receivingUpiIdSnapshot || s.upiIdUsed))
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((s) => s.status === statusFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.transactionId.toLowerCase().includes(q) ||
          s.orderReference.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          s.customerEmail.toLowerCase().includes(q) ||
          (s.receivingUpiIdSnapshot && s.receivingUpiIdSnapshot.toLowerCase().includes(q))
      );
    }

    if (startDateParam) {
      const startMs = new Date(startDateParam).getTime();
      if (!isNaN(startMs)) {
        filtered = filtered.filter((s) => s.createdAt >= startMs);
      }
    }

    if (endDateParam) {
      const endMs = new Date(endDateParam).getTime() + 86400000; // End of day
      if (!isNaN(endMs)) {
        filtered = filtered.filter((s) => s.createdAt <= endMs);
      }
    }

    // Sort descending by submission date
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / limit) || 1;
    const offset = (page - 1) * limit;
    const pagedRecords = filtered.slice(offset, offset + limit).map((r) => ({
      ...r,
      verifiedByAdminName: r.verifiedByAdminId ? adminMap.get(r.verifiedByAdminId) || "Administrator" : null,
      receivingUpiId: r.receivingUpiIdSnapshot || r.upiIdUsed,
      receivingAccountName: r.receivingAccountNameSnapshot || "Primary Account",
    }));

    return NextResponse.json({
      success: true,
      accounts: accountMetrics,
      activeAccount,
      overallMetrics: {
        totalVerifiedRevenue: Math.round(totalVerifiedRevenue * 100) / 100,
        totalPendingReview: Math.round(totalPendingReview * 100) / 100,
        totalRejectedAmount: Math.round(totalRejectedAmount * 100) / 100,
        totalSubmissionsCount: allSubmissions.length,
      },
      records: pagedRecords,
      pagination: {
        page,
        limit,
        total: totalRecords,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error("Payment reconciliation error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve payment reconciliation data." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Administrator privileges required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = switchAccountSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const {
      upiId,
      accountDisplayName,
      merchantName,
      qrMode,
      uploadedQrImageUrl,
      paymentInstructions,
      internalNotes,
    } = validation.data;

    if (!isValidUpiId(upiId)) {
      return NextResponse.json(
        { error: "Invalid UPI ID format. Standard handle like name@bank is required." },
        { status: 400 }
      );
    }

    const newAccount = await switchActiveUpiAccount({
      upiId,
      accountDisplayName,
      merchantName,
      qrMode,
      uploadedQrImageUrl,
      paymentInstructions,
      internalNotes,
      adminUserId: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      message: `Active receiving UPI account switched to ${newAccount.upiId}`,
      account: newAccount,
    });
  } catch (error: any) {
    console.error("Switch UPI account error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to switch active UPI account." },
      { status: 500 }
    );
  }
}
