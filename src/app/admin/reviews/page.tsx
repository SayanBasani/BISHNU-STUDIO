"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import {
  MessageSquare,
  Search,
  Star,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Filter,
} from "lucide-react";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "hidden">("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/reviews");
      const data = await res.json();
      if (data.success) {
        setReviews(data.reviews);
      }
    } catch (e) {
      console.error("Failed to load reviews:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleToggleStatus = async (review: any) => {
    const isCurrentlyPublished = review.status === "published";
    const nextAction = isCurrentlyPublished ? "hide" : "publish";

    setActionLoadingId(review.id);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: nextAction,
          reason: isCurrentlyPublished ? "Hidden by administrator review" : "Re-published by administrator",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update review status");

      setMessage({ text: data.message });
      await fetchReviews();
    } catch (err: any) {
      setMessage({ text: err?.message || "Operation failed", isError: true });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filtered = reviews.filter((r) => {
    const matchesSearch =
      !search ||
      r.product?.name.toLowerCase().includes(search.toLowerCase()) ||
      r.user?.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.reviewText.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-purple-600" />
            Customer Ratings & Reviews Moderation
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor product reviews, verify purchase statuses, and hide abusive or fraudulent comments.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            message.isError
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
              : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {message.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search by product, customer or review text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(["all", "published", "hidden"] as const).map((filter) => (
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

      {/* Reviews Table */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <MessageSquare className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No reviews found</p>
          <p className="text-xs text-slate-400 mt-1">No customer reviews match your search filter.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Rating</th>
                  <th className="py-3 px-4">Review Content</th>
                  <th className="py-3 px-4">Verified</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filtered.map((rev) => {
                  const isHidden = rev.status === "hidden";
                  const isLoading = actionLoadingId === rev.id;

                  return (
                    <tr key={rev.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white max-w-xs">
                        <Link
                          href={`/shop/${rev.productId}`}
                          target="_blank"
                          className="hover:text-purple-600 dark:hover:text-purple-400 hover:underline flex items-center gap-1"
                        >
                          <span className="truncate">{rev.product?.name}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                        </Link>
                        <span className="text-[10px] font-mono text-slate-400 block">
                          SKU: {rev.product?.sku}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {rev.user?.fullName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">{rev.user?.email}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center text-amber-400">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${
                                star <= rev.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-200 dark:text-slate-700"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatDate(rev.createdAt)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 max-w-sm">
                        {rev.reviewTitle && (
                          <strong className="block text-slate-900 dark:text-white mb-0.5">
                            {rev.reviewTitle}
                          </strong>
                        )}
                        <p className="line-clamp-2 text-slate-600 dark:text-slate-300">{rev.reviewText}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        {rev.isVerifiedPurchase ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            <ShieldCheck className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Standard</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isHidden
                              ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                              : "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                          }`}
                        >
                          {rev.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleToggleStatus(rev)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto transition ${
                            isHidden
                              ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                              : "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100"
                          }`}
                        >
                          {isLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isHidden ? (
                            <>
                              <Eye className="w-3.5 h-3.5" /> Publish
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" /> Hide
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
