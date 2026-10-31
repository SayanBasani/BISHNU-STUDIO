"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  formatINR,
  formatDate,
  formatCompactDateTime,
  formatPaymentMethod,
  formatCompactPaymentMethod,
  getPaymentMethodBadgeClass,
} from "@/lib/utils";
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
  CreditCard,
  Smartphone,
  Wallet,
} from "lucide-react";

function AdminOrdersContent() {
  const searchParams = useSearchParams();

  const [page, setPage] = useState(() =>
    Math.max(1, parseInt(searchParams.get("page") || "1", 10))
  );
  const [limit, setLimit] = useState(() => {
    const l = parseInt(searchParams.get("limit") || "20", 10);
    return [20, 50, 100].includes(l) ? l : 20;
  });
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get("orderStatus") || searchParams.get("status") || "all"
  );
  const [paymentFilter, setPaymentFilter] = useState(
    () => searchParams.get("paymentStatus") || "all"
  );
  const [deliveryFilter, setDeliveryFilter] = useState(
    () => searchParams.get("deliveryType") || "all"
  );

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
    limit: 20,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync state with URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", page.toString());
    if (limit !== 20) params.set("limit", limit.toString());
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "all") params.set("orderStatus", statusFilter);
    if (paymentFilter !== "all") params.set("paymentStatus", paymentFilter);
    if (deliveryFilter !== "all") params.set("deliveryType", deliveryFilter);

    const queryString = params.toString();
    const newUrl = queryString ? `/admin/orders?${queryString}` : "/admin/orders";
    if (
      typeof window !== "undefined" &&
      window.location.pathname + window.location.search !== newUrl
    ) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [page, limit, search, statusFilter, paymentFilter, deliveryFilter]);

  // Fetch when page, limit, or filters change
  useEffect(() => {
    fetchOrders(page, limit);
  }, [page, limit, statusFilter, paymentFilter, deliveryFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchOrders(1, limit);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchOrders = async (targetPage = page, targetLimit = limit) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", targetPage.toString());
      params.set("limit", targetLimit.toString());
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
          // Gracefully adjust page if current page exceeds total pages
          if (targetPage > data.pagination.totalPages && data.pagination.totalPages > 0) {
            setPage(data.pagination.totalPages);
          }
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
      case "refunded":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  const getPaymentMethodIcon = (method?: string) => {
    const norm = (method || "").toLowerCase();
    if (norm.includes("upi")) {
      return <Smartphone className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />;
    }
    if (norm.includes("online") || norm.includes("card")) {
      return <CreditCard className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0" />;
    }
    if (
      norm.includes("collection") ||
      norm.includes("delivery") ||
      norm.includes("cash") ||
      norm.includes("cod")
    ) {
      return <Wallet className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />;
    }
    return <CreditCard className="w-3 h-3 text-slate-500 shrink-0" />;
  };

  // Pagination helper: generate page numbers window
  const getPageNumbers = () => {
    const totalPages = pagination.totalPages;
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (page >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  };

  const startIdx = orders.length === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, pagination.total);

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
          onClick={() => fetchOrders(page, limit)}
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

        {/* Results count & rows selector */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span>
            Showing <strong className="text-slate-800 dark:text-slate-200">{startIdx}–{endIdx}</strong> of{" "}
            <strong className="text-slate-800 dark:text-slate-200">{pagination.total}</strong> orders
          </span>

          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value, 10);
                setLimit(newLimit);
                setPage(1);
              }}
              className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
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
          {/* Desktop Table View - Designed to fit cleanly within available desktop width */}
          <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-2 w-10 text-center">#</th>
                    <th className="py-3 px-2.5 w-32 whitespace-nowrap">Order Ref</th>
                    <th className="py-3 px-2.5 w-36 whitespace-nowrap">Date & Time</th>
                    <th className="py-3 px-2.5 w-36">Customer</th>
                    <th className="py-3 px-2.5 w-28">Fulfillment</th>
                    <th className="py-3 px-2 w-12 text-center">Items</th>
                    <th className="py-3 px-2.5 w-24 text-right font-mono whitespace-nowrap">Total</th>
                    <th className="py-3 px-2.5 w-24 text-center whitespace-nowrap">Payment Method</th>
                    <th className="py-3 px-2.5 w-28 text-center whitespace-nowrap">Payment Status</th>
                    <th className="py-3 px-2.5 w-28 text-center whitespace-nowrap">Order Status</th>
                    <th className="py-3 px-2 w-12 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {orders.map((ord, idx) => {
                    const isPickup = ord.deliveryType === "store_pickup";
                    const isAddressMissing = ord.isAddressMissing;
                    const rowNumber = (page - 1) * limit + idx + 1;

                    return (
                      <tr
                        key={ord.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group"
                      >
                        {/* 1. Sequential Row Number */}
                        <td className="py-3 px-2 text-center text-slate-400 dark:text-slate-500 font-mono text-[11px] font-bold">
                          {rowNumber}
                        </td>

                        {/* 2. Order Ref */}
                        <td className="py-3 px-2.5 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span>{ord.orderReference}</span>
                            <button
                              onClick={() => copyToClipboard(ord.orderReference, ord.id)}
                              title="Copy Order Reference"
                              aria-label="Copy Order Reference"
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-purple-600 transition rounded"
                            >
                              {copiedId === ord.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* 3. Date & Time */}
                        <td className="py-3 px-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]">
                          {formatCompactDateTime(ord.createdAt)}
                        </td>

                        {/* 4. Customer */}
                        <td className="py-3 px-2.5 max-w-[144px]">
                          <div
                            className="font-semibold text-slate-900 dark:text-white truncate text-xs"
                            title={ord.customer?.fullName || "Guest Customer"}
                          >
                            {ord.customer?.fullName || "Guest Customer"}
                          </div>
                          {ord.customer?.phone && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 mt-0.5 truncate">
                              <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              +91 {ord.customer.phone}
                            </div>
                          )}
                        </td>

                        {/* 5. Fulfillment & Delivery Area / PIN */}
                        <td className="py-3 px-2.5">
                          <div className="flex items-center gap-1 font-medium whitespace-nowrap">
                            {isPickup ? (
                              <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 font-semibold text-[11px]">
                                <ShoppingBag className="w-3 h-3" /> Pickup
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-400 font-semibold text-[11px]">
                                <Truck className="w-3 h-3" /> Delivery
                              </span>
                            )}
                          </div>
                          {!isPickup && (
                            <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {isAddressMissing ? (
                                <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-bold">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Missing Addr
                                </span>
                              ) : (
                                <span className="truncate max-w-[110px] block" title={ord.deliverySummary?.cityTown || "City"}>
                                  {ord.deliverySummary?.cityTown || "City"}
                                  {ord.deliverySummary?.pinCode
                                    ? ` - ${ord.deliverySummary.pinCode}`
                                    : ""}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 6. Item Count */}
                        <td className="py-3 px-2 text-center font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-mono">
                            {ord.itemCount || 1}
                          </span>
                        </td>

                        {/* 7. Total Amount */}
                        <td className="py-3 px-2.5 font-bold text-slate-900 dark:text-white font-mono whitespace-nowrap text-right">
                          {formatINR(ord.totalAmount)}
                        </td>

                        {/* 8. Payment Method */}
                        <td className="py-3 px-2.5 text-center whitespace-nowrap">
                          <span
                            title={formatPaymentMethod(ord.paymentMethod)}
                            className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[10px] border shadow-2xs ${getPaymentMethodBadgeClass(
                              ord.paymentMethod
                            )}`}
                          >
                            {getPaymentMethodIcon(ord.paymentMethod)}
                            <span>{formatCompactPaymentMethod(ord.paymentMethod)}</span>
                          </span>
                        </td>

                        {/* 9. Payment Status */}
                        <td className="py-3 px-2.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center justify-center font-bold capitalize px-2 py-0.5 rounded-full text-[10px] border ${getPaymentBadge(
                              ord.paymentStatus
                            )}`}
                          >
                            {ord.paymentStatus?.replace(/_/g, " ") || "Unpaid"}
                          </span>
                        </td>

                        {/* 10. Order Status */}
                        <td className="py-3 px-2.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center justify-center font-bold capitalize px-2 py-0.5 rounded-full text-[10px] border ${getStatusBadge(
                              ord.orderStatus
                            )}`}
                          >
                            {ord.orderStatus?.replace(/_/g, " ") || "Pending"}
                          </span>
                        </td>

                        {/* 11. Actions (Compact eye icon button with accessible tooltip) */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <Link
                            href={`/admin/orders/${ord.id}`}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-600 dark:hover:text-white transition shadow-2xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                            title="View Details"
                            aria-label="View Order Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
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
            {orders.map((ord, idx) => {
              const isPickup = ord.deliveryType === "store_pickup";
              const isAddressMissing = ord.isAddressMissing;
              const rowNumber = (page - 1) * limit + idx + 1;

              return (
                <div
                  key={ord.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-mono text-[11px] font-bold">
                          #{rowNumber}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-sm block">
                          {ord.orderReference}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {formatCompactDateTime(ord.createdAt)}
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

                  {/* Payment Method, Payment Status & Order Status */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Payment Method:
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[10px] border ${getPaymentMethodBadgeClass(
                          ord.paymentMethod
                        )}`}
                      >
                        {getPaymentMethodIcon(ord.paymentMethod)}
                        <span>{formatCompactPaymentMethod(ord.paymentMethod)}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Payment Status:
                      </span>
                      <span
                        className={`font-bold capitalize px-2 py-0.5 rounded-full text-[10px] border ${getPaymentBadge(
                          ord.paymentStatus
                        )}`}
                      >
                        {ord.paymentStatus?.replace(/_/g, " ") || "Unpaid"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Order Status:
                      </span>
                      <span
                        className={`font-bold capitalize px-2 py-0.5 rounded-full text-[10px] border ${getStatusBadge(
                          ord.orderStatus
                        )}`}
                      >
                        {ord.orderStatus?.replace(/_/g, " ") || "Pending"}
                      </span>
                    </div>
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
            <div className="flex flex-col sm:flex-row items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm gap-3 text-xs">
              <div className="text-slate-500 dark:text-slate-400">
                Showing <strong>{startIdx}–{endIdx}</strong> of{" "}
                <strong>{pagination.total}</strong> orders
              </div>

              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                {getPageNumbers().map((pNum, i) =>
                  typeof pNum === "number" ? (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-bold transition ${
                        pNum === page
                          ? "bg-purple-600 text-white shadow-sm"
                          : "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {pNum}
                    </button>
                  ) : (
                    <span
                      key={`ellipsis-${i}`}
                      className="px-1.5 text-slate-400 font-bold"
                    >
                      ...
                    </span>
                  )
                )}

                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 mt-2 font-medium">Loading orders hub...</p>
        </div>
      }
    >
      <AdminOrdersContent />
    </Suspense>
  );
}
