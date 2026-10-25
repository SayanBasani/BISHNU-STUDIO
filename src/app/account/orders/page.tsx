"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDate } from "@/lib/utils";
import {
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";

export default function CustomerOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetch("/api/orders")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setOrders(data.orders);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="max-w-md w-full text-center space-y-4 bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Package className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Customer Sign In Required</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Please sign in to view your order history and track live print jobs.</p>
          <Link
            href="/login"
            className="inline-block w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm"
          >
            Sign In to Account
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            Pending
          </span>
        );
      case "confirmed":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
            Confirmed
          </span>
        );
      case "processing":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 animate-pulse">
            In Print Room
          </span>
        );
      case "ready_for_collection":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            Ready for Pickup
          </span>
        );
      case "out_for_delivery":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            Out for Delivery
          </span>
        );
      case "completed":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            Completed
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-10 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Page Header */}
        <div className="space-y-1.5 border-b border-slate-200 dark:border-slate-800/80 pb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            My Orders &amp; Tracking
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Track active studio printing jobs, review past purchases, verify payments, and check delivery status.
          </p>
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Loading your orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8 space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
              <Package className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Orders Placed Yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              You haven&apos;t placed any printing orders or stationery purchases yet. Start by browsing our services or shop catalogue.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link
                href="/services/pvc-card"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm"
              >
                Order PVC Card
              </Link>
              <Link
                href="/services/document-printing"
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition shadow-sm"
              >
                Print Documents
              </Link>
              <Link
                href="/shop"
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Browse Shop
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                      {order.orderReference}
                    </span>
                    {getStatusBadge(order.orderStatus)}
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 capitalize px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      {order.orderType?.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 dark:text-slate-400">
                    <span>Placed: {formatDate(order.createdAt)}</span>
                    <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                    <span>
                      Payment:{" "}
                      <strong
                        className={`capitalize font-semibold ${
                          order.paymentStatus === "paid"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : order.paymentStatus === "rejected"
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {order.paymentStatus?.replace(/_/g, " ")}
                      </strong>
                    </span>
                    <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                    <span>
                      Fulfillment:{" "}
                      <strong className="capitalize text-slate-700 dark:text-slate-300 font-semibold">
                        {order.deliveryType?.replace(/_/g, " ")}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                  <div className="text-left md:text-right">
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Total Amount</p>
                    <p className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                      {formatINR(order.totalAmount)}
                    </p>
                  </div>

                  <Link
                    href={`/account/orders/${order.id}`}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white dark:bg-slate-800 dark:hover:bg-blue-600 font-semibold text-xs flex items-center gap-1.5 transition shadow-sm"
                  >
                    Track Order <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
