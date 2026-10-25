"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatINR, formatDate } from "@/lib/utils";
import {
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  ArrowRight,
  Shield,
  Loader2,
  History,
} from "lucide-react";

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/metrics")
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success) {
          setData(resData);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
      </div>
    );
  }

  const metrics = data?.metrics || {};

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Shop Performance Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time shop statistics, queue status, and inventory alerts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/orders"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl shadow-sm transition"
          >
            Manage Orders
          </Link>
          <Link
            href="/admin/pricing"
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition"
          >
            Modify Rates
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Revenue */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Collected Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {formatINR(metrics.totalRevenue || 0)}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Pending Collection: {formatINR(metrics.pendingRevenue || 0)}
          </p>
        </div>

        {/* Pending Orders */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>New Pending Orders</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {metrics.pendingOrders || 0}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Needs review & print start</p>
        </div>

        {/* Processing in Print Room */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Currently Processing</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
            {metrics.processingOrders || 0}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Printing / Lamination in progress</p>
        </div>

        {/* Ready for Pickup */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Ready for Counter Pickup</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
            {metrics.readyOrders || 0}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Awaiting customer collection</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Orders Table */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Recent Store Orders</h3>
            <Link
              href="/admin/orders"
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="pb-3">Reference</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Payment</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(!data?.recentOrders || data.recentOrders.length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-medium text-xs">No store orders placed yet</p>
                    </td>
                  </tr>
                )}
                {data?.recentOrders?.map((ord: any) => (
                  <tr key={ord.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 font-mono font-bold text-slate-900 dark:text-white">
                      {ord.orderReference}
                    </td>
                    <td className="py-3 capitalize text-slate-600 dark:text-slate-300">
                      {ord.orderType.replace(/_/g, " ")}
                    </td>
                    <td className="py-3 font-bold text-slate-900 dark:text-white">
                      {formatINR(ord.totalAmount)}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                        {ord.orderStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`font-semibold capitalize ${
                          ord.paymentStatus === "paid"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {ord.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/admin/orders/${ord.id}`}
                        className="text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alerts & Audit Log Snippet */}
        <div className="lg:col-span-4 space-y-6">
          {/* Low Stock Alert */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Low Stock Warnings
            </h3>

            {data?.lowStockProducts?.length === 0 ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                All products currently have healthy inventory levels.
              </p>
            ) : (
              <div className="space-y-2 text-xs">
                {data?.lowStockProducts?.map((prod: any) => (
                  <div
                    key={prod.id}
                    className="flex justify-between items-center p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/60"
                  >
                    <div className="truncate pr-2">
                      <p className="font-bold text-slate-900 dark:text-white truncate">
                        {prod.name}
                      </p>
                      <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        SKU: {prod.sku}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded font-extrabold text-amber-900 dark:text-amber-200 bg-amber-200/80 dark:bg-amber-900/80 shrink-0">
                      {prod.stockQuantity} Left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Audit Log */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              Security Audit Activity
            </h3>

            <div className="space-y-2 text-xs">
              {data?.recentLogs?.slice(0, 5).map((log: any) => (
                <div
                  key={log.id}
                  className="p-2 border-b border-slate-100 dark:border-slate-800 last:border-0 space-y-0.5"
                >
                  <p className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                    {log.action.replace(/_/g, " ")}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {formatDate(log.createdAt)} • Type: {log.entityType}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
