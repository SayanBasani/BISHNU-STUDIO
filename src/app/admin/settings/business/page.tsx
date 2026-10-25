"use strict";
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Store,
  MapPin,
  Phone,
  Mail,
  Clock,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Image,
  Power,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

export default function AdminBusinessSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Fields
  const [shopName, setShopName] = useState("Bishnu Studio");
  const [logoUrl, setLogoUrl] = useState("/logo.png");
  const [isOpen, setIsOpen] = useState(true);
  const [closedMessage, setClosedMessage] = useState(
    "We are currently closed for new orders. Store browsing and existing order tracking remain active."
  );
  const [returnWindowDays, setReturnWindowDays] = useState(7);
  const [returnPolicyNotice, setReturnPolicyNotice] = useState(
    "Items can be returned within 7 days of delivery. Custom printed documents and smart cards are non-returnable once produced."
  );

  const [building, setBuilding] = useState("12/B Station Road");
  const [street, setStreet] = useState("Main Market, Near Railway Crossing");
  const [landmark, setLandmark] = useState("Opposite Town Post Office");
  const [city, setCity] = useState("Barasat");
  const [state, setState] = useState("West Bengal");
  const [pinCode, setPinCode] = useState("700001");
  const [contactPhone, setContactPhone] = useState("+91 98765 43210");
  const [contactEmail, setContactEmail] = useState("support@bishnustudio.com");
  const [openingHours, setOpeningHours] = useState(
    "Mon - Sat: 9:00 AM - 9:00 PM | Sun: 10:00 AM - 6:00 PM"
  );

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load shop details.");

      const s = data.settings;
      setShopName(s.shopName || "Bishnu Studio");
      setLogoUrl(s.logoUrl || "/logo.png");
      setIsOpen(s.isOpen !== undefined ? Boolean(s.isOpen) : true);
      setClosedMessage(
        s.closedMessage ||
          "We are currently closed for new orders. Store browsing and existing order tracking remain active."
      );
      setReturnWindowDays(s.returnWindowDays !== undefined ? Number(s.returnWindowDays) : 7);
      setReturnPolicyNotice(
        s.returnPolicyNotice ||
          "Items can be returned within 7 days of delivery. Custom printed documents and smart cards are non-returnable once produced."
      );
      setBuilding(s.building || "");
      setStreet(s.street || "");
      setLandmark(s.landmark || "");
      setCity(s.cityTown || s.city || "");
      setState(s.state || "West Bengal");
      setPinCode(s.pinCode || "");
      setContactPhone(s.contactPhone || "");
      setContactEmail(s.contactEmail || "");
      setOpeningHours(s.openingHours || "");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to load business profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/settings/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: shopName.trim(),
          logoUrl: logoUrl.trim() || undefined,
          isOpen,
          closedMessage: closedMessage.trim(),
          returnWindowDays: Number(returnWindowDays),
          returnPolicyNotice: returnPolicyNotice.trim(),
          building: building.trim(),
          street: street.trim(),
          landmark: landmark.trim() || undefined,
          cityTown: city.trim(),
          state: state.trim(),
          pinCode: pinCode.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim(),
          openingHours: openingHours.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update business details.");

      setSuccessMsg(
        "Business profile, store availability, and branding updated successfully! Changes are live across storefront."
      );
      setTimeout(() => setSuccessMsg(null), 5000);
      await fetchSettings();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save business settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center gap-2">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
        <span>Loading store profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title & Navigation */}
      <div className="border-b border-gray-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
          <Link
            href="/admin/settings"
            className="hover:text-purple-600 transition flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Store Settings
          </Link>
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          <Store className="w-6 h-6 text-purple-600" />
          Shop Profile, Brand Identity &amp; Availability
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Manage your business branding, open/closed operation status, return policy, and physical counter address.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2 shadow-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Store Availability Card (Open / Closed Manual Override) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Power className="w-4 h-4 text-purple-600" />
                Store Availability &amp; Order Acceptance
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Authoritative manual override. When closed, product browsing remains functional, but new checkouts are blocked.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  isOpen
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                  }`}
                />
                {isOpen ? "Store is OPEN" : "Store is CLOSED"}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="font-bold text-xs text-slate-900 dark:text-white block">
                Store Open Toggle
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isOpen
                  ? "Customers can browse, upload files, and place orders normally."
                  : "Customers are informed that new orders are temporarily halted."}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                isOpen
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              {isOpen ? "Mark Store as CLOSED" : "Mark Store as OPEN"}
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
              Customer-Facing Closed Notice
            </label>
            <textarea
              rows={2}
              value={closedMessage}
              onChange={(e) => setClosedMessage(e.target.value)}
              placeholder="Notice displayed across storefront and checkout when closed..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              This message appears on the homepage counter card and prevents order checkout submissions.
            </p>
          </div>
        </div>

        {/* Basic Brand Info & Logo */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-3 flex items-center gap-2">
            <Store className="w-4 h-4 text-purple-600" />
            Official Brand &amp; Logo Configuration
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                Official Business Name *
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Bishnu Studio"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Authoritative brand name displayed across Header, Footer, Hero, Invoices, and Checkout.
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5 text-gray-400" /> Logo Public Path or URL
              </label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="/logo.png or https://your-cdn.com/logo.png"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Provide a public relative path (e.g. <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">/logo.png</code>) or an HTTPS URL. Filesystem paths like <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">C:\...</code> are strictly disallowed.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-gray-400" /> Contact Phone Number *
              </label>
              <input
                type="text"
                required
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" /> Support Email Address *
              </label>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="support@bishnustudio.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" /> Counter Timings &amp; Operational Hours *
              </label>
              <input
                type="text"
                required
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                placeholder="Mon - Sat: 9:00 AM - 9:00 PM | Sun: 10:00 AM - 6:00 PM"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Return & Refund Policies */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-3 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-purple-600" />
            Return &amp; Refund Policy Configuration
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                Return Eligibility Window (Days) *
              </label>
              <input
                type="number"
                min={0}
                max={90}
                required
                value={returnWindowDays}
                onChange={(e) => setReturnWindowDays(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Number of calendar days after order delivery during which customers can request returns.
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                Customer Return Notice &amp; Exclusions
              </label>
              <textarea
                rows={2}
                value={returnPolicyNotice}
                onChange={(e) => setReturnPolicyNotice(e.target.value)}
                placeholder="Policy notice shown on return request modals..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
              />
            </div>
          </div>
        </div>

        {/* Physical Address Details */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-purple-600" />
            Physical Studio / Shop Address
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                Building, Shop No., Floor *
              </label>
              <input
                type="text"
                required
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="e.g. 12/B Station Road, Ground Floor"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                Street, Area, Market, Locality *
              </label>
              <input
                type="text"
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="e.g. Main Market, Near Railway Crossing"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                Landmark (Optional)
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Opposite Town Post Office"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                City / Town *
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Barasat"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                State *
              </label>
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="West Bengal"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                PIN Code *
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="700001"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/admin/settings"
            className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/25 transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Saving Details...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Business Profile
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
