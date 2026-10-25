"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatINR, formatDate } from "@/lib/utils";
import {
  RotateCcw,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Truck,
  DollarSign,
  Package,
  ExternalLink,
} from "lucide-react";

export default function AdminReturnsPage() {
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1, limit: 20 });

  useEffect(() => {
    fetchReturns(page);
  }, [page, statusFilter]);

  const fetchReturns = async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", targetPage.toString());
      params.set("limit", "20");
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/returns?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setReturnsList(data.returns || []);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (err) {
      console.error("Failed to load returns:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
      case "pickup_scheduled":
      case "in_transit":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "refund_processed":
      case "completed":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "rejected":
      case "cancelled":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      case "received":
      case "inspection_in_progress":
      case "refund_pending":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      default:
        return "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <RotateCcw className="w-6 h-6 text-purple-600" />
            Return &amp; Refund Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review customer returns, schedule courier pickups, record quality inspections, and disburse verified refunds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/returns"
            target="_blank"
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 transition flex items-center gap-1.5"
          >
            <span>View Public Return Policy</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-purple-600" /> Filter Status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
          >
            <option value="all">All Return Stages ({pagination.total})</option>
            <option value="requested">Requested (New)</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved for Pickup</option>
            <option value="pickup_scheduled">Pickup Scheduled</option>
            <option value="in_transit">In Transit to Studio</option>
            <option value="received">Received at Studio</option>
            <option value="inspection_in_progress">Inspection in Progress</option>
            <option value="refund_pending">Refund Pending</option>
            <option value="refund_processed">Refund Processed</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <span className="text-xs text-slate-400 font-mono">
          Page {page} of {pagination.totalPages} ({pagination.total} total)
        </span>
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            <span>Loading return requests...</span>
          </div>
        ) : returnsList.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-400 space-y-2">
            <RotateCcw className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              No return requests match the selected criteria.
            </p>
            <p>Customer return requests will appear here once submitted.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4">Return Reference</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Resolution</th>
                  <th className="py-3 px-4">Est. Refund</th>
                  <th className="py-3 px-4">Logistics Partner</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {returnsList.map((ret) => (
                  <tr
                    key={ret.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {ret.returnReference}
                    </td>
                    <td className="py-3.5 px-4 capitalize text-slate-700 dark:text-slate-300">
                      {ret.reason?.replace(/_/g, " ")}
                    </td>
                    <td className="py-3.5 px-4 capitalize font-semibold text-purple-600 dark:text-purple-400">
                      {ret.requestedResolution}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {ret.refundAmount ? formatINR(ret.refundAmount) : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {ret.courierName ? (
                        <span>
                          {ret.courierName}
                          {ret.trackingNumber && (
                            <span className="font-mono text-[11px] block text-slate-400">
                              #{ret.trackingNumber}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not assigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(
                          ret.status
                        )}`}
                      >
                        {ret.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {formatDate(ret.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/admin/returns/${ret.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 font-bold transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="font-mono text-slate-500">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
