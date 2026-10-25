"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
  Download,
  Calendar,
  CreditCard,
  Building,
  User,
  ArrowRight,
  ExternalLink,
  PlusCircle,
  Copy,
  Check,
  Info,
  RefreshCw,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

interface AccountMetric {
  id: string;
  upiId: string;
  accountDisplayName: string;
  merchantName: string;
  qrMode: string;
  uploadedQrImageUrl?: string | null;
  paymentInstructions?: string | null;
  isActive: boolean;
  deactivatedAt?: number | null;
  internalNotes?: string | null;
  createdAt: number;
  totalPaymentsCount: number;
  verifiedAmount: number;
  verifiedCount: number;
  pendingAmount: number;
  pendingCount: number;
  rejectedAmount: number;
  rejectedCount: number;
}

interface OverallMetrics {
  totalVerifiedRevenue: number;
  totalPendingReview: number;
  totalRejectedAmount: number;
  totalSubmissionsCount: number;
}

interface LedgerRecord {
  id: string;
  orderId: string;
  orderReference: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  receivingAccountId?: string | null;
  receivingUpiIdSnapshot?: string | null;
  receivingAccountNameSnapshot?: string | null;
  receivingUpiId: string;
  receivingAccountName: string;
  upiIdUsed: string;
  transactionId: string;
  status: "pending_verification" | "verified" | "rejected" | "review_required";
  submissionType: string | null;
  isDuplicateFlagged: boolean;
  rejectionReason: string | null;
  rejectionNote: string | null;
  verifiedByAdminId: string | null;
  verifiedByAdminName: string | null;
  verifiedAt: number | null;
  verificationNote: string | null;
  createdAt: number;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function PaymentReconciliationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data states
  const [accounts, setAccounts] = useState<AccountMetric[]>([]);
  const [activeAccount, setActiveAccount] = useState<AccountMetric | null>(null);
  const [overallMetrics, setOverallMetrics] = useState<OverallMetrics>({
    totalVerifiedRevenue: 0,
    totalPendingReview: 0,
    totalRejectedAmount: 0,
    totalSubmissionsCount: 0,
  });
  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Filter states
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Switch Modal State
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [switchForm, setSwitchForm] = useState({
    upiId: "",
    accountDisplayName: "",
    merchantName: "Bishnu Studio",
    qrMode: "generated_upi_id" as "generated_upi_id" | "uploaded_image",
    uploadedQrImageUrl: "",
    paymentInstructions: "",
    internalNotes: "",
  });
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Inspection Modal State
  const [inspectRecord, setInspectRecord] = useState<LedgerRecord | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchReconciliationData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedAccountId !== "all") params.set("accountId", selectedAccountId);
      if (selectedStatus !== "all") params.set("status", selectedStatus);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("page", String(currentPage));
      params.set("limit", "20");

      const res = await fetch(`/api/admin/payments/reconciliation?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load payment reconciliation data");
      }
      const data = await res.json();
      if (data.success) {
        setAccounts(data.accounts || []);
        setActiveAccount(data.activeAccount || null);
        setOverallMetrics(
          data.overallMetrics || {
            totalVerifiedRevenue: 0,
            totalPendingReview: 0,
            totalRejectedAmount: 0,
            totalSubmissionsCount: 0,
          }
        );
        setRecords(data.records || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      } else {
        throw new Error(data.error || "Unknown server error");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load reconciliation data");
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, selectedStatus, searchQuery, startDate, endDate, currentPage]);

  useEffect(() => {
    fetchReconciliationData();
  }, [fetchReconciliationData]);

  const handleCopy = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenSwitchModal = () => {
    if (activeAccount) {
      setSwitchForm({
        upiId: "",
        accountDisplayName: "",
        merchantName: activeAccount.merchantName || "Bishnu Studio",
        qrMode: (activeAccount.qrMode as any) || "generated_upi_id",
        uploadedQrImageUrl: activeAccount.uploadedQrImageUrl || "",
        paymentInstructions: activeAccount.paymentInstructions || "",
        internalNotes: "",
      });
    }
    setSwitchError(null);
    setSwitchModalOpen(true);
  };

  const handleSwitchAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSwitching(true);
    setSwitchError(null);

    try {
      const res = await fetch("/api/admin/payments/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(switchForm),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to switch active receiving account");
      }

      setSwitchModalOpen(false);
      setSuccessMsg(`Successfully activated ${data.account.accountDisplayName} (${data.account.upiId}). Past orders preserve their original UPI snapshots.`);
      setTimeout(() => setSuccessMsg(null), 6000);
      await fetchReconciliationData();
    } catch (err: any) {
      setSwitchError(err?.message || "Failed to switch account");
    } finally {
      setSwitching(false);
    }
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (selectedAccountId !== "all") params.set("accountId", selectedAccountId);
    if (selectedStatus !== "all") params.set("status", selectedStatus);
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    window.open(`/api/admin/payments/reconciliation/export?${params.toString()}`, "_blank");
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/payments"
              className="text-xs font-semibold text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition flex items-center gap-1"
            >
              &larr; Back to Payment Verification Queue
            </Link>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Building className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            UPI Receiving Account History &amp; Payment Reconciliation
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Audit receiving account changes over time, reconcile verified banked revenue separately from unverified claims, and preserve historical payment snapshots.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export Reconciliation CSV
          </button>
          <button
            onClick={fetchReconciliationData}
            className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards: Verified Banked Revenue vs Pending Claims vs Rejected */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Confirmed Received Money
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {formatINR(overallMetrics.totalVerifiedRevenue)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Confirmed &amp; verified into Bishnu Studio bank account
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Claims Awaiting Review
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {formatINR(overallMetrics.totalPendingReview)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Customer submissions pending staff bank UTR match
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Rejected / Invalid Claims
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {formatINR(overallMetrics.totalRejectedAmount)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Flagged mismatch or fraudulent UTR references
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Total Submissions
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {overallMetrics.totalSubmissionsCount}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            All customer payment verification requests
          </p>
        </div>
      </div>

      {/* Active Receiving Account Banner & Switch Action */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-md border border-purple-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white uppercase tracking-wider">
                Currently Live For Customers
              </span>
              <span className="text-xs text-purple-200">
                Active Receiving Account
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-2 flex items-center gap-2">
              <span>{activeAccount?.accountDisplayName || "Primary Receiving Account"}</span>
              <span className="font-mono text-sm sm:text-base font-normal text-purple-200 bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
                {activeAccount?.upiId || "Loading..."}
              </span>
            </h2>
            <p className="text-xs text-purple-200/80 mt-1.5 max-w-2xl">
              Merchant Name: <strong className="text-white">{activeAccount?.merchantName || "Bishnu Studio"}</strong> &bull; QR Mode: <strong className="text-white">{activeAccount?.qrMode === "uploaded_image" ? "Custom Standee QR" : "Dynamic Amount QR"}</strong> &bull; Activated: {activeAccount ? new Date(activeAccount.createdAt).toLocaleDateString() : ""}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <button
              onClick={handleOpenSwitchModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-purple-50 text-purple-900 font-bold text-xs shadow transition"
            >
              <RotateCcw className="w-4 h-4 text-purple-700" />
              Switch Active Account
            </button>
          </div>
        </div>
      </div>

      {/* Historical Accounts Breakdown */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-purple-600" />
              Receiving Accounts History &amp; Balance Breakdown
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Historical receiving UPI accounts used by Bishnu Studio. Past orders maintain an immutable snapshot of their intended receiving account.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Account / Handle</th>
                <th className="py-3 px-3">Merchant Name</th>
                <th className="py-3 px-3">Active Period</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Confirmed Revenue</th>
                <th className="py-3 px-3 text-right">Pending Review</th>
                <th className="py-3 px-3 text-right">Rejected</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {accounts.map((acc) => (
                <tr
                  key={acc.id}
                  className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition ${
                    selectedAccountId === acc.id ? "bg-purple-50/50 dark:bg-purple-950/20" : ""
                  }`}
                >
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {acc.accountDisplayName}
                    </div>
                    <div className="font-mono text-[11px] text-purple-600 dark:text-purple-400 mt-0.5">
                      {acc.upiId}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                    {acc.merchantName}
                  </td>
                  <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                    <div>From: {new Date(acc.createdAt).toLocaleDateString()}</div>
                    {acc.deactivatedAt ? (
                      <div>To: {new Date(acc.deactivatedAt).toLocaleDateString()}</div>
                    ) : (
                      <div className="text-emerald-600 font-semibold">Current Active</div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {acc.isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Live Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        Retired / Historical
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    {formatINR(acc.verifiedAmount)}
                    <span className="block text-[10px] text-slate-400 font-normal">
                      {acc.verifiedCount} verified
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                    {formatINR(acc.pendingAmount)}
                    <span className="block text-[10px] text-slate-400 font-normal">
                      {acc.pendingCount} pending
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-rose-600 dark:text-rose-400">
                    {formatINR(acc.rejectedAmount)}
                    <span className="block text-[10px] text-slate-400 font-normal">
                      {acc.rejectedCount} rejected
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => {
                        setSelectedAccountId(selectedAccountId === acc.id ? "all" : acc.id);
                        setCurrentPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        selectedAccountId === acc.id
                          ? "bg-purple-600 text-white"
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {selectedAccountId === acc.id ? "Clear Filter" : "Filter Ledger"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Reconciliation Ledger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-purple-600" />
              Reconciliation Payment Ledger
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Individual payment submission records matched against receiving account snapshots.
            </p>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing <strong className="text-slate-900 dark:text-white">{records.length}</strong> of{" "}
            <strong className="text-slate-900 dark:text-white">{pagination.total}</strong> records
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Account Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Receiving Account
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountDisplayName} ({a.upiId})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Payment Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Statuses</option>
              <option value="verified">Verified (Confirmed)</option>
              <option value="pending_verification">Needs Verification</option>
              <option value="review_required">Review Required</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Search UTR / Order / Customer
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Order Ref</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Transaction ID / UTR</th>
                <th className="py-3 px-3">Intended Receiving UPI</th>
                <th className="py-3 px-3">Verified By</th>
                <th className="py-3 px-3 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                    Loading reconciliation records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No payment submissions match the selected filters.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString()}{" "}
                      <span className="text-[10px] text-slate-400">
                        {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-purple-600 dark:text-purple-400 whitespace-nowrap">
                      <Link href={`/admin/orders/${r.orderId}`} className="hover:underline flex items-center gap-1">
                        {r.orderReference}
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </Link>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{r.customerName}</div>
                      <div className="text-[10px] text-slate-400">{r.customerEmail}</div>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatINR(r.amount)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {r.status === "verified" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </span>
                      )}
                      {r.status === "pending_verification" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          <Clock className="w-3 h-3" /> Needs Verification
                        </span>
                      )}
                      {r.status === "review_required" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                          <AlertTriangle className="w-3 h-3" /> Review Required
                        </span>
                      )}
                      {r.status === "rejected" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <XCircle className="w-3 h-3" /> Rejected
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-1">
                        <span>{r.transactionId}</span>
                        <button
                          onClick={() => handleCopy(r.transactionId, `utr_${r.id}`)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title="Copy UTR"
                        >
                          {copiedField === `utr_${r.id}` ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                        {r.receivingUpiId}
                      </div>
                      <div className="text-[10px] text-slate-400">{r.receivingAccountName}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {r.verifiedByAdminName ? (
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">{r.verifiedByAdminName}</div>
                          {r.verifiedAt && (
                            <div className="text-[10px] text-slate-400">
                              {new Date(r.verifiedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">&ndash;</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setInspectRecord(r)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                        title="View Submission Snapshot"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Page <strong className="text-slate-900 dark:text-white">{pagination.page}</strong> of{" "}
            <strong className="text-slate-900 dark:text-white">{pagination.totalPages}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1 || loading}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Switch Account Modal */}
      {switchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-purple-600" />
                Switch Active Receiving UPI Account
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Activates a new receiving account for all subsequent checkout QR codes and deep links.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200 space-y-1">
              <strong className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                Immutable Historical Snapshot Guarantee
              </strong>
              <p className="text-[11px] text-purple-800 dark:text-purple-300 leading-relaxed">
                All existing orders, verified payments, and pending customer claims maintain their original UPI ID snapshot. Switching accounts will <strong>never</strong> erase or alter past payment records.
              </p>
            </div>

            {switchError && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{switchError}</span>
              </div>
            )}

            <form onSubmit={handleSwitchAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Receiving UPI ID * (e.g. name@bank)
                </label>
                <input
                  type="text"
                  required
                  value={switchForm.upiId}
                  onChange={(e) => setSwitchForm({ ...switchForm, upiId: e.target.value })}
                  placeholder="e.g. bishnustudio@icici"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Account Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={switchForm.accountDisplayName}
                  onChange={(e) => setSwitchForm({ ...switchForm, accountDisplayName: e.target.value })}
                  placeholder="e.g. Bishnu Studio Primary SBI"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Merchant Name
                  </label>
                  <input
                    type="text"
                    value={switchForm.merchantName}
                    onChange={(e) => setSwitchForm({ ...switchForm, merchantName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    QR Display Mode
                  </label>
                  <select
                    value={switchForm.qrMode}
                    onChange={(e) => setSwitchForm({ ...switchForm, qrMode: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="generated_upi_id">Dynamic QR Code (Recommended)</option>
                    <option value="uploaded_image">Uploaded Standee QR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Internal Notes / Reason for Switch
                </label>
                <input
                  type="text"
                  value={switchForm.internalNotes}
                  onChange={(e) => setSwitchForm({ ...switchForm, internalNotes: e.target.value })}
                  placeholder="e.g. Switched to primary business current account"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSwitchModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={switching}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs shadow transition"
                >
                  {switching ? "Switching..." : "Confirm & Activate Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Snapshot Inspection Modal */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Payment Submission Snapshot
                </h3>
                <p className="text-xs text-slate-500">Order: {inspectRecord.orderReference}</p>
              </div>
              <button
                onClick={() => setInspectRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatINR(inspectRecord.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction ID (UTR):</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {inspectRecord.transactionId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Intended Receiving UPI ID:</span>
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                    {inspectRecord.receivingUpiId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Receiving Account Name:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {inspectRecord.receivingAccountName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Submitted At:</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {new Date(inspectRecord.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {inspectRecord.verifiedByAdminName && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 space-y-1 text-emerald-900 dark:text-emerald-200">
                  <div className="font-bold">Verified By: {inspectRecord.verifiedByAdminName}</div>
                  {inspectRecord.verifiedAt && (
                    <div>At: {new Date(inspectRecord.verifiedAt).toLocaleString()}</div>
                  )}
                  {inspectRecord.verificationNote && (
                    <div className="text-[11px] italic">Note: {inspectRecord.verificationNote}</div>
                  )}
                </div>
              )}

              {inspectRecord.rejectionReason && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 space-y-1 text-rose-900 dark:text-rose-200">
                  <div className="font-bold">Rejection Reason: {inspectRecord.rejectionReason}</div>
                  {inspectRecord.rejectionNote && (
                    <div className="text-[11px] italic">Note: {inspectRecord.rejectionNote}</div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
