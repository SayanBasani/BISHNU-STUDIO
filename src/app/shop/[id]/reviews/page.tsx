"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatINR, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Star,
  ShieldCheck,
  Loader2,
  Package,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

export default function ProductAllReviewsPage() {
  const params = useParams();
  const productId = params?.id as string;

  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    averageRating: 0,
    totalReviews: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalReviews: 0,
    totalPages: 1,
  });
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productId) {
      loadProduct();
      loadReviews(1, sort);
    }
  }, [productId, sort]);

  const loadProduct = async () => {
    try {
      const res = await fetch(`/api/products/${productId}`);
      const data = await res.json();
      if (data.success) {
        setProduct(data.product);
      }
    } catch (err) {
      console.error("Failed to load product details:", err);
    }
  };

  const loadReviews = async (pageNumber: number, sortOrder: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/products/${productId}/reviews?page=${pageNumber}&limit=10&sort=${sortOrder}`
      );
      const data = await res.json();
      if (data.success) {
        setReviews(data.reviews || []);
        if (data.summary) {
          setSummary(data.summary);
        }
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else {
        setError(data.error || "Failed to load reviews.");
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred fetching reviews.");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadReviews(newPage, sort);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-10 transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Link href="/shop" className="hover:text-blue-600 dark:hover:text-blue-400">
            Shop
          </Link>
          <span>/</span>
          <Link
            href={`/shop/${productId}`}
            className="hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-xs"
          >
            {product?.name || "Product"}
          </Link>
          <span>/</span>
          <span className="text-slate-900 dark:text-white font-medium">Customer Reviews</span>
        </div>

        {/* Product Quick Header Card */}
        {product && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                <img
                  src={
                    product.images?.[0]?.imageUrl ||
                    "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=600&q=80"
                  }
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono font-semibold text-slate-400">
                  SKU: {product.sku}
                </span>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white line-clamp-1">
                  {product.name}
                </h1>
                <p className="text-sm font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                  {formatINR(product.discountedPrice || product.price)}
                </p>
              </div>
            </div>

            <Link
              href={`/shop/${productId}`}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Product
            </Link>
          </div>
        )}

        {/* Ratings Breakdown & Verified Purchase Policy */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Summary Score */}
          <div className="md:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              Customer Ratings Overview
            </h2>

            <div className="flex items-center gap-4">
              <div className="text-4xl font-extrabold text-slate-900 dark:text-white font-mono">
                {summary.averageRating > 0 ? summary.averageRating.toFixed(1) : "0.0"}
              </div>
              <div className="space-y-1">
                <div className="flex items-center text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= Math.round(summary.averageRating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-200 dark:text-slate-800"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Based on {summary.totalReviews} {summary.totalReviews === 1 ? "review" : "published reviews"}
                </p>
              </div>
            </div>

            {/* Distribution Bars */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              {[5, 4, 3, 2, 1].map((starNum) => {
                const count = summary.distribution[starNum] || 0;
                const percent =
                  summary.totalReviews > 0
                    ? Math.round((count / summary.totalReviews) * 100)
                    : 0;

                return (
                  <div key={starNum} className="flex items-center gap-2">
                    <span className="w-6 text-slate-600 dark:text-slate-400 font-medium">
                      {starNum} ★
                    </span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono text-slate-400 text-[11px]">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Verification Policy */}
          <div className="md:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3 shadow-sm flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Verified Purchase Assurance
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Reviews on Bishnu Studio are collected strictly from customers who have purchased and successfully received this item. Ratings are tied directly to order completion records, protecting our community from synthetic or unverified reviews.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Want to review an order you received?
              </span>
              <Link
                href="/account/orders"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition shadow-sm"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Review in My Orders
              </Link>
            </div>
          </div>
        </div>

        {/* Reviews List with Sort Controls */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              All Published Reviews ({pagination.totalReviews})
            </h2>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <label htmlFor="sort" className="font-medium text-slate-600 dark:text-slate-400">
                Sort by:
              </label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Most Recent</option>
                <option value="highest">Highest Rating</option>
                <option value="lowest">Lowest Rating</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading customer reviews...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          ) : reviews.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Reviews Found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                No customer reviews have been published for this product yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {rev.customerAvatar ? (
                        <img
                          src={rev.customerAvatar}
                          alt={rev.customerName}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs uppercase">
                          {rev.customerName?.charAt(0)}
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white text-xs block">
                          {rev.customerName}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDate(rev.createdAt)}
                        </span>
                      </div>
                    </div>

                    {rev.isVerifiedPurchase && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Verified Purchase
                      </span>
                    )}
                  </div>

                  {/* Stars */}
                  <div className="flex items-center text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= rev.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-200 dark:text-slate-800"
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      {rev.rating}.0
                    </span>
                  </div>

                  {/* Title & Body */}
                  {rev.reviewTitle && (
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      {rev.reviewTitle}
                    </h3>
                  )}

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {rev.reviewText}
                  </p>
                </div>
              ))}

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="pt-4 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>

                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>

                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition flex items-center gap-1"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
