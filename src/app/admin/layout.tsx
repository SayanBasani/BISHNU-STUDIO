"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  DollarSign,
  Users,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  FileText,
  Image as ImageIcon,
  Layers,
  Tags,
  Boxes,
  BarChart3,
  Settings,
  ArrowLeft,
  Loader2,
  LogOut,
  QrCode,
  Store,
  Sun,
  Moon,
  MessageSquare,
  Menu,
  X,
  FileSpreadsheet,
  Code2,
  RotateCcw,
  Bell,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import UserAvatar from "@/components/ui/UserAvatar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [adminBrandName, setAdminBrandName] = useState("Bishnu Studio");
  const mobileNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("admin_sidebar_collapsed");
      if (saved === "true") {
        setSidebarCollapsed(true);
      }
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("admin_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    fetch("/api/settings/shop")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const payload = data?.settings || data?.shop;
        if (payload?.shopName) setAdminBrandName(payload.shopName);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/admin/login");
    }
  }, [user, loading, router, pathname]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile drawer on Escape key and manage body scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    };

    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  const handleAdminLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
      await logout();
      router.push("/admin/login");
    } catch {
      router.push("/admin/login");
    }
  };

  const navSections = [
    {
      title: "Core Operations",
      items: [
        { href: "/admin", label: "Overview", icon: LayoutDashboard },
        { href: "/admin/notifications", label: "Notifications", icon: Bell },
        { href: "/admin/orders", label: "All Orders", icon: Package },
        { href: "/admin/returns", label: "Returns & Refunds", icon: RotateCcw },
        { href: "/admin/payments", label: "UPI Verification", icon: QrCode },
        { href: "/admin/payments/reconciliation", label: "Reconciliation Ledger", icon: FileSpreadsheet },
      ],
    },
    {
      title: "Printing Queues",
      items: [
        { href: "/admin/orders/pvc", label: "PVC Cards", icon: CreditCard },
        { href: "/admin/orders/documents", label: "Document Print", icon: FileText },
        { href: "/admin/orders/photos", label: "Photo Studio", icon: ImageIcon },
        { href: "/admin/orders/lamination", label: "Lamination", icon: Layers },
      ],
    },
    {
      title: "Catalogue & Stock",
      items: [
        { href: "/admin/products", label: "Products", icon: ShoppingBag },
        { href: "/admin/categories", label: "Categories", icon: Tags },
        { href: "/admin/inventory", label: "Inventory Stock", icon: Boxes },
        { href: "/admin/reviews", label: "Customer Reviews", icon: MessageSquare },
      ],
    },
    {
      title: "Business & Settings",
      items: [
        { href: "/admin/pricing", label: "Printing Pricing", icon: DollarSign },
        { href: "/admin/customers", label: "Customers", icon: Users },
        { href: "/admin/customers/appeals", label: "Appeals Queue", icon: ShieldAlert },
        { href: "/admin/analytics", label: "Analytics & Reports", icon: BarChart3 },
        { href: "/admin/settings/business", label: "Store Address", icon: Store },
        { href: "/admin/settings/payments", label: "UPI Payment Setup", icon: QrCode },
        { href: "/admin/settings/security", label: "Security & Password", icon: ShieldCheck },
        { href: "/admin/settings/developer", label: "Developer & Credits", icon: Code2 },
        { href: "/admin/settings", label: "System Config", icon: Settings },
      ],
    },
  ];

  const renderNavItems = (isCollapsed: boolean = false) => (
    <nav className={`p-3 ${isCollapsed ? "space-y-4" : "space-y-5"} focus:outline-none`} aria-label="Admin Navigation">
      {navSections.map((section, idx) => (
        <div key={idx}>
          {!isCollapsed ? (
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 truncate">
              {section.title}
            </div>
          ) : idx > 0 ? (
            <div className="my-2 border-t border-slate-200 dark:border-slate-800" />
          ) : null}
          <div className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === item.href ||
                    (item.href !== "/admin/orders" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`group relative flex items-center ${
                    isCollapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2"
                  } rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                  {isCollapsed && (
                    <span className="pointer-events-none absolute left-full ml-2 hidden group-hover:flex items-center px-2 py-1 rounded-md bg-slate-900 text-white dark:bg-slate-800 text-[11px] font-bold shadow-lg z-50 whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const renderProfileFooter = (isCollapsed: boolean = false) => (
    <div className={`p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/80 dark:bg-slate-950/40 shrink-0 ${isCollapsed ? "flex flex-col items-center" : ""}`}>
      <Link
        href="/"
        title="Exit to Storefront"
        className={`flex items-center ${
          isCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2"
        } text-xs font-medium text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition`}
      >
        <ArrowLeft className="w-4 h-4 shrink-0" />
        {!isCollapsed && <span className="truncate">Exit to Storefront</span>}
      </Link>
      <div className={`flex items-center ${isCollapsed ? "flex-col gap-2 pt-2" : "justify-between px-2 pt-2"} border-t border-slate-200 dark:border-slate-800/60 w-full`}>
        <Link
          href="/admin/settings/security"
          className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2.5 min-w-0 pr-2"} group`}
          title={`Manage Admin Profile & Security (${user.fullName})`}
        >
          <UserAvatar
            src={user.avatarUrl}
            name={user.fullName}
            size="md"
            className="border-purple-500/40 group-hover:ring-2 ring-purple-500"
            textClassName="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
          />
          {!isCollapsed && (
            <div className="truncate">
              <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition truncate">
                {user.fullName}
              </p>
              <p className="text-[10px] text-purple-600 dark:text-purple-400 font-mono truncate">Admin Settings &rarr;</p>
            </div>
          )}
        </Link>
        <button
          onClick={handleAdminLogout}
          title="Sign Out"
          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen h-[100dvh] flex flex-col md:flex-row overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-white text-xs block leading-tight">
              Admin Console
            </span>
            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 block leading-tight">
              {adminBrandName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <NotificationBell scope="admin" viewAllUrl="/admin/notifications" />
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open Admin Menu"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Mobile Slide-Over Drawer */}
      <aside
        ref={mobileNavRef}
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] h-full max-h-[100dvh] bg-white dark:bg-slate-900 text-slate-700 dark:text-gray-300 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out md:hidden border-r border-slate-200 dark:border-slate-800 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Mobile Admin Navigation Drawer"
      >
        {/* Mobile Drawer Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-white text-xs block">
                Admin Console
              </span>
              <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 block -mt-0.5">
                {adminBrandName}
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Scrollable Navigation List */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
          {renderNavItems()}
        </div>

        {/* Mobile Drawer Footer */}
        {renderProfileFooter()}
      </aside>

      {/* Desktop Fixed Viewport Sidebar */}
      <aside
        className={`hidden md:flex md:flex-col ${
          sidebarCollapsed ? "md:w-20" : "md:w-64"
        } h-full shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-gray-300 shadow-sm z-30 transition-all duration-300 ease-in-out`}
        aria-label="Desktop Admin Sidebar"
      >
        {/* Brand Header */}
        <div className={`p-4 border-b border-slate-200 dark:border-slate-800 flex items-center ${sidebarCollapsed ? "flex-col gap-3 justify-center" : "justify-between"} shrink-0`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <span className="font-bold text-slate-900 dark:text-white text-sm block truncate">
                  Admin Console
                </span>
                <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 block -mt-0.5 truncate">
                  {adminBrandName}
                </span>
              </div>
            )}
          </div>

          <div className={`flex items-center ${sidebarCollapsed ? "flex-col gap-2" : "gap-1"}`}>
            <NotificationBell scope="admin" viewAllUrl="/admin/notifications" />
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
            <button
              onClick={toggleSidebar}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Desktop Independent Vertically Scrollable Navigation Region */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
          {renderNavItems(sidebarCollapsed)}
        </div>

        {/* Desktop Fixed Bottom Footer */}
        {renderProfileFooter(sidebarCollapsed)}
      </aside>

      {/* Main Content Area - Independently Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <main className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
