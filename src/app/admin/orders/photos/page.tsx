"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatINR, formatDate } from "@/lib/utils";
import {
  Image as ImageIcon,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Printer,
  Sparkles,
} from "lucide-react";

export default function PhotoStudioQueuePage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [finishFilter, setFinishFilter] = useState("all");

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/queues?type=photo_print");
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load photo queue:", err);
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
    const sizeMatch = sizeFilter === "all" || config.photoSize === sizeFilter;
    const finishMatch = finishFilter === "all" || config.paperFinish === finishFilter;

    return refMatch && sizeMatch && finishMatch;
  });

  const totalPhotoPrints = items.reduce((sum, item) => {
    const fileCount = item.files?.length || 1;
    const copies = item.quantity || 1;
    return sum + fileCount * copies;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
            <ImageIcon className="w-4 h-4" /> Dedicated Service Queue
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Photo Studio Printing Queue
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Photographic print orders, passport photos, glossy/matte finishes, and high-resolution master downloads
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-300 text-xs font-bold">
            Total Photo Prints: <span className="text-rose-600 dark:text-rose-400 font-mono">{totalPhotoPrints}</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 text-xs font-bold">
            Active Jobs: <span className="text-purple-600 dark:text-purple-400 font-mono">{items.length}</span>
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
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
          />
        </div>

        <select
          value={sizeFilter}
          onChange={(e) => setSizeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <option value="all">All Photo Sizes</option>
          <option value="passport">Passport (8 copies set)</option>
          <option value="4x6">4&quot; &times; 6&quot; Postcard</option>
          <option value="5x7">5&quot; &times; 7&quot; Medium</option>
          <option value="8x10">8&quot; &times; 10&quot; Portrait</option>
          <option value="12x18">12&quot; &times; 18&quot; Poster</option>
        </select>

        <select
          value={finishFilter}
          onChange={(e) => setFinishFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <option value="all">All Paper Finishes</option>
          <option value="glossy">Glossy Luster</option>
          <option value="matte">Matte Smooth</option>
        </select>
      </div>

      {/* Queue Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-600" />
          <p className="text-xs mt-2">Loading photo queue...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-16 text-center text-slate-400 space-y-2">
          <ImageIcon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No photo studio orders found</p>
          <p className="text-xs text-slate-400">No matching orders currently in this queue.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredItems.map((item) => {
            const config = item.configuration || {};
            const files = item.files || [];
            const copiesPerPhoto = item.quantity || 1;
            const totalExactPrints = (files.length || 1) * copiesPerPhoto;

            return (
              <div
                key={item.itemId}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 hover:border-purple-300 dark:hover:border-purple-800 transition"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/orders/${item.orderId}`}
                        className="font-mono font-bold text-rose-600 dark:text-rose-400 hover:underline text-sm flex items-center gap-1"
                      >
                        {item.orderReference}
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </Link>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                        {config.photoSize || "Photo Print"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {config.paperFinish || "Glossy"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Customer: <strong className="text-slate-800 dark:text-slate-200">{item.customerName}</strong> &bull;{" "}
                      <span className="font-mono">{item.customerPhone}</span>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {formatINR(item.totalPriceSnapshot)}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Print Calculation Badge */}
                <div className="p-3 bg-purple-50/60 dark:bg-purple-950/40 rounded-xl border border-purple-200/60 dark:border-purple-900/60 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block">
                      Exact Production Calculation
                    </span>
                    <p className="font-mono text-purple-900 dark:text-purple-200 font-bold">
                      {files.length} uploaded photo(s) &times; {copiesPerPhoto} copies each
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300 block">Total Prints</span>
                    <span className="font-mono font-extrabold text-base text-purple-900 dark:text-purple-200">
                      = {totalExactPrints} prints
                    </span>
                  </div>
                </div>

                {/* Photo Previews & Downloads */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Uploaded Photographs ({files.length})
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {files.map((f: any, idx: number) => (
                      <div
                        key={f.id}
                        className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 overflow-hidden flex flex-col justify-between"
                      >
                        <div className="p-2 text-center">
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block truncate">
                            #{idx + 1}: {f.originalFilename}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {(f.fileSize / 1024).toFixed(0)} KB
                          </span>
                        </div>
                        <a
                          href={f.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-1.5 px-2 bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-bold text-center flex items-center justify-center gap-1 hover:bg-rose-600 transition"
                        >
                          <Download className="w-3 h-3" /> Master File
                        </a>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer Instructions */}
                {item.specialInstructions && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <strong>Instructions:</strong> {item.specialInstructions}
                  </p>
                )}

                {/* Quick Status Bar */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Status:</span>
                    <select
                      value={item.orderStatus}
                      onChange={(e) => handleQuickStatusChange(item.orderId, e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Printing In Progress</option>
                      <option value="ready_for_collection">Ready for Pickup</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <Link
                    href={`/admin/orders/${item.orderId}`}
                    className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    Manage Full Order &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
