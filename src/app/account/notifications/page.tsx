"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Package,
  CreditCard,
  Truck,
  RotateCcw,
  ShieldAlert,
  Info,
  ExternalLink,
  RefreshCw,
  ArrowLeft,
  Filter,
} from "lucide-react";

interface NotificationItem {
  id: string;
  recipientType: "admin" | "customer";
  recipientId?: string | null;
  category: "order" | "payment" | "delivery" | "return" | "account" | "system";
  eventType: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  linkUrl?: string | null;
  isRead: boolean;
  readAt?: number | null;
  priority: "low" | "normal" | "high" | "urgent";
  createdAt: number;
}

function formatFullTime(timestamp: number): string {
  const date = new Date(Number(timestamp));
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "order":
      return <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    case "payment":
      return <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
    case "delivery":
      return <Truck className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
    case "return":
      return <RotateCcw className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
    case "account":
      return <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />;
    default:
      return <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
  }
}

function getCategoryBg(category: string) {
  switch (category) {
    case "order":
      return "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900";
    case "payment":
      return "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900";
    case "delivery":
      return "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900";
    case "return":
      return "bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-900";
    case "account":
      return "bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900";
    default:
      return "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-900";
  }
}

export default function CustomerNotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterRead, setFilterRead] = useState<"all" | "unread">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications?scope=customer&limit=100", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNotifications(data.items || []);
          setUnreadCount(data.unreadCount || 0);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/account/notifications");
      return;
    }
    if (user) {
      fetchNotifications();
    }
  }, [user, authLoading, router, fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(prev - 1, 0));
      }
    } catch {}
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "customer" }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const target = notifications.find((n) => n.id === id);
        if (target && !target.isRead) {
          setUnreadCount((prev) => Math.max(prev - 1, 0));
        }
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }
    } catch {}
  };

  const filtered = notifications.filter((item) => {
    if (filterRead === "unread" && item.isRead) return false;
    if (filterCategory !== "all" && item.category !== filterCategory) return false;
    return true;
  });

  if (authLoading || (!user && loading)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link
            href="/account/orders"
            className="hover:text-purple-600 dark:hover:text-purple-400 transition flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </Link>
          <span>/</span>
          <span className="font-semibold text-gray-900 dark:text-white">Notifications</span>
        </div>

        {/* Page Header */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  Notification Center
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Real-time updates on orders, payments, fulfillment, and account alerts.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={fetchNotifications}
              disabled={loading}
              title="Refresh notifications"
              className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all as read ({unreadCount})
              </button>
            )}
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
          {/* Read Status Filter */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterRead("all")}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterRead === "all"
                  ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterRead("unread")}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterRead === "unread"
                  ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Categories</option>
              <option value="order">Orders</option>
              <option value="payment">Payments</option>
              <option value="delivery">Deliveries</option>
              <option value="return">Returns</option>
              <option value="account">Account & Security</option>
            </select>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {loading && notifications.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-gray-500">Loading your notifications...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-gray-200 dark:border-slate-800 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-400 flex items-center justify-center mx-auto mb-3">
                <Bell className="w-7 h-7 opacity-40" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                No notifications match your filter
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                You will receive alerts here whenever your order progress changes or payment actions occur.
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border transition shadow-xs flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                  !item.isRead
                    ? "border-purple-300 dark:border-purple-800/80 bg-purple-50/20 dark:bg-purple-950/10"
                    : "border-gray-200 dark:border-slate-800/80"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-2xl shrink-0 border mt-0.5 ${getCategoryBg(
                      item.category
                    )}`}
                  >
                    {getCategoryIcon(item.category)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900 dark:text-white">
                        {item.title}
                      </span>

                      {!item.isRead && (
                        <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                          New
                        </span>
                      )}

                      {item.priority === "urgent" && (
                        <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                          Urgent
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {item.message}
                    </p>

                    <div className="flex items-center gap-3 pt-1 text-[11px] text-gray-400 dark:text-gray-500">
                      <span>{formatFullTime(item.createdAt)}</span>
                      <span>•</span>
                      <span className="capitalize">{item.category}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center border-t sm:border-t-0 pt-3 sm:pt-0 w-full sm:w-auto justify-end">
                  {item.linkUrl && (
                    <Link
                      href={item.linkUrl}
                      onClick={() => !item.isRead && handleMarkAsRead(item.id)}
                      className="px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-900 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 text-xs font-semibold transition flex items-center gap-1"
                    >
                      View
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}

                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkAsRead(item.id)}
                      title="Mark as read"
                      className="p-2 rounded-xl text-gray-500 hover:text-purple-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    title="Dismiss notification"
                    className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
