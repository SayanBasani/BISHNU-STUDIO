import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { paymentSubmissions, orders, users } from "@/db/schema";
import { getAllUpiAccounts } from "@/lib/settings";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function escapeCsvField(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  // If field contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

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

    // Fetch accounts and submissions
    const accounts = await getAllUpiAccounts();

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

    // Admin users map
    const adminUsers = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(eq(users.role, "admin"));
    const adminMap = new Map(adminUsers.map((a) => [a.id, a.fullName]));

    // Filter
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
      const endMs = new Date(endDateParam).getTime() + 86400000;
      if (!isNaN(endMs)) {
        filtered = filtered.filter((s) => s.createdAt <= endMs);
      }
    }

    // Sort descending by submission date
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    // Build CSV content
    const headers = [
      "Submission ID",
      "Date & Time",
      "Order Reference",
      "Customer Name",
      "Customer Email",
      "Amount (INR)",
      "Status",
      "Transaction ID / UTR",
      "Intended Receiving UPI ID",
      "Receiving Account Name",
      "Verified By",
      "Verified At",
      "Rejection Reason",
      "Rejection Note",
      "Verification Note",
    ];

    const rows = filtered.map((r) => {
      const formattedDate = new Date(r.createdAt).toISOString().replace("T", " ").substring(0, 19);
      const verifiedDate = r.verifiedAt
        ? new Date(r.verifiedAt).toISOString().replace("T", " ").substring(0, 19)
        : "";
      const verifiedByName = r.verifiedByAdminId ? adminMap.get(r.verifiedByAdminId) || "Admin" : "";
      const receivingUpi = r.receivingUpiIdSnapshot || r.upiIdUsed;
      const receivingName = r.receivingAccountNameSnapshot || "Primary Account";

      return [
        escapeCsvField(r.id),
        escapeCsvField(formattedDate),
        escapeCsvField(r.orderReference),
        escapeCsvField(r.customerName),
        escapeCsvField(r.customerEmail),
        escapeCsvField(r.amount.toFixed(2)),
        escapeCsvField(r.status),
        escapeCsvField(r.transactionId),
        escapeCsvField(receivingUpi),
        escapeCsvField(receivingName),
        escapeCsvField(verifiedByName),
        escapeCsvField(verifiedDate),
        escapeCsvField(r.rejectionReason || ""),
        escapeCsvField(r.rejectionNote || ""),
        escapeCsvField(r.verificationNote || ""),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const dateStamp = new Date().toISOString().split("T")[0];
    const filename = `bishnu-studio-payment-reconciliation-${dateStamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Export reconciliation CSV error:", error);
    return NextResponse.json(
      { error: "Failed to export reconciliation data." },
      { status: 500 }
    );
  }
}
