"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
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

// Module-level deduplication cache to share in-flight requests across concurrent mounted instances
type NotificationListener = (data: { items: NotificationItem[]; unreadCount: number }) => void;

const sharedInFlight: Record<string, Promise<{ items: NotificationItem[]; unreadCount: number } | null> | null> = {};
const sharedListeners: Record<string, Set<NotificationListener>> = {
  customer: new Set(),
  admin: new Set(),
};
const lastFetchedData: Record<string, { items: NotificationItem[]; unreadCount: number } | null> = {
  customer: null,
  admin: null,
};
const lastFetchTimestamp: Record<string, number> = {
  customer: 0,
  admin: 0,
};
const sharedPollerIntervals: Record<string, NodeJS.Timeout | null> = {
  customer: null,
  admin: null,
};
const sharedSubscribers: Record<string, number> = {
  customer: 0,
  admin: 0,
};
const authUnauthorized: Record<string, boolean> = {
  customer: false,
  admin: false,
};
const inFlightReadIds = new Set<string>();

export function startSharedPolling(scope: "customer" | "admin") {
  if (typeof window === "undefined") return;
  if (sharedPollerIntervals[scope]) return;
  if (authUnauthorized[scope]) return;

  sharedPollerIntervals[scope] = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState === "visible" && !authUnauthorized[scope]) {
      executeSharedFetch(scope);
    }
  }, 30000);
}

export function stopSharedPolling(scope: "customer" | "admin") {
  if (sharedPollerIntervals[scope]) {
    clearInterval(sharedPollerIntervals[scope]!);
    sharedPollerIntervals[scope] = null;
  }
}

export function clearNotificationCache(scope?: "customer" | "admin") {
  if (scope) {
    lastFetchedData[scope] = null;
    lastFetchTimestamp[scope] = 0;
    sharedInFlight[scope] = null;
    authUnauthorized[scope] = false;
  } else {
    lastFetchedData.customer = null;
    lastFetchedData.admin = null;
    lastFetchTimestamp.customer = 0;
    lastFetchTimestamp.admin = 0;
    sharedInFlight.customer = null;
    sharedInFlight.admin = null;
    authUnauthorized.customer = false;
    authUnauthorized.admin = false;
  }
}

async function executeSharedFetch(scope: "customer" | "admin"): Promise<{ items: NotificationItem[]; unreadCount: number } | null> {
  if (authUnauthorized[scope]) {
    return null;
  }
  const now = Date.now();
  // Return cached result if fetched within 2 seconds
  if (lastFetchedData[scope] && now - lastFetchTimestamp[scope] < 2000) {
    return lastFetchedData[scope];
  }

  if (sharedInFlight[scope]) {
    return sharedInFlight[scope];
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch(`/api/notifications?scope=${scope}&limit=10`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        authUnauthorized[scope] = true;
        stopSharedPolling(scope);
        return null;
      }
      if (!res.ok) return null;
      authUnauthorized[scope] = false;
      const data = await res.json();
      if (data.success) {
        const payload = {
          items: (data.items || []) as NotificationItem[],
          unreadCount: (data.unreadCount || 0) as number,
        };
        lastFetchedData[scope] = payload;
        lastFetchTimestamp[scope] = Date.now();
        sharedListeners[scope]?.forEach((listener) => {
          try {
            listener(payload);
          } catch {}
        });
        return payload;
      }
      return null;
    } catch {
      return null;
    } finally {
      sharedInFlight[scope] = null;
    }
  })();

  sharedInFlight[scope] = fetchPromise;
  return fetchPromise;
}

