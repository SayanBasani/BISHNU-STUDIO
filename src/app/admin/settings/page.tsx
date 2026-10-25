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
} from "lucide-react";

export default function AdminSettingsPage() {
  const [copiedHashCmd, setCopiedHashCmd] = useState(false);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const hashCommand = `node -e "console.log(require('bcryptjs').hashSync('YourStrongPasswordHere', 10))"`;

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(hashCommand);
    setCopiedHashCmd(true);
    setTimeout(() => setCopiedHashCmd(false), 2000);
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
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  LibSQL / Local SQLite (Turso Ready)
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
    </div>
  );
}
