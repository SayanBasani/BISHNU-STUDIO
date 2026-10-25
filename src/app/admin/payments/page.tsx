"use strict";
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  QrCode,
  FileText,
  User,
  Phone,
  Calendar,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

interface PaymentRow {
  id: string;
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
  statusLabel: string;
  nextRequiredAction: string;
}

interface Counts {
  all: number;
  awaiting_payment: number;
  pending_verification: number;
  verified: number;
  rejected: number;
  review_required: number;
}

export default function AdminPaymentsQueuePage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [counts, setCounts] = useState<Counts>({
    all: 0,
    awaiting_payment: 0,
    pending_verification: 0,
    verified: 0,
    rejected: 0,
    review_required: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [activeScreenshotUrl, setActiveScreenshotUrl] = useState<string | null>(null);
  const [verifyModalItem, setVerifyModalItem] = useState<PaymentRow | null>(null);
  const [rejectModalItem, setRejectModalItem] = useState<PaymentRow | null>(null);
  const [verificationNote, setVerificationNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("utr_not_found");
  const [rejectionNote, setRejectionNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/payments?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch payments.");
      setPayments(data.payments || []);
      if (data.counts) setCounts(data.counts);
    } catch (err: any) {
      setError(err?.message || "Failed to load payment queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPayments();
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleVerifyConfirm = async () => {
    if (!verifyModalItem?.submissionId) return;
    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/admin/payments/${verifyModalItem.submissionId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationNote: verificationNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify payment.");

      setVerifyModalItem(null);
      setVerificationNote("");
      await fetchPayments();
    } catch (err: any) {
      setActionError(err?.message || "Verification failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModalItem?.submissionId) return;
    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/admin/payments/${rejectModalItem.submissionId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectionReason,
          rejectionNote: rejectionNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject payment.");

      setRejectModalItem(null);
      setRejectionReason("utr_not_found");
      setRejectionNote("");
      await fetchPayments();
    } catch (err: any) {
      setActionError(err?.message || "Rejection failed.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              UPI Payments & Order Reconciliation
            </h1>
            {counts.pending_verification > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white animate-pulse">
                {counts.pending_verification} Needs Verification
              </span>
            )}
            {counts.review_required > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white">
                {counts.review_required} Review Required
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Review customer payment claims, match 12-digit UTRs with Bishnu Studio bank records, and verify order payments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/payments/reconciliation"
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" /> Reconciliation &amp; Account History
          </Link>
          <Link
            href="/admin/settings/payments"
            className="px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center gap-1.5 transition border border-purple-200 dark:border-purple-800"
          >
            <QrCode className="w-4 h-4" /> UPI Settings
          </Link>
          <button
            onClick={fetchPayments}
            className="p-2 rounded-xl border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 transition"
            title="Refresh queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {[
            { id: "all", label: "All Payments", count: counts.all },
            { id: "pending_verification", label: "Needs Verification", count: counts.pending_verification },
            { id: "review_required", label: "Review Required", count: counts.review_required },
            { id: "awaiting_payment", label: "Awaiting Payment", count: counts.awaiting_payment },
            { id: "verified", label: "Verified", count: counts.verified },
            { id: "rejected", label: "Rejected", count: counts.rejected },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  statusFilter === tab.id
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative max-w-sm w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Order Ref, Customer, UTR..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </form>
      </div>

      {/* Payments Table / List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
            <span>Loading payments and order verification status...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs space-y-2">
            <AlertTriangle className="w-6 h-6 mx-auto" />
            <p>{error}</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 text-xs space-y-2">
            <ShieldCheck className="w-8 h-8 mx-auto text-gray-400" />
            <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
              No payments match current filter
            </p>
            <p className="text-[11px]">
              {statusFilter !== "all"
                ? `No payment records in "${statusFilter.replace(/_/g, " ")}" status.`
                : "Customer UPI payment attempts and orders will appear here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Order / Customer</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Submitted UTR / Transaction ID</th>
                  <th className="py-3 px-4">Screenshot Proof</th>
                  <th className="py-3 px-4">Status & Audit</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {payments.map((p) => {
                  const isPending = p.submissionStatus === "pending_verification";
                  const isVerified = p.submissionStatus === "verified";
                  const isRejected = p.submissionStatus === "rejected";
                  const isReviewRequired = p.submissionStatus === "review_required";
                  const isAwaitingPayment = p.submissionStatus === "awaiting_payment";

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-gray-50/70 dark:hover:bg-slate-800/40 transition ${
                        isReviewRequired ? "bg-rose-50/30 dark:bg-rose-950/10" : ""
                      }`}
                    >
                      {/* Order & Customer */}
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/admin/orders/${p.orderId}`}
                            className="font-mono font-bold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1"
                          >
                            {p.orderReference}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                          {p.attemptNumber > 1 && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                              Attempt #{p.attemptNumber}
                            </span>
                          )}
                          {p.isDuplicateFlagged && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold text-[10px] flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Duplicate UTR
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-600 dark:text-gray-300">
                          <span className="font-semibold block text-gray-900 dark:text-white">
                            {p.customer.fullName}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 block truncate max-w-[180px]">
                            {p.customer.phone || p.customer.email}
                          </span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-extrabold text-sm text-gray-900 dark:text-white block">
                          {formatINR(p.amount)}
                        </span>
                        <span className="text-[10px] text-gray-400 uppercase">
                          {p.paymentMethod === "upi_mock" ? "UPI QR / App" : p.paymentMethod}
                        </span>
                      </td>

                      {/* UTR */}
                      <td className="py-3.5 px-4 space-y-1">
                        {p.transactionId ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded select-all text-xs">
                                {p.transactionId}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(p.transactionId!, p.id)}
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
                                title="Copy UTR"
                              >
                                {copiedId === p.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            {p.duplicateNotes && (
                              <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                                {p.duplicateNotes}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">
                            Payment not yet submitted
                          </span>
                        )}
                      </td>

                      {/* Screenshot Thumbnail */}
                      <td className="py-3.5 px-4">
                        {p.screenshotUrl ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveScreenshotUrl(p.screenshotUrl)}
                              className="group relative w-12 h-12 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 shrink-0 hover:ring-2 hover:ring-purple-500 transition"
                              title="Click to view full screenshot"
                            >
                              <img
                                src={p.screenshotUrl}
                                alt="Payment Proof"
                                className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                <Eye className="w-4 h-4 text-white" />
                              </div>
                            </button>
                            <a
                              href={p.screenshotUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-purple-600 dark:text-purple-400 hover:underline text-[11px] font-semibold flex items-center gap-0.5"
                            >
                              Open <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">No proof uploaded</span>
                        )}
                      </td>

                      {/* Status & Time */}
                      <td className="py-3.5 px-4 space-y-1">
                        <div>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isVerified
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : isReviewRequired
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : isPending
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : isRejected
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                                : "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300"
                            }`}
                          >
                            {isVerified && <CheckCircle2 className="w-3 h-3" />}
                            {isPending && <Clock className="w-3 h-3 animate-pulse" />}
                            {isReviewRequired && <AlertTriangle className="w-3 h-3" />}
                            {isRejected && <XCircle className="w-3 h-3" />}
                            {p.statusLabel}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {p.submittedAt
                            ? `Submitted: ${new Date(p.submittedAt).toLocaleString("en-IN")}`
                            : `Order: ${new Date(p.orderCreatedAt).toLocaleDateString("en-IN")}`}
                        </p>
                        {p.rejectionReason && (
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium truncate max-w-[200px]">
                            Reason: {p.rejectionReason.replace(/_/g, " ")}
                          </p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {p.hasSubmission && (isPending || isReviewRequired) ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setVerifyModalItem(p);
                                setActionError(null);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectModalItem(p);
                                setActionError(null);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800 transition inline-flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        ) : isVerified ? (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Verified
                          </span>
                        ) : isRejected ? (
                          <span className="text-[11px] text-rose-500 font-semibold">
                            Rejected
                          </span>
                        ) : (
                          <Link
                            href={`/admin/orders/${p.orderId}`}
                            className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                          >
                            View Order
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Screenshot Preview Modal */}
      {activeScreenshotUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-slate-800">
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                Payment Screenshot Preview
              </h3>
              <button
                onClick={() => setActiveScreenshotUrl(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              >
                ✕ Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-black/5 dark:bg-black/30 rounded-2xl p-2">
              <img
                src={activeScreenshotUrl}
                alt="Payment proof full"
                className="max-h-[65vh] w-auto object-contain rounded-xl"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <a
                href={activeScreenshotUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1"
              >
                Open in Full Window <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setActiveScreenshotUrl(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-white font-bold text-xs rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Confirmation Modal */}
      {verifyModalItem && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl space-y-4 border border-gray-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white">
                  Confirm Bank Verification
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Order {verifyModalItem.orderReference} • {formatINR(verifyModalItem.amount)}
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 rounded-xl space-y-1">
              <div className="font-bold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                Reconciliation Requirement
              </div>
              <p className="text-[11px]">
                Please confirm that you have checked your official bank statement or UPI app and verified the credit of <strong>{formatINR(verifyModalItem.amount)}</strong> under UTR <strong>{verifyModalItem.transactionId}</strong>.
              </p>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
                {actionError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Verification Note (Optional)
              </label>
              <input
                type="text"
                value={verificationNote}
                onChange={(e) => setVerificationNote(e.target.value)}
                placeholder="e.g. Verified via ICICI statement credit at 14:32"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setVerifyModalItem(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerifyConfirm}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Confirm Verified
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl space-y-4 border border-gray-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white">
                  Reject Payment Proof
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Order {rejectModalItem.orderReference} • UTR: {rejectModalItem.transactionId}
                </p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
                {actionError}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Rejection Reason *
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white"
                >
                  <option value="utr_not_found">UTR Not Found in Bank Account</option>
                  <option value="amount_mismatch">Amount Does Not Match Order Total</option>
                  <option value="screenshot_illegible">Screenshot Unreadable / Incomplete</option>
                  <option value="duplicate_transaction">Duplicate Transaction ID Used</option>
                  <option value="fake_receipt">Suspicious or Fabricated Proof</option>
                  <option value="other">Other Administrative Reason</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Message for Customer (Optional)
                </label>
                <textarea
                  rows={2}
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  placeholder="Explain what the customer needs to fix (e.g. please upload full receipt with time)"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
