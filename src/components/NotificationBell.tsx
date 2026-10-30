"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  Package,
  CreditCard,
  Truck,
  RotateCcw,
  ShieldAlert,
  Info,
  ExternalLink,
  X,
} from "lucide-react";

export interface NotificationItem {
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

interface NotificationBellProps {
  scope?: "customer" | "admin";
  viewAllUrl?: string;
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - Number(timestamp)) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(Number(timestamp)).toLocaleDateString();
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "order":
      return <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    case "payment":
      return <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    case "delivery":
      return <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    case "return":
      return <RotateCcw className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    case "account":
      return <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />;
    default:
      return <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
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

export default function NotificationBell({
  scope = "customer",
  viewAllUrl = "/account/notifications",
}: NotificationBellProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [liveToast, setLiveToast] = useState<NotificationItem | null>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const dropdownRef = useRef<HTMLDivElement>(null);
  const latestNotifIdRef = useRef<string | null>(null);
  const initialLoadRef = useRef<boolean>(true);

  // Viewport-aware responsive position calculation
  const updatePosition = useCallback(() => {
    if (!dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
    const vh = typeof window !== "undefined" ? window.innerHeight : 768;

    if (vw < 640) {
      // Mobile screens (< 640px): fixed viewport-anchored panel with 12px safe gutters
      const top = Math.min(rect.bottom + 8, vh - 220);
      const maxHeight = Math.max(220, vh - top - 16);
      setPanelStyle({
        position: "fixed",
        top: `${Math.max(12, top)}px`,
        left: "12px",
        right: "12px",
        width: "auto",
        maxWidth: "calc(100vw - 24px)",
        maxHeight: `${maxHeight}px`,
        zIndex: 60,
      });
    } else {
      // Tablet & Desktop (>= 640px)
      const panelWidth = Math.min(384, vw - 24); // 384px (w-96)
      let left: number;

      // Check if trigger is too close to left screen edge (e.g. desktop sidebar where rect.right ~ 240px):
      // Opening to the left would overflow off-screen! Open to the right instead.
      if (rect.right - panelWidth < 12) {
        left = Math.max(12, Math.min(rect.left, vw - panelWidth - 12));
      } else {
        // Trigger is on the right side (e.g. top navbar), align panel right edge to trigger right edge
        left = Math.max(12, Math.min(rect.right - panelWidth, vw - panelWidth - 12));
      }

      const top = Math.min(rect.bottom + 8, vh - 220);
      const maxHeight = Math.max(260, Math.min(540, vh - top - 16));

      setPanelStyle({
        position: "fixed",
        top: `${Math.max(12, top)}px`,
        left: `${left}px`,
        width: `${panelWidth}px`,
        maxHeight: `${maxHeight}px`,
        zIndex: 60,
      });
    }
  }, []);

  // Update position when opened, resized, or scrolled
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    const handleScrollOrResize = () => updatePosition();

    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);


  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?scope=${scope}&limit=10`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        const fetchedItems: NotificationItem[] = data.items || [];
        setNotifications(fetchedItems);
        setUnreadCount(data.unreadCount || 0);

        // Check for live toast if new unread notification arrived
        if (!initialLoadRef.current && fetchedItems.length > 0) {
          const newest = fetchedItems[0];
          if (
            newest.id !== latestNotifIdRef.current &&
            !newest.isRead &&
            (newest.priority === "high" || newest.priority === "urgent" || scope === "admin")
          ) {
            setLiveToast(newest);
            // Auto dismiss toast after 6 seconds
            setTimeout(() => setLiveToast(null), 6000);
          }
        }

        if (fetchedItems.length > 0) {
          latestNotifIdRef.current = fetchedItems[0].id;
        }
        initialLoadRef.current = false;
      }
    } catch {
      // Ignore network errors on polling
    }
  }, [scope]);

  // Tab visibility-aware polling
  useEffect(() => {
    fetchNotifications();

    let intervalId: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(fetchNotifications, 30000);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === "visible") {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Mark single as read
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  // Click notification item: mark as read and navigate
  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif.id);
    }
    setIsOpen(false);
    if (notif.linkUrl) {
      router.push(notif.linkUrl);
    }
  };

  const filteredNotifications = notifications.filter((n) =>
    activeTab === "unread" ? !n.isRead : true
  );

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        title="Notifications"
        className="relative p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 border border-transparent hover:border-gray-200 dark:hover:border-slate-700 transition focus:outline-hidden focus:ring-2 focus:ring-purple-500/40"
      >
        <Bell className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:scale-105" />

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-75 duration-200">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Live Toast Notification Banner */}
      {liveToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-white dark:bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-5 duration-300 flex items-start gap-3"
        >
          <div className={`p-2 rounded-xl shrink-0 border ${getCategoryBg(liveToast.category)}`}>
            {getCategoryIcon(liveToast.category)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                {liveToast.title}
              </span>
              <button
                type="button"
                onClick={() => setLiveToast(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded-sm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
              {liveToast.message}
            </p>
            {liveToast.linkUrl && (
              <button
                type="button"
                onClick={() => {
                  setLiveToast(null);
                  router.push(liveToast.linkUrl!);
                }}
                className="mt-2 text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
              >
                View details
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notifications Dropdown */}
      {isOpen && (
        <div
          style={panelStyle}
          className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top flex flex-col text-gray-900 dark:text-slate-100"
          role="menu"
        >
          {/* Header */}
          <div className="shrink-0 px-4 py-3 bg-gray-50/70 dark:bg-slate-950/50 border-b border-gray-100 dark:border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={loading}
                className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition flex items-center gap-1 disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="shrink-0 flex border-b border-gray-100 dark:border-slate-800 text-xs px-3 pt-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`pb-2 px-2 font-semibold transition border-b-2 ${
                activeTab === "all"
                  ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("unread")}
              className={`pb-2 px-2 font-semibold transition border-b-2 ${
                activeTab === "unread"
                  ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>

          {/* Notification List */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60 overscroll-contain">
            {filteredNotifications.length === 0 ? (
              <div className="py-10 text-center px-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2 text-gray-400">
                  <Bell className="w-5 h-5 opacity-40" />
                </div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {activeTab === "unread" ? "No unread notifications" : "No notifications yet"}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Updates on orders, payments, and account will appear here.
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3.5 flex items-start gap-3 transition cursor-pointer relative group ${
                    !item.isRead
                      ? "bg-purple-50/40 dark:bg-purple-950/20 hover:bg-purple-50/70 dark:hover:bg-purple-950/30"
                      : "hover:bg-gray-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  {/* Category Icon */}
                  <div className={`p-2 rounded-xl shrink-0 border ${getCategoryBg(item.category)}`}>
                    {getCategoryIcon(item.category)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-bold text-xs text-gray-900 dark:text-slate-100 truncate">
                        {item.title}
                      </span>
                      {item.priority === "urgent" && (
                        <span className="px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 block">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>

                  {/* Actions / Unread Indicator */}
                  <div className="absolute right-3 top-3.5 flex items-center gap-1">
                    {!item.isRead ? (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(item.id, e)}
                        title="Mark as read"
                        className="p-1 rounded-full text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition opacity-80 group-hover:opacity-100"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-purple-600 dark:bg-purple-400" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer View All Link */}
          <div className="shrink-0 p-2.5 bg-gray-50 dark:bg-slate-950/80 border-t border-gray-100 dark:border-slate-800 text-center">
            <Link
              href={viewAllUrl}
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition block py-1"
            >
              View all notifications &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
