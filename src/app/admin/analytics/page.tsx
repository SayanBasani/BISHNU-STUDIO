"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/utils";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  CreditCard,
  FileText,
  Image as ImageIcon,
  Layers,
  ShoppingBag,
  Store,
  Truck,
  Loader2,
} from "lucide-react";

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData(json.analytics);
        }
      })
      .catch((err) => console.error("Analytics load failed:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
        <p className="text-xs text-slate-400 mt-2">Computing analytics &amp; financial aggregates...</p>
      </div>
    );
  }

  const {
    totalOrders = 0,
    totalRevenue = 0,
    pendingRevenue = 0,
    totalCustomers = 0,
    serviceRevenue = {},
    ordersByStatus = {},
    deliveryBreakdown = {},
    topProducts = [],
  } = data || {};

  const totalServiceSum =
    (serviceRevenue.product?.total || 0) +
    (serviceRevenue.pvc_card?.total || 0) +
    (serviceRevenue.document_print?.total || 0) +
    (serviceRevenue.photo_print?.total || 0) +
    (serviceRevenue.lamination?.total || 0);

  const getPercent = (amount: number) => {
    if (totalServiceSum === 0) return 0;
    return Math.round((amount / totalServiceSum) * 100);
  };

  const serviceCategories = [
    {
      key: "product",
      label: "Stationery & Supplies",
      icon: ShoppingBag,
      color: "bg-blue-600",
      textColor: "text-blue-600",
      total: serviceRevenue.product?.total || 0,
      count: serviceRevenue.product?.count || 0,
    },
    {
      key: "pvc_card",
      label: "PVC Card Printing",
      icon: CreditCard,
      color: "bg-purple-600",
      textColor: "text-purple-600",
      total: serviceRevenue.pvc_card?.total || 0,
      count: serviceRevenue.pvc_card?.count || 0,
    },
    {
      key: "document_print",
      label: "Document Printing",
      icon: FileText,
      color: "bg-indigo-600",
      textColor: "text-indigo-600",
      total: serviceRevenue.document_print?.total || 0,
      count: serviceRevenue.document_print?.count || 0,
    },
    {
      key: "photo_print",
      label: "Photo Studio",
      icon: ImageIcon,
      color: "bg-rose-600",
      textColor: "text-rose-600",
      total: serviceRevenue.photo_print?.total || 0,
      count: serviceRevenue.photo_print?.count || 0,
    },
    {
      key: "lamination",
      label: "Lamination Services",
      icon: Layers,
      color: "bg-emerald-600",
      textColor: "text-emerald-600",
      total: serviceRevenue.lamination?.total || 0,
      count: serviceRevenue.lamination?.count || 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-purple-600" />
          Analytics &amp; Performance Reports
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Comprehensive business breakdown across retail merchandise, PVC cards, printing, and photo studio
        </p>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Settled Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
            {formatINR(totalRevenue)}
          </p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Fully verified &amp; settled</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Pending Collection</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            {formatINR(pendingRevenue)}
          </p>
          <p className="text-[11px] text-slate-400">Cash on pickup / delivery</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Total Orders Placed</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
            {totalOrders}
          </p>
          <p className="text-[11px] text-slate-400">Across all service channels</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Customer Accounts</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
            {totalCustomers}
          </p>
          <p className="text-[11px] text-slate-400">Registered client accounts</p>
        </div>
      </div>

      {/* Service Revenue Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <span>Revenue Share by Service Channel</span>
            <span className="font-mono text-xs text-slate-400 font-normal">
              Total: {formatINR(totalServiceSum)}
            </span>
          </h2>

          {/* Segmented Bar */}
          <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 flex overflow-hidden">
            {serviceCategories.map((cat) => {
              const pct = getPercent(cat.total);
              if (pct === 0) return null;
              return (
                <div
                  key={cat.key}
                  style={{ width: `${pct}%` }}
                  className={`${cat.color} h-full transition-all`}
                  title={`${cat.label}: ${pct}%`}
                />
              );
            })}
          </div>

          {/* Breakdown Rows */}
          <div className="space-y-3 pt-2">
            {serviceCategories.map((cat) => {
              const Icon = cat.icon;
              const pct = getPercent(cat.total);

              return (
                <div
                  key={cat.key}
                  className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${cat.color}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{cat.label}</p>
                      <p className="text-[11px] text-slate-400">
                        Units / items fulfilled: {cat.count}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {formatINR(cat.total)}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {pct}% of revenue
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fulfillment & Status Distribution */}
        <div className="lg:col-span-4 space-y-6">
          {/* Fulfillment Channel */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
              Fulfillment Mode Breakdown
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800">
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Store className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Counter Pickup
                </span>
                <span className="font-mono font-extrabold text-purple-900 dark:text-purple-300 text-sm">
                  {deliveryBreakdown.store_pickup || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800">
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Home Delivery
                </span>
                <span className="font-mono font-extrabold text-blue-900 dark:text-blue-300 text-sm">
                  {deliveryBreakdown.home_delivery || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Orders by Status */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
              Orders Status Distribution
            </h3>

            <div className="space-y-2 text-xs">
              {Object.entries(ordersByStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-slate-800">
                  <span className="capitalize text-slate-600 dark:text-slate-300 font-medium">
                    {status.replace(/_/g, " ")}
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                    {count as number}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Selling Products */}
      {topProducts.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-purple-600" />
            Top Selling Shop Products
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3 text-center">Units Sold</th>
                  <th className="py-2.5 px-3 text-right">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {topProducts.map((p: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{p.name}</td>
                    <td className="py-3 px-3 text-center font-mono font-extrabold text-slate-800 dark:text-slate-200">
                      {p.quantity} units
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-purple-600 dark:text-purple-400">
                      {formatINR(p.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
