"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatINR, formatDate } from "@/lib/utils";
import {
  CreditCard,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Printer,
  FileCheck,
  AlertCircle,
  Eye,
} from "lucide-react";

export default function PvcQueuePage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [docFilter, setDocFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/queues?type=pvc_card");
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load PVC queue:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderStatus: newStatus }),
      });
      if (res.ok) {
        await fetchQueue();
      }
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const filteredItems = items.filter((item) => {
    const refMatch =
      item.orderReference?.toLowerCase().includes(search.toLowerCase()) ||
      item.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      item.customerPhone?.includes(search);

    const config = item.configuration || {};
    const docType = (config.documentType || "").toLowerCase();
    const docMatch = docFilter === "all" || docType === docFilter.toLowerCase();
    const statusMatch = statusFilter === "all" || item.orderStatus === statusFilter;

    return refMatch && docMatch && statusMatch;
  });

  const totalCards = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
  const pendingCount = items.filter((i) => i.orderStatus === "pending" || i.orderStatus === "processing").length;

  return (
    <div className="space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">
            <CreditCard className="w-4 h-4" /> Dedicated Service Queue
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            PVC Card Printing Queue
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage identity card print runs (Aadhaar, PAN, Driving Licence, Voter ID, Ration Card)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 text-xs font-bold">
            Total Cards: <span className="text-purple-600 dark:text-purple-400 font-mono">{totalCards}</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs font-bold">
            Pending Runs: <span className="text-amber-600 dark:text-amber-400 font-mono">{pendingCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Order reference, customer name, phone..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </div>

        <select
          value={docFilter}
          onChange={(e) => setDocFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Document Types</option>
          <option value="aadhaar">Aadhaar Card</option>
          <option value="pan">PAN Card</option>
          <option value="driving_licence">Driving Licence</option>
          <option value="voter_id">Voter ID</option>
          <option value="ration_card">Ration Card</option>
          <option value="other">Other Documents</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="ready_for_collection">Ready for Collection</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Queue Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600" />
            <p className="text-xs mt-2">Loading PVC queue...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <CreditCard className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No PVC card orders found</p>
            <p className="text-xs text-slate-400">No matching orders currently in this queue.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Order Ref</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Document Type</th>
                  <th className="py-3.5 px-4">Copies</th>
                  <th className="py-3.5 px-4">Uploaded File</th>
                  <th className="py-3.5 px-4">Instructions</th>
                  <th className="py-3.5 px-4">Print Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredItems.map((item) => {
                  const config = item.configuration || {};
                  const file = item.files?.[0];

                  return (
                    <tr key={item.itemId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/admin/orders/${item.orderId}`}
                          className="font-mono font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                        >
                          {item.orderReference}
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </Link>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {formatDate(item.createdAt)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900 dark:text-white">{item.customerName}</p>
                        <p className="text-[11px] font-mono text-slate-400">{item.customerPhone}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                          {config.documentType || "PVC Card"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                        {item.quantity} {item.quantity === 1 ? "card" : "cards"}
                      </td>

                      <td className="py-3.5 px-4">
                        {file ? (
                          <a
                            href={file.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-xs transition border border-purple-200 dark:border-purple-800"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download {file.mimeType?.includes("pdf") ? "PDF" : "Image"}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">No file attached</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-slate-600 dark:text-slate-300 truncate" title={item.specialInstructions || "None"}>
                          {item.specialInstructions || "—"}
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        <select
                          value={item.orderStatus}
                          onChange={(e) => handleQuickStatusChange(item.orderId, e.target.value)}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Printing In Progress</option>
                          <option value="ready_for_collection">Ready for Pickup</option>
                          <option value="out_for_delivery">Out for Delivery</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/admin/orders/${item.orderId}`}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold inline-block transition"
                        >
                          Full Order
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