export function calculateDropdownStyle(triggerEl: HTMLElement | null): React.CSSProperties {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;

  if (!triggerEl) {
    return {
      position: "fixed",
      top: "60px",
      right: "16px",
      width: vw < 640 ? "calc(100vw - 24px)" : "384px",
      maxWidth: "calc(100vw - 24px)",
      zIndex: 60,
    };
  }

  const rect = triggerEl.getBoundingClientRect();

  if (vw < 640) {
    // Mobile screens (< 640px): fixed viewport-anchored panel with 12px safe gutters
    const top = Math.min(rect.bottom + 8, vh - 220);
    const maxHeight = Math.max(220, vh - top - 16);
    return {
      position: "fixed",
      top: `${Math.max(12, top)}px`,
      left: "12px",
      right: "12px",
      width: "auto",
      maxWidth: "calc(100vw - 24px)",
      maxHeight: `${maxHeight}px`,
      zIndex: 60,
    };
  } else {
    // Tablet & Desktop (>= 640px)
    const panelWidth = Math.min(384, vw - 24); // 384px (w-96)
    let left: number;

    // Check if trigger is too close to left screen edge (e.g. desktop sidebar where rect.right ~ 240px or collapsed at ~80px)
    if (rect.right - panelWidth < 12) {
      left = Math.max(12, Math.min(rect.left, vw - panelWidth - 12));
    } else {
      left = Math.max(12, Math.min(rect.right - panelWidth, vw - panelWidth - 12));
    }

    const top = Math.min(rect.bottom + 8, vh - 220);
    const maxHeight = Math.max(260, Math.min(540, vh - top - 16));

    return {
      position: "fixed",
      top: `${Math.max(12, top)}px`,
      left: `${left}px`,
      width: `${panelWidth}px`,
      maxHeight: `${maxHeight}px`,
      zIndex: 60,
    };
  }
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
  const { user, loading: authLoading } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [liveToast, setLiveToast] = useState<NotificationItem | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const latestNotifIdRef = useRef<string | null>(null);
  const initialLoadRef = useRef<boolean>(true);

  // Initialize with precomputed position to eliminate unpositioned first-open flash
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>(() =>
    calculateDropdownStyle(null)
  );

  // Synchronous positioning on click before state commit
  const handleToggle = () => {
    if (!isOpen) {
      const el = buttonRef.current || dropdownRef.current;
      const coords = calculateDropdownStyle(el);
      setPanelStyle(coords);
      setIsOpen(true);
      fetchNotifications();
    } else {
      setIsOpen(false);
    }
  };

  // Keep position pinned to anchor on window resize or scroll
  const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;

    const syncPos = () => {
      const el = buttonRef.current || dropdownRef.current;
      setPanelStyle(calculateDropdownStyle(el));
    };

    syncPos();
    window.addEventListener("resize", syncPos);
    window.addEventListener("scroll", syncPos, true);

    return () => {
      window.removeEventListener("resize", syncPos);
      window.removeEventListener("scroll", syncPos, true);
    };
  }, [isOpen]);

  // Subscribe to shared poller updates
  useEffect(() => {
    const handleSharedUpdate = (data: { items: NotificationItem[]; unreadCount: number }) => {
      setNotifications(data.items);
      setUnreadCount(data.unreadCount);

      if (!initialLoadRef.current && data.items.length > 0) {
        const newest = data.items[0];
        if (
          newest.id !== latestNotifIdRef.current &&
          !newest.isRead &&
          (newest.priority === "high" || newest.priority === "urgent" || scope === "admin")
        ) {
          setLiveToast(newest);
          setTimeout(() => setLiveToast(null), 6000);
        }
      }

      if (data.items.length > 0) {
        latestNotifIdRef.current = data.items[0].id;
      }
      initialLoadRef.current = false;
    };

    sharedListeners[scope]?.add(handleSharedUpdate);

    return () => {
      sharedListeners[scope]?.delete(handleSharedUpdate);
    };
  }, [scope]);

  // Reset cache and local state on user change or logout
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (user?.id !== prevUserIdRef.current) {
      if (scope === "customer") {
        clearNotificationCache("customer");
        setNotifications([]);
        setUnreadCount(0);
      }
      prevUserIdRef.current = user?.id || null;
    }
  }, [user?.id, scope]);

  // Check authorization for current scope
  const isAuthorized = React.useMemo(() => {
    if (authLoading) return false;
    if (scope === "customer") {
      return !!user;
    }
    if (scope === "admin") {
      return !!user && user.role === "admin";
    }
    return false;
  }, [scope, authLoading, user]);

  // Fetch notifications via shared deduplicated poller
  const fetchNotifications = useCallback(async () => {
    // Strictly skip customer polling while auth is loading or user is not logged in
    if (scope === "customer" && (authLoading || !user)) {
      return;
    }
    if (!isAuthorized) {
      return;
    }
    await executeSharedFetch(scope);
  }, [scope, isAuthorized, authLoading, user]);

  // Visibility-aware centralized background polling
  useEffect(() => {
    if (!isAuthorized) {
      return;
    }

    // Reset unauthorized flag now that credentials or authorization changed
    authUnauthorized[scope] = false;

    sharedSubscribers[scope] = (sharedSubscribers[scope] || 0) + 1;

    // Fetch immediately on mount / authorization
    executeSharedFetch(scope);

    // Ensure centralized shared poller is active
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      startSharedPolling(scope);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        executeSharedFetch(scope);
        startSharedPolling(scope);
      } else {
        stopSharedPolling(scope);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sharedSubscribers[scope] = Math.max(0, (sharedSubscribers[scope] || 1) - 1);
      if (sharedSubscribers[scope] === 0) {
        stopSharedPolling(scope);
      }
    };
  }, [scope, isAuthorized]);

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

  // Mark single as read with deduplication guard and optimistic update
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (inFlightReadIds.has(id)) return;
    inFlightReadIds.add(id);

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(prev - 1, 0));

    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });
    } catch {} finally {
      inFlightReadIds.delete(id);
    }
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
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
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
