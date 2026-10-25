"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatINR, formatDate } from "@/lib/utils";
import {
  FileText,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Printer,
  Layers,
  FileCheck,
} from "lucide-react";

export default function DocumentQueuePage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [paperFilter, setPaperFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("all");

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/queues?type=document_print");
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load document queue:", err);
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
    const paperMatch = paperFilter === "all" || config.paperSize === paperFilter;
    const colorMatch = colorFilter === "all" || config.printColor === colorFilter;

    return refMatch && paperMatch && colorMatch;
  });

  const totalPagesSum = items.reduce(
    (sum, i) => sum + (i.pageCount || 1) * (i.quantity || 1),
    0
  );

  return (
    <div className="space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
            <FileText className="w-4 h-4" /> Dedicated Service Queue
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Document Printing Queue
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verified page counts, duplex configurations, paper sizes (A4, Legal, A3), and PDF jobs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-300 text-xs font-bold">
            Total Pages to Print: <span className="text-blue-600 dark:text-blue-400 font-mono">{totalPagesSum}</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 text-xs font-bold">
            Active Print Jobs: <span className="text-purple-600 dark:text-purple-400 font-mono">{items.length}</span>
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
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <select
          value={paperFilter}
          onChange={(e) => setPaperFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Paper Sizes</option>
          <option value="A4">A4 Standard</option>
          <option value="Legal">Legal Size</option>
          <option value="A3">A3 Ledger</option>
        </select>

        <select
          value={colorFilter}
          onChange={(e) => setColorFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Color Modes</option>
          <option value="bw">Black & White (B&W)</option>
          <option value="color">Full Color</option>
        </select>
      </div>

      {/* Queue Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
            <p className="text-xs mt-2">Loading document queue...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <FileText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No document print jobs found</p>
            <p className="text-xs text-slate-400">No matching orders currently in this queue.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Order Ref</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Specs (Paper & Color)</th>
                  <th className="py-3.5 px-4">Sides</th>
                  <th className="py-3.5 px-4">Pages & Copies</th>
                  <th className="py-3.5 px-4">Document File</th>
                  <th className="py-3.5 px-4">Print Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredItems.map((item) => {
                  const config = item.configuration || {};
                  const file = item.files?.[0];
                  const totalPrintPages = (item.pageCount || 1) * (item.quantity || 1);

                  return (
                    <tr key={item.itemId} className="hover:bg-blue-50/20 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/admin/orders/${item.orderId}`}
                          className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                            {config.paperSize || "A4"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              config.printColor === "color"
                                ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            {config.printColor === "color" ? "Color" : "B&W"}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 capitalize font-medium text-slate-700 dark:text-slate-300">
                        {config.printSide === "double" ? "Duplex (2-sided)" : "Single Sided"}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.pageCount || 1} pgs &times; {item.quantity} {item.quantity === 1 ? "set" : "sets"}
                          </span>
                          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold block">
                            = {totalPrintPages} pages total
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {file ? (
                          <a
                            href={file.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs transition border border-blue-200 dark:border-blue-800"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download PDF ({(file.fileSize / 1024).toFixed(1)} KB)</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">No file attached</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <select
                          value={item.orderStatus}
                          onChange={(e) => handleQuickStatusChange(item.orderId, e.target.value)}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
