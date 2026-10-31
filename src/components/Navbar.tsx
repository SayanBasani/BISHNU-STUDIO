"use strict";
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import {
  Printer,
  ShoppingBag,
  CreditCard,
  FileText,
  Layers,
  Camera,
  User,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Package,
  Sun,
  Moon,
  ChevronRight,
  Lock,
  ExternalLink,
  Bell,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import UserAvatar from "@/components/ui/UserAvatar";
import { fetchPublicShopSettings } from "@/lib/public-settings";

let cachedNavShop: { shopName: string; logoUrl: string | null } | null = null;

export default function Navbar() {
  const pathname = usePathname();
  const { user, loading: authLoading, logout } = useAuth();
  const { cartCount } = useCart();
  const { theme, toggleTheme } = useTheme();

  const [shopBrand, setShopBrand] = useState<{ shopName: string; logoUrl: string | null }>(
    () => cachedNavShop || { shopName: process.env.NEXT_PUBLIC_BUSINESS_NAME || "Bishnu Studio", logoUrl: "/logo.png" }
  );

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileAccountMenuOpen, setMobileAccountMenuOpen] = useState(false);

  const desktopDropdownRef = useRef<HTMLDivElement>(null);
  const mobileAccountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cachedNavShop) {
      setShopBrand(cachedNavShop);
      return;
    }
    fetchPublicShopSettings().then((payload) => {
      if (payload?.shopName) {
        const loaded = {
          shopName: payload.shopName || "Bishnu Studio",
          logoUrl: payload.logoUrl || "/logo.png",
        };
        cachedNavShop = loaded;
        setShopBrand(loaded);
      }
    });
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
    setMobileAccountMenuOpen(false);
  }, [pathname]);

  // Handle Escape key to close menus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        setUserDropdownOpen(false);
        setMobileAccountMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle clicks outside dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        userDropdownOpen &&
        desktopDropdownRef.current &&
        !desktopDropdownRef.current.contains(target)
      ) {
        setUserDropdownOpen(false);
      }
      if (
        mobileAccountMenuOpen &&
        mobileAccountRef.current &&
        !mobileAccountRef.current.contains(target)
      ) {
        setMobileAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userDropdownOpen, mobileAccountMenuOpen]);

  // Prevent background scrolling when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { href: "/shop", label: "Shop", icon: ShoppingBag },
    { href: "/services/pvc-card", label: "PVC Cards", icon: CreditCard },
    { href: "/services/document-printing", label: "Doc Printing", icon: FileText },
    { href: "/services/lamination", label: "Lamination", icon: Layers },
    { href: "/services/photo-printing", label: "Photo Studio", icon: Camera },
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== "/shop" && pathname.startsWith(`${href}/`));

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2">
            {/* Brand Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 sm:gap-3 shrink-0 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl p-1"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform shrink-0">
                <Printer className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="truncate">
                <span className="text-base sm:text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-1">
                  {shopBrand.shopName}
                </span>
                <span className="hidden xs:block text-[10px] uppercase font-semibold tracking-wider text-blue-600 dark:text-blue-400 -mt-0.5">
                  Print &amp; Stationery
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      active
                        ? "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50"
                        : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right Action Controls */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5 text-amber-400 animate-in spin-in-180 duration-200" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600 animate-in spin-in-180 duration-200" />
                )}
              </button>

              {/* Cart Link with Live Badge */}
              <Link
                href="/cart"
                className="relative flex items-center justify-center p-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                aria-label="View Shopping Cart"
              >
                <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 dark:text-gray-200" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shadow">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </Link>

              {/* Notification Bell (rendered only when authenticated) */}
              {!authLoading && user && (
                <NotificationBell scope="customer" viewAllUrl="/account/notifications" />
              )}

              {/* Mobile Account Preview Button (< sm screens) */}
              <div className="sm:hidden flex items-center" ref={mobileAccountRef}>
                {authLoading ? (
                  <div
                    className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700/70 animate-pulse shrink-0"
                    aria-label="Loading account"
                  />
                ) : user ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMobileAccountMenuOpen(!mobileAccountMenuOpen)}
                      className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                      aria-label={`Account preview: ${user.fullName}`}
                      aria-expanded={mobileAccountMenuOpen}
                    >
                      <UserAvatar
                        src={user.avatarUrl}
                        name={user.fullName}
                        size="md"
                      />
                      <span className="hidden xs:inline-block text-xs font-bold text-gray-800 dark:text-gray-200 max-w-[65px] truncate">
                        {user.fullName.split(" ")[0]}
                      </span>
                    </button>

                    {/* Mobile Quick Account Sheet / Dropdown */}
                    {mobileAccountMenuOpen && (
                      <div
                        className="fixed inset-x-3 top-16 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95"
                        onClick={() => setMobileAccountMenuOpen(false)}
                      >
                        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-slate-800 flex items-center gap-3">
                          <UserAvatar src={user.avatarUrl} name={user.fullName} size="lg" />
                          <div className="truncate flex-1">
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                              {user.fullName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate font-mono">
                              {user.email}
                            </p>
                          </div>
                        </div>

                        <Link
                          href="/account/orders"
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          <Package className="w-4 h-4 text-blue-500" />
                          My Orders &amp; Tracking
                        </Link>
                        <Link
                          href="/account/profile"
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          <User className="w-4 h-4 text-blue-500" />
                          Account Profile &amp; Picture
                        </Link>
                        <Link
                          href="/account/notifications"
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          <Bell className="w-4 h-4 text-blue-500" />
                          Notifications
                        </Link>
                        <Link
                          href="/account/security"
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          <Lock className="w-4 h-4 text-amber-500" />
                          Change Password
                        </Link>
                        {user.role === "admin" && (
                          <Link
                            href="/admin"
                            className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                          >
                            <ShieldCheck className="w-4 h-4 text-purple-600" />
                            Admin Console
                          </Link>
                        )}
                        <div className="border-t border-gray-100 dark:border-slate-800 my-1" />
                        <button
                          type="button"
                          onClick={logout}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left"
                        >
                          <LogOut className="w-4 h-4 text-rose-500" />
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="p-1.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                    aria-label="Sign In"
                    title="Sign In"
                  >
                    <User className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </Link>
                )}
              </div>

              {/* Desktop User Account Controls (>= sm screens) */}
              {authLoading ? (
                /* State A — Loading placeholder */
                <div
                  className="hidden sm:flex items-center gap-2 px-2 py-1.5 rounded-xl animate-pulse"
                  aria-label="Loading authentication"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700/70 shrink-0" />
                  <div className="w-14 h-4 rounded-md bg-slate-200 dark:bg-slate-700/70" />
                </div>
              ) : user ? (
                /* State B — Authenticated Desktop Account Menu */
                <div className="relative hidden sm:block" ref={desktopDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 border border-transparent hover:border-gray-200 dark:hover:border-slate-700 transition"
                    aria-label={`Account menu for ${user.fullName}`}
                    aria-expanded={userDropdownOpen}
                  >
                    <UserAvatar
                      src={user.avatarUrl}
                      name={user.fullName}
                      size="md"
                    />
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 max-w-[100px] truncate">
                      {user.fullName.split(" ")[0]}
                    </span>
                  </button>

                  {userDropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95"
                      onMouseLeave={() => setUserDropdownOpen(false)}
                    >
                      <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2.5">
                        <UserAvatar src={user.avatarUrl} name={user.fullName} size="md" />
                        <div className="truncate">
                          <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {user.fullName}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate font-mono">
                            {user.email}
                          </p>
                        </div>
                      </div>

                      <Link
                        href="/account/orders"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                      >
                        <Package className="w-4 h-4 text-gray-400" />
                        My Orders &amp; Tracking
                      </Link>

                      <Link
                        href="/account/notifications"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                      >
                        <Bell className="w-4 h-4 text-gray-400" />
                        Notifications
                      </Link>

                      <Link
                        href="/account/profile"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                      >
                        <User className="w-4 h-4 text-gray-400" />
                        Profile &amp; Picture
                      </Link>

                      <Link
                        href="/account/security"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                      >
                        <Lock className="w-4 h-4 text-gray-400" />
                        Change Password
                      </Link>

                      {user.role === "admin" && (
                        <Link
                          href="/admin"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                        >
                          <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          Admin Console
                        </Link>
                      )}

                      <div className="border-t border-gray-100 dark:border-slate-800 my-1"></div>

                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* State C — Unauthenticated Desktop Actions */
                <div className="hidden sm:flex items-center gap-1.5">
                  <Link
                    href="/login"
                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/register"
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
                  >
                    Register
                  </Link>
                </div>
              )}

              {/* Mobile Menu Hamburger Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Over Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop Blur Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-over panel */}
          <div className="relative ml-auto w-full max-w-xs sm:max-w-sm h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col justify-between overflow-y-auto border-l border-gray-200 dark:border-slate-800 animate-in slide-in-from-right duration-200 z-10">
            {/* Drawer Header */}
            <div>
              <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-extrabold text-sm text-gray-900 dark:text-white block">
                      {shopBrand.shopName}
                    </span>
                    <span className="text-[10px] text-gray-400 block -mt-0.5">
                      Online Counter &amp; Services
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Identity or Quick Login Box (State-Aware) */}
              <div className="p-4 bg-gray-50 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-800">
                {authLoading ? (
                  <div className="flex items-center gap-3 animate-pulse" aria-label="Loading user profile">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700/70 shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="w-24 h-4 rounded bg-slate-200 dark:bg-slate-700/70" />
                      <div className="w-32 h-3 rounded bg-slate-200 dark:bg-slate-700/70" />
                    </div>
                  </div>
                ) : user ? (
                  <div className="flex items-center gap-3">
                    <UserAvatar src={user.avatarUrl} name={user.fullName} size="lg" />
                    <div className="truncate flex-1">
                      <span className="font-bold text-sm text-gray-900 dark:text-white block truncate">
                        {user.fullName}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 block truncate font-mono">
                        {user.email}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Sign in to track orders &amp; access saved addresses.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href="/login"
                        onClick={() => setMobileMenuOpen(false)}
                        className="py-2 px-3 text-center text-xs font-bold rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 shadow-sm"
                      >
                        Log In
                      </Link>
                      <Link
                        href="/register"
                        onClick={() => setMobileMenuOpen(false)}
                        className="py-2 px-3 text-center text-xs font-bold rounded-xl bg-blue-600 text-white shadow-sm"
                      >
                        Register
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Sections */}
              <div className="p-3 space-y-4">
                {/* Services Section */}
                <div>
                  <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-1">
                    Store &amp; Printing Services
                  </span>
                  <div className="space-y-0.5">
                    {navLinks.map((link) => {
                      const Icon = link.icon;
                      const active = isActive(link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                            active
                              ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-bold"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span>{link.label}</span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Account & Orders Section (when authenticated) */}
                {!authLoading && user && (
                  <div>
                    <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-1">
                      Account &amp; Orders
                    </span>
                    <div className="space-y-0.5">
                      <Link
                        href="/account/orders"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span>My Orders &amp; Tracking</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      </Link>

                      <Link
                        href="/account/notifications"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <Bell className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                          <span>Notifications</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      </Link>

                      <Link
                        href="/account/profile"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>Profile &amp; Picture</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      </Link>

                      <Link
                        href="/account/security"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span>Change Password</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      </Link>

                      {user.role === "admin" && (
                        <Link
                          href="/admin"
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 mt-1"
                        >
                          <div className="flex items-center gap-2.5">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Admin Console</span>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 space-y-3 bg-gray-50/50 dark:bg-slate-950/40">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Theme Mode</span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  {theme === "dark" ? (
                    <>
                      <Sun className="w-4 h-4 text-amber-400" /> Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 text-gray-600" /> Dark Mode
                    </>
                  )}
                </button>
              </div>

              {!authLoading && user && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 font-bold text-xs border border-rose-200 dark:border-rose-900 flex items-center justify-center gap-1.5 transition"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
