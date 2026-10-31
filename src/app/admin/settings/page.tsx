"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Settings,
  Store,
  Phone,
  Mail,
  MapPin,
  Clock,
  Shield,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Copy,
  Server,
  Database,
  Lock,
  DollarSign,
  Truck,
  ExternalLink,
  Code2,
  AlertTriangle,
  Trash2,
  ShieldAlert,
  Eye,
  EyeOff,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";

export default function AdminSettingsPage() {
  const [copiedHashCmd, setCopiedHashCmd] = useState(false);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Development Cleanup States
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupStep, setCleanupStep] = useState<1 | 2>(1);
  const [cleanupPreview, setCleanupPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [cleanupPassword, setCleanupPassword] = useState("");
  const [showCleanupPassword, setShowCleanupPassword] = useState(false);
  const [cleanupConfirmation, setCleanupConfirmation] = useState("");
  const [wiping, setWiping] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);

  const hashCommand = `node -e "console.log(require('bcryptjs').hashSync('YourStrongPasswordHere', 10))"`;

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(hashCommand);
    setCopiedHashCmd(true);
    setTimeout(() => setCopiedHashCmd(false), 2000);
  };

  const openCleanupModal = async () => {
    setShowCleanupModal(true);
    setCleanupStep(1);
    setCleanupError(null);
    setCleanupResult(null);
    setCleanupPassword("");
    setCleanupConfirmation("");
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/admin/dev-cleanup/preview");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load cleanup preview");
      }
      setCleanupPreview(data);
    } catch (err: any) {
      setCleanupError(err.message || "Failed to load preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteWipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cleanupConfirmation !== "WIPE DEVELOPMENT DATA") {
      setCleanupError("Confirmation phrase must exactly match 'WIPE DEVELOPMENT DATA'");
      return;
    }
    if (!cleanupPassword) {
      setCleanupError("Please enter your administrator password.");
      return;
    }
    setWiping(true);
    setCleanupError(null);
    try {
      const res = await fetch("/api/admin/dev-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: cleanupPassword,
          confirmation: cleanupConfirmation,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to wipe development data");
      }
      setCleanupResult(data);
    } catch (err: any) {
      setCleanupError(err.message || "Wipe execution failed");
    } finally {
      setWiping(false);
    }
  };

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) {
          setShopSettings(data.settings);
        }
      })
      .catch((err) => {
        console.error("Failed to load settings:", err);
      })
      .finally(() => {
        setLoadingSettings(false);
      });
  }, []);

  const shopName = shopSettings?.shopName || "Bishnu Studio";
  const building = shopSettings?.building || "12/B Station Road";
  const street = shopSettings?.street || "Main Market";
  const landmark = shopSettings?.landmark || "Near Town Hall & Central Post Office";
  const cityTown = shopSettings?.cityTown || "Barasat";
  const state = shopSettings?.state || "West Bengal";
  const pinCode = shopSettings?.pinCode || "700001";
  const contactPhone = shopSettings?.contactPhone || "+91 98765 43210";
  const contactEmail = shopSettings?.contactEmail || "support@bishnustudio.com";
  const upiId = shopSettings?.upiId || "bishnustudio@icici";
  const openingHours =
    shopSettings?.openingHours ||
    "Mon - Fri: 8:00 AM - 9:30 PM | Sat: 8:00 AM - 10:00 PM | Sun: 10:00 AM - 4:00 PM";

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          Store Settings &amp; System Configuration
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Shop operational details, counter hours, owner credential security, dynamic service pricing, and computing environment guidelines
        </p>
      </div>

      {/* Quick Action Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Link
          href="/admin/settings/business"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500 shadow-sm transition group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:underline">
              Edit &rarr;
            </span>
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-3">
            Shop Address &amp; Profile
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Store counter street address, contact phone, support email, and operational hours.
          </p>
        </Link>

        <Link
          href="/admin/settings/payments"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500 shadow-sm transition group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:underline">
              Configure &rarr;
            </span>
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-3">
            UPI Payments &amp; QR Codes
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure shop UPI ID, dynamic vs standee QR mode, and checkout preview.
          </p>
        </Link>

        <Link
          href="/admin/pricing"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500 shadow-sm transition group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-300 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 group-hover:underline">
              Manage &rarr;
            </span>
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-3">
            Printing Service Pricing
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Database-backed rates for PVC cards, document printing, lamination, and photo studio.
          </p>
        </Link>

        <Link
          href="/admin/settings/database"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500 shadow-sm transition group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:underline">
              Configure &rarr;
            </span>
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-3">
            Database &amp; Storage Architecture
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Dual Neon PostgreSQL primary &amp; LibSQL fallback, fencing tokens, outbox sync &amp; failover.
          </p>
        </Link>

        <Link
          href="/admin/settings/security"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500 shadow-sm transition group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">
              Security &rarr;
            </span>
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-3">
            Admin Profile &amp; Password
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Admin avatar upload/removal, rotate credentials with database persistence.
          </p>
        </Link>

        <Link
          href="/admin/settings/developer"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500 shadow-sm transition group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-300 flex items-center justify-center">
              <Code2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 group-hover:underline">
              Credits &rarr;
            </span>
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-3">
            Developer &amp; Credits
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Public developer profile, project contributions, skills, and authorship credits.
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Business Profile, Hours & Delivery */}
        <div className="lg:col-span-7 space-y-6">
          {/* Business Profile */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Business Profile
              </h2>
              <Link
                href="/admin/settings/business"
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
              >
                Edit Profile <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold block">
                  Official Store Name
                </span>
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {shopName}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold block">
                  Physical Counter Address
                </span>
                <p className="font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                  {building ? `${building}, ` : ""}
                  {street ? `${street}, ` : ""}
                  {landmark ? `${landmark}, ` : ""}
                  {cityTown}, {state} - {pinCode}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold block">
                    Contact Phone
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {contactPhone}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold block">
                    Customer Support Email
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {contactEmail}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold block">
                  Store UPI ID (For Counter &amp; Checkout QR)
                </span>
                <span className="font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-800/80 px-2.5 py-1 rounded-lg inline-block mt-0.5">
                  {upiId}
                </span>
              </div>
            </div>
          </div>

          {/* Operating Hours */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Store Counter Operating Hours
              </h2>
              <Link
                href="/admin/settings/business"
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
              >
                Update Timings <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Monday &ndash; Friday</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">8:00 AM &ndash; 9:30 PM</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Saturday</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">8:00 AM &ndash; 10:00 PM</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Sunday</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">10:00 AM &ndash; 4:00 PM</span>
              </div>
              <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold">Configured Schedule: </span>
                <span className="font-medium">{openingHours}</span>
              </div>
            </div>
          </div>

          {/* Delivery Threshold Charges */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
              <Truck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Delivery Threshold &amp; Charges
            </h2>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                &bull; <strong className="text-slate-900 dark:text-white">Store Pickup:</strong> 100% Free for all printing jobs and products. Orders are securely staged at the physical counter for self-collection.
              </p>
              <p>
                &bull; <strong className="text-slate-900 dark:text-white">Home Delivery:</strong> Free on orders ₹500 and above. Orders below ₹500 carry a nominal ₹40 delivery and protective moisture-proof packaging fee.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Computing Environment & System Diagnostics */}
        <div className="lg:col-span-5 space-y-6">
          {/* Owner Credentials & Computing Environment */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 text-purple-600 dark:text-purple-400 border-b border-slate-100 dark:border-slate-800 pb-3">
              <KeyRound className="w-5 h-5" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Owner Credentials &amp; Compute Environment</h2>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Admin authentication is strictly server-side verified against environment variables defined in <code className="text-purple-700 dark:text-purple-300 font-bold bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800/60">.env.local</code> (or deployment hosting environment variables).
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                  Configured Variable Names
                </span>
                <p className="font-mono text-purple-700 dark:text-purple-300 font-bold">ADMIN_EMAIL</p>
                <p className="font-mono text-purple-700 dark:text-purple-300 font-bold">ADMIN_PASSWORD</p>
                <p className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">or ADMIN_PASSWORD_HASH</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                  Password Rotation Procedure
                </span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  To rotate your admin password securely, generate a bcrypt hash and update <code className="text-purple-700 dark:text-purple-300 font-bold">ADMIN_PASSWORD_HASH</code> in your deployment environment, or use the dedicated Security panel.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                Generate Bcrypt Hash Command:
              </span>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 font-mono text-[11px] text-purple-700 dark:text-purple-300 flex items-center justify-between border border-slate-200 dark:border-slate-800">
                <span className="truncate pr-2">{hashCommand}</span>
                <button
                  type="button"
                  onClick={handleCopyCmd}
                  className="p-1 hover:text-slate-900 dark:hover:text-white shrink-0 text-slate-400 transition"
                  title="Copy command"
                >
                  {copiedHashCmd ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* System Diagnostics */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              System Diagnostics
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">Database Driver:</span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                  Neon PostgreSQL + LibSQL (Dual Architecture)
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">Storage Driver:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  Local Disk + S3 / R2 Compatible
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">Max Upload Limit:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  25 MB (Documents) / 10 MB (Photos)
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">Pricing Engine:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  Authoritative Database Rates
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">Database Status:</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded text-[10px]">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Online &amp; Operational
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DANGER ZONE: Development Data Management */}
      <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-200/60 dark:border-rose-900/40 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Danger Zone: Development Data Cleanup
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  Development Only
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Permanently purge dummy development orders, customer accounts, payment submissions, and sandbox files. Administrative credentials, database schema migrations, and default catalog baseline remain strictly preserved.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCleanupModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm hover:shadow transition shrink-0 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Wipe Development Data
          </button>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Requires administrator password re-authentication and typing confirmation phrase. Strictly forbidden in production environments.</span>
        </div>
      </div>

      {/* Two-Step Wipe Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    Wipe Development Database & Files
                  </h3>
                  <span className="text-xs text-slate-400">
                    Step {cleanupStep} of 2: {cleanupStep === 1 ? "Impact & Scope Preview" : "Authorization & Confirmation"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCleanupModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error or Success notification */}
            {cleanupError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{cleanupError}</span>
              </div>
            )}

            {cleanupResult ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-extrabold text-sm text-emerald-900 dark:text-emerald-100">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Wipe Completed Successfully
                  </div>
                  <p>{cleanupResult.message}</p>
                </div>

                {cleanupResult.deleted && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {Object.entries(cleanupResult.deleted).map(([key, val]) => (
                      <div
                        key={key}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center"
                      >
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          {key.replace(/([A-Z])/g, " $1")}
                        </span>
                        <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                          {String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCleanupModal(false);
                      window.location.reload();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-sm"
                  >
                    Done & Refresh Dashboard
                  </button>
                </div>
              </div>
            ) : cleanupStep === 1 ? (
              <div className="space-y-4">
                {loadingPreview ? (
                  <div className="py-12 text-center space-y-2">
                    <Loader2 className="w-8 h-8 text-rose-600 animate-spin mx-auto" />
                    <p className="text-xs text-slate-400 font-medium">Scanning development records & files...</p>
                  </div>
                ) : cleanupPreview ? (
                  <>
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        Records and Files To Be Purged:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-center">
                          <span className="text-[10px] uppercase font-bold text-rose-500 block">Customers</span>
                          <span className="text-base font-black font-mono text-rose-700 dark:text-rose-300">
                            {cleanupPreview.counts?.customers ?? 0}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-center">
                          <span className="text-[10px] uppercase font-bold text-rose-500 block">Orders</span>
                          <span className="text-base font-black font-mono text-rose-700 dark:text-rose-300">
                            {cleanupPreview.counts?.orders ?? 0}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-center">
                          <span className="text-[10px] uppercase font-bold text-rose-500 block">Order Items</span>
                          <span className="text-base font-black font-mono text-rose-700 dark:text-rose-300">
                            {cleanupPreview.counts?.orderItems ?? 0}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-center">
                          <span className="text-[10px] uppercase font-bold text-rose-500 block">Uploaded Files</span>
                          <span className="text-base font-black font-mono text-rose-700 dark:text-rose-300">
                            {cleanupPreview.counts?.uploadedFiles ?? 0}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Payment Claims</span>
                          <span className="text-base font-black font-mono text-slate-800 dark:text-slate-200">
                            {cleanupPreview.counts?.paymentSubmissions ?? 0}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Payments</span>
                          <span className="text-base font-black font-mono text-slate-800 dark:text-slate-200">
                            {cleanupPreview.counts?.payments ?? 0}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Reviews</span>
                          <span className="text-base font-black font-mono text-slate-800 dark:text-slate-200">
                            {cleanupPreview.counts?.productReviews ?? 0}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Notifications</span>
                          <span className="text-base font-black font-mono text-slate-800 dark:text-slate-200">
                            {cleanupPreview.counts?.notifications ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs space-y-1.5">
                      <span className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Guaranteed Preserved Baseline Assets:
                      </span>
                      <ul className="list-disc list-inside text-emerald-800 dark:text-emerald-300 text-[11px] space-y-0.5">
                        {cleanupPreview.preserved?.map((p: string, i: number) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-2 flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => setShowCleanupModal(false)}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCleanupError(null);
                          setCleanupStep(2);
                        }}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition"
                      >
                        Proceed to Authorization &rarr;
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : (
              <form onSubmit={handleExecuteWipe} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    IRREVERSIBLE ACTION WARNING
                  </div>
                  <p>
                    All sandbox customer records, delivery orders, uploaded production PDFs/photos, and payment verification claims will be permanently deleted.
                  </p>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Administrator Password (Re-authentication)
                  </label>
                  <div className="relative">
                    <input
                      type={showCleanupPassword ? "text" : "password"}
                      value={cleanupPassword}
                      onChange={(e) => setCleanupPassword(e.target.value)}
                      placeholder="Enter your admin password"
                      required
                      className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCleanupPassword(!showCleanupPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                    >
                      {showCleanupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Typed confirmation input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Type <code className="font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/40 px-1 py-0.5 rounded">WIPE DEVELOPMENT DATA</code> to confirm:
                  </label>
                  <input
                    type="text"
                    value={cleanupConfirmation}
                    onChange={(e) => setCleanupConfirmation(e.target.value)}
                    placeholder="WIPE DEVELOPMENT DATA"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <button
                    type="button"
                    disabled={wiping}
                    onClick={() => setCleanupStep(1)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    &larr; Back to Scope
                  </button>
                  <button
                    type="submit"
                    disabled={wiping || cleanupConfirmation !== "WIPE DEVELOPMENT DATA" || !cleanupPassword}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm transition"
                  >
                    {wiping ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Purging Data & Files...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Permanently Wipe Development Data
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
