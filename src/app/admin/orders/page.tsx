"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatINR, formatDate } from "@/lib/utils";
import {
  Package,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  Download,
  AlertTriangle,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Phone,
  User,
  ShoppingBag,
  Truck,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders(page);
  }, [page, statusFilter, paymentFilter, deliveryFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchOrders(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchOrders = async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", targetPage.toString());
      params.set("limit", "20");
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("orderStatus", statusFilter);
      if (paymentFilter !== "all") params.set("paymentStatus", paymentFilter);
      if (deliveryFilter !== "all") params.set("deliveryType", deliveryFilter);

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch (e) {
      console.error("Failed to load orders:", e);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "processing":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
      case "ready_for_collection":
        return "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800";
      case "out_for_delivery":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "completed":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "cancelled":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "pending":
      case "pending_verification":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "unpaid":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-7 h-7 text-purple-600 dark:text-purple-400" />
            Order Management & Fulfillment Hub
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track customer orders, verify payments, prepare print jobs, and dispatch deliveries
          </p>
        </div>
        <button
          onClick={() => fetchOrders(page)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative md:col-span-1">
            <input
              type="text"
              placeholder="Search ref, customer, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium placeholder-slate-400"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          {/* Fulfillment Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Fulfillment Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing (Studio)</option>
              <option value="ready_for_collection">Ready for Pickup</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Payment Filter */}
          <div>
            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Payment Statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="pending">Pending Verification</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Fulfillment Method Filter */}
          <div>
            <select
              value={deliveryFilter}
              onChange={(e) => {
                setDeliveryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Fulfillment Types</option>
              <option value="store_pickup">Store Counter Pickup</option>
              <option value="home_delivery">Home Delivery</option>
            </select>
          </div>
        </div>

        {/* Results count indicator */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
          <span>
            Showing <strong className="text-slate-800 dark:text-slate-200">{orders.length}</strong> of{" "}
            <strong className="text-slate-800 dark:text-slate-200">{pagination.total}</strong> orders
          </span>
          {pagination.totalPages > 1 && (
            <span>
              Page {page} of {pagination.totalPages}
            </span>
          )}
        </div>
      </div>

      {/* Orders List / Table */}
      {loading ? (
        <div className="py-24 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 mt-2 font-medium">Loading orders from database...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 space-y-2">
          <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-base font-bold text-slate-700 dark:text-slate-300">No orders found</p>
          <p className="text-xs text-slate-400">
            No orders match the selected filters or search query.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Order Ref</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Fulfillment</th>
                    <th className="py-3 px-4 text-center">Items</th>
                    <th className="py-3 px-4 font-mono">Total</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {orders.map((ord) => {
                    const isPickup = ord.deliveryType === "store_pickup";
                    const isAddressMissing = ord.isAddressMissing;

                    return (
                      <tr
                        key={ord.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group"
                      >
                        {/* Order Ref */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{ord.orderReference}</span>
                            <button
                              onClick={() => copyToClipboard(ord.orderReference, ord.id)}
                              title="Copy Order Reference"
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-purple-600 transition"
                            >
                              {copiedId === ord.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Date & Time */}
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(ord.createdAt)}
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {ord.customer?.fullName || "Guest Customer"}
                          </div>
                          {ord.customer?.phone && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              +91 {ord.customer.phone}
                            </div>
                          )}
                        </td>

                        {/* Fulfillment & Delivery Area / PIN */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-medium">
                            {isPickup ? (
                              <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 font-semibold">
                                <ShoppingBag className="w-3.5 h-3.5" /> Store Pickup
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-400 font-semibold">
                                <Truck className="w-3.5 h-3.5" /> Home Delivery
                              </span>
                            )}
                          </div>
                          {!isPickup && (
                            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              {isAddressMissing ? (
                                <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-bold">
                                  <AlertTriangle className="w-3 h-3" /> Address Missing!
                                </span>
                              ) : (
                                <span className="truncate max-w-[150px]">
                                  {ord.deliverySummary?.cityTown || "City"}
                                  {ord.deliverySummary?.pinCode
                                    ? ` - ${ord.deliverySummary.pinCode}`
                                    : ""}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Item Count */}
                        <td className="py-3.5 px-4 text-center font-bold text-slate-900 dark:text-white">
                          <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px]">
                            {ord.itemCount || 1}
                          </span>
                        </td>

                        {/* Total Amount */}
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                          {formatINR(ord.totalAmount)}
                        </td>

                        {/* Payment */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 font-bold capitalize px-2.5 py-0.5 rounded-full text-[10px] border ${getPaymentBadge(
                              ord.paymentStatus
                            )}`}
                          >
                            {ord.paymentStatus.replace(/_/g, " ")}
                          </span>
                          <span className="block text-[10px] text-slate-400 uppercase font-mono mt-0.5">
                            {ord.paymentMethod.replace(/_/g, " ")}
                          </span>
                        </td>

                        {/* Fulfillment Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center font-bold capitalize px-2.5 py-0.5 rounded-full text-[10px] border ${getStatusBadge(
                              ord.orderStatus
                            )}`}
                          >
                            {ord.orderStatus.replace(/_/g, " ")}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <Link
                            href={`/admin/orders/${ord.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-sm hover:shadow"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Responsive Cards View */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-4">
            {orders.map((ord) => {
              const isPickup = ord.deliveryType === "store_pickup";
              const isAddressMissing = ord.isAddressMissing;

              return (
                <div
                  key={ord.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-sm block">
                        {ord.orderReference}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDate(ord.createdAt)}
                      </span>
                    </div>
                    <div className="text-right font-mono font-black text-slate-900 dark:text-white text-base">
                      {formatINR(ord.totalAmount)}
                    </div>
                  </div>

                  {/* Customer info */}
                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {ord.customer?.fullName || "Guest Customer"}
                    </div>
                    {ord.customer?.phone && (
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        <Phone className="w-3 h-3 text-slate-400" />
                        +91 {ord.customer.phone}
                      </div>
                    )}
                  </div>

                  {/* Fulfillment and Delivery Details */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold block text-slate-700 dark:text-slate-300">
                        {isPickup ? "Counter Pickup" : "Home Delivery"}
                      </span>
                      {!isPickup && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isAddressMissing ? (
                            <span className="text-rose-600 font-bold">Address Missing!</span>
                          ) : (
                            `${ord.deliverySummary?.cityTown || "City"} - ${
                              ord.deliverySummary?.pinCode || ""
                            }`
                          )}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">Items</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {ord.itemCount || 1}
                      </span>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span
                      className={`font-bold capitalize px-2 py-0.5 rounded-full text-[10px] border ${getStatusBadge(
                        ord.orderStatus
                      )}`}
                    >
                      {ord.orderStatus.replace(/_/g, " ")}
                    </span>
                    <span
                      className={`font-bold capitalize px-2 py-0.5 rounded-full text-[10px] border ${getPaymentBadge(
                        ord.paymentStatus
                      )}`}
                    >
                      {ord.paymentStatus}
                    </span>
                  </div>

                  {/* View Details Button */}
                  <Link
                    href={`/admin/orders/${ord.id}`}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Order Details
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
