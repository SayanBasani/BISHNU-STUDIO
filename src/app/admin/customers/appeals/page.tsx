"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  User,
  Mail,
  Phone,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export default function AdminAppealsPage() {
  const [appeals, setAppeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppeal, setSelectedAppeal] = useState<any | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const fetchAppeals = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/appeals");
      const data = await res.json();
      if (data.success) {
        setAppeals(data.appeals);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppeals();
  }, []);

  const handleDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppeal || !actionType) return;

    setActionLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/admin/appeals/${selectedAppeal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process appeal");
      }

      setStatusMessage({ text: data.message });
      setSelectedAppeal(null);
      setActionType(null);
      setNotes("");
      await fetchAppeals();
    } catch (err: any) {
      setStatusMessage({ text: err?.message || "An error occurred", isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  const pendingAppeals = appeals.filter((a) => a.status === "submitted" || a.status === "under_review");
  const pastAppeals = appeals.filter((a) => a.status !== "submitted" && a.status !== "under_review");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <Link
            href="/admin/customers"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Customers Directory
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-500" />
            Customer Account Appeals Queue
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Review customer restriction reconsideration requests, examine explanations, and approve or reject reinstatements.
          </p>
        </div>
        <button
          onClick={fetchAppeals}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Queue
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            statusMessage.isError
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
              : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {statusMessage.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Pending Appeals */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          Pending Reconsiderations ({pendingAppeals.length})
        </h2>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
          </div>
        ) : pendingAppeals.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No pending appeals</p>
            <p className="text-xs text-slate-400 mt-1">All customer reconsideration requests have been reviewed.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pendingAppeals.map((appeal) => (
              <div
                key={appeal.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300">
                      {appeal.user?.fullName?.charAt(0) || "U"}
                    </div>
                    <div>
                      <Link
                        href={`/admin/customers/${appeal.userId}`}
                        className="font-bold text-slate-900 dark:text-white hover:text-purple-600 text-sm hover:underline"
                      >
                        {appeal.user?.fullName || "Customer"}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{appeal.contactEmail}</span>
                        <span>•</span>
                        <span>+91 {appeal.contactPhone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                      Submitted {formatDate(appeal.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block text-[10px]">
                      Block Reason & Category
                    </span>
                    <p className="mt-1 font-medium text-slate-800 dark:text-slate-200">
                      {appeal.user?.blockedReason || "N/A"}
                    </p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                      {appeal.user?.blockedCategory || "policy violation"}
                    </span>
                  </div>

                  <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block text-[10px]">
                      Customer Appeal Explanation
                    </span>
                    <p className="mt-1 text-slate-800 dark:text-slate-200 italic font-serif text-sm">
                      &ldquo;{appeal.message}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setSelectedAppeal(appeal);
                      setActionType("reject");
                      setNotes("");
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition"
                  >
                    Reject Appeal
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAppeal(appeal);
                      setActionType("approve");
                      setNotes("Reinstated upon manual review");
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve & Unblock Customer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Appeals History */}
      {pastAppeals.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Past Appeal Decisions</h2>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Appeal Reason</th>
                  <th className="py-3 px-4">Decision</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Resolved On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {pastAppeals.map((appeal) => (
                  <tr key={appeal.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {appeal.user?.fullName || "Customer"}
                    </td>
                    <td className="py-3 px-4">
                      {appeal.contactEmail}
                      <p className="text-[10px] text-slate-400">+91 {appeal.contactPhone}</p>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate">{appeal.message}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          appeal.status === "approved"
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                            : "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                        }`}
                      >
                        {appeal.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{appeal.adminResponseNote || "—"}</td>
                    <td className="py-3 px-4 text-right font-mono text-[11px]">
                      {appeal.reviewedAt ? formatDate(appeal.reviewedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {selectedAppeal && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  actionType === "approve"
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
                }`}
              >
                {actionType === "approve" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {actionType === "approve" ? "Approve Appeal & Unblock Customer" : "Reject Appeal"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Customer: {selectedAppeal.user?.fullName} ({selectedAppeal.contactEmail})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {actionType === "approve"
                ? "Approving this appeal will immediately reactivate the customer's Bishnu Studio account and allow them to sign in and order again."
                : "Rejecting this appeal leaves the customer account restricted. The customer will not be able to log in."}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Administrator Review Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or feedback regarding this decision..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  setSelectedAppeal(null);
                  setActionType(null);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDecision}
                className={`px-4 py-2 text-xs font-bold rounded-xl text-white flex items-center gap-1.5 transition ${
                  actionType === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {actionType === "approve" ? "Confirm & Re-activate Account" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
