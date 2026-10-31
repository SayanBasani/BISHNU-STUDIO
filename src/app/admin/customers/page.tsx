"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatINR, formatDate } from "@/lib/utils";
import UserAvatar from "@/components/ui/UserAvatar";
import {
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Ban,
  UserCheck,
  X,
} from "lucide-react";

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked">("all");

  // Block Modal state
  const [blockingCustomer, setBlockingCustomer] = useState<any | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [blockCategory, setBlockCategory] = useState<"spam" | "abusive" | "fraud" | "misuse" | "other">("other");
  const [blockLoading, setBlockLoading] = useState(false);

  // Unblock Modal state
  const [unblockingCustomer, setUnblockingCustomer] = useState<any | null>(null);
  const [unblockLoading, setUnblockLoading] = useState(false);

  // Notification message
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/customers");
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockingCustomer) return;

    if (blockReason.trim().length < 3) {
      setMessage({ text: "Please enter a valid reason (at least 3 characters)", isError: true });
      return;
    }

    setBlockLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/customers/${blockingCustomer.id}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: blockReason,
          category: blockCategory,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to block customer");
      }

      setMessage({ text: "Customer account restricted and all active sessions terminated." });
      setBlockingCustomer(null);
      setBlockReason("");
      setBlockCategory("other");
      await fetchCustomers();
    } catch (err: any) {
      setMessage({ text: err?.message || "Failed to block customer", isError: true });
    } finally {
      setBlockLoading(false);
    }
  };

  const handleUnblockSubmit = async () => {
    if (!unblockingCustomer) return;

    setUnblockLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/customers/${unblockingCustomer.id}/unblock`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to unblock customer");
      }

      setMessage({ text: "Customer account restored to active status successfully." });
      setUnblockingCustomer(null);
      await fetchCustomers();
    } catch (err: any) {
      setMessage({ text: err?.message || "Failed to unblock customer", isError: true });
    } finally {
      setUnblockLoading(false);
    }
  };

  const pendingAppealsCount = customers.filter((c) => c.hasPendingAppeal).length;

  const filtered = customers.filter((c) => {
    const matchesSearch =
      !search ||
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && c.status !== "blocked") ||
      (statusFilter === "blocked" && c.status === "blocked");

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Customer Accounts Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage registered accounts, view verification and spend, and control account access permissions.
          </p>
        </div>

        <Link
          href="/admin/customers/appeals"
          className="relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-md shadow-purple-500/20 transition-all self-start sm:self-auto"
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Appeals Queue</span>
          {pendingAppealsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold">
              {pendingAppealsCount}
            </span>
          )}
        </Link>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
            message.isError
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
              : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search customer name, email or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(["all", "active", "blocked"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                statusFilter === filter
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Table */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 mt-2">Loading customer accounts...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No customers found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria or status filter.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-center">Orders / Spend</th>
                  <th className="py-3 px-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filtered.map((cust) => {
                  const isBlocked = cust.status === "blocked";
                  const isAdmin = cust.role === "admin";

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      {/* Name & Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            src={cust.avatarUrl}
                            name={cust.fullName}
                            size="md"
                            className="border-slate-200 dark:border-slate-700"
                          />
                          <div>
                            <Link
                              href={`/admin/customers/${cust.id}`}
                              className="font-bold text-slate-900 dark:text-white hover:text-purple-600 text-sm block"
                            >
                              {cust.fullName}
                            </Link>
                            <span className="text-[10px] text-slate-400 capitalize">
                              {cust.role}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-4">
                        <p className="font-mono text-slate-800 dark:text-slate-200">{cust.email}</p>
                        <p className="text-[11px] text-slate-400">+91 {cust.phone}</p>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isBlocked
                                ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                                : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                            }`}
                          >
                            {isBlocked ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                            {isBlocked ? "Blocked" : "Active"}
                          </span>
                          {cust.hasPendingAppeal && (
                            <Link
                              href="/admin/customers/appeals"
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                            >
                              <ShieldAlert className="w-3 h-3" /> Appeal Pending
                            </Link>
                          )}
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {formatDate(cust.createdAt)}
                      </td>

                      {/* Orders / Spend */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {cust.orderCount}
                        </span>
                        <span className="text-slate-400 mx-1">orders</span>
                        <div className="font-mono text-slate-600 dark:text-slate-300 text-[11px]">
                          {formatINR(cust.totalSpent)}
                        </div>
                      </td>

                      {/* Quick Action */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/customers/${cust.id}`}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                            title="View customer profile"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>

                          {!isAdmin && (
                            <>
                              {isBlocked ? (
                                <button
                                  onClick={() => setUnblockingCustomer(cust)}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition flex items-center gap-1"
                                >
                                  <UserCheck className="w-3 h-3" /> Unblock
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setBlockingCustomer(cust);
                                    setBlockReason("");
                                    setBlockCategory("other");
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition flex items-center gap-1"
                                >
                                  <Ban className="w-3 h-3" /> Block
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {blockingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Block Customer Account</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{blockingCustomer.fullName} ({blockingCustomer.email})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Blocking immediately terminates all active sessions for this customer across all devices. Their order history, financial records, and uploaded files are preserved.
            </p>

            <form onSubmit={handleBlockSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Restriction *
                </label>
                <input
                  type="text"
                  required
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="e.g. Fraudulent payment submission, abusive behavior..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Violation Category
                </label>
                <select
                  value={blockCategory}
                  onChange={(e: any) => setBlockCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="spam">Spam or Automated Abuse</option>
                  <option value="abusive">Abusive Language / Behavior</option>
                  <option value="fraud">Payment Fraud / Fake UTR</option>
                  <option value="misuse">Service Misuse / Bad Uploads</option>
                  <option value="other">Other Terms Violation</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={blockLoading}
                  onClick={() => setBlockingCustomer(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={blockLoading}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition"
                >
                  {blockLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Restriction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unblock Confirmation Modal */}
      {unblockingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Unblock Customer</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{unblockingCustomer.fullName} ({unblockingCustomer.email})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Restoring this customer&apos;s account will allow them to log in, place printing orders, and manage their profile normally. Any pending appeals will be automatically marked as resolved.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={unblockLoading}
                onClick={() => setUnblockingCustomer(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={unblockLoading}
                onClick={handleUnblockSubmit}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition"
              >
                {unblockLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Unblock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
