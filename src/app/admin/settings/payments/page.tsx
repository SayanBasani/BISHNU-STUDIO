"use strict";
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  Upload,
  RefreshCw,
  Save,
  ArrowLeft,
  ShieldCheck,
  Smartphone,
  Eye,
  Info,
} from "lucide-react";

export default function AdminPaymentSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [upiEnabled, setUpiEnabled] = useState(true);
  const [merchantName, setMerchantName] = useState("Bishnu Studio");
  const [upiId, setUpiId] = useState("bishnustudio@icici");
  const [qrMode, setQrMode] = useState<"generated" | "uploaded_image">("generated");
  const [uploadedQrImageUrl, setUploadedQrImageUrl] = useState<string | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState("");

  // Preview state
  const [previewQrUrl, setPreviewQrUrl] = useState<string | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load settings.");

      const s = data.settings;
      setUpiEnabled(s.upiEnabled ?? true);
      setMerchantName(s.merchantName || "Bishnu Studio");
      setUpiId(s.upiId || "bishnustudio@icici");
      setQrMode(s.qrMode || "generated");
      setUploadedQrImageUrl(s.uploadedQrImageUrl || null);
      setPaymentInstructions(s.paymentInstructions || "");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to load payment settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Fetch or generate live QR preview when upiId / qrMode changes
  useEffect(() => {
    if (qrMode === "uploaded_image" && uploadedQrImageUrl) {
      setPreviewQrUrl(uploadedQrImageUrl);
    } else if (upiId.trim()) {
      // In generated mode, fetch public shop settings to get generated QR data URL
      fetch("/api/settings/shop")
        .then((r) => r.json())
        .then((data) => {
          if (data.upi?.qrCodeDataUrl) {
            setPreviewQrUrl(data.upi.qrCodeDataUrl);
          }
        })
        .catch(() => {});
    }
  }, [upiId, qrMode, uploadedQrImageUrl]);

  const handleUploadQrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMsg("Please upload a valid image file (JPEG, PNG, WebP) for the QR code.");
      return;
    }

    setUploadingQr(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "product_image"); // public accessible image

      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload QR image.");

      const fileUrl = data.file.downloadUrl;
      setUploadedQrImageUrl(fileUrl);
      setPreviewQrUrl(fileUrl);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to upload QR code image.");
    } finally {
      setUploadingQr(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/settings/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upiEnabled,
          merchantName: merchantName.trim(),
          upiId: upiId.trim(),
          qrMode,
          uploadedQrImageUrl: uploadedQrImageUrl || undefined,
          paymentInstructions: paymentInstructions.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update UPI settings.");

      setSuccessMsg("UPI payment settings successfully updated and live on storefront!");
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchSettings();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save payment settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center gap-2">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
        <span>Loading UPI settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title & Navigation */}
      <div className="border-b border-gray-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
          <Link href="/admin/settings" className="hover:text-purple-600 transition flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Store Settings
          </Link>
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          <QrCode className="w-6 h-6 text-purple-600" />
          UPI Payment Gateway Configuration
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Configure the official shop UPI ID, select dynamic or static QR code mode, and customize customer payment instructions.
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

      <form onSubmit={handleSave} className="space-y-8">
        {/* Toggle UPI Payments Active */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-sm font-bold text-gray-900 dark:text-white block">
              Accept UPI Online Payments
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              When enabled, customers can select UPI QR payment during checkout and upload payment proof.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUpiEnabled(!upiEnabled)}
            className={`w-14 h-8 rounded-full transition-colors relative p-1 focus:outline-none ${
              upiEnabled ? "bg-purple-600" : "bg-gray-300 dark:bg-slate-700"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full bg-white transition-transform ${
                upiEnabled ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Core Configuration & Preview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Settings Form Controls (Left) */}
          <div className="md:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-3">
              UPI Account Parameters
            </h2>

            {/* Merchant Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                Merchant / Business Name *
              </label>
              <input
                type="text"
                required
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="e.g. Bishnu Studio"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-[11px] text-gray-400">
                Shown to customers as the recipient name in UPI apps (Google Pay, PhonePe, Paytm).
              </p>
            </div>

            {/* UPI ID */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                Store UPI Virtual Payment Address (VPA / UPI ID) *
              </label>
              <input
                type="text"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value.toLowerCase().trim())}
                placeholder="e.g. bishnustudio@icici"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white font-mono font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-[11px] text-gray-400">
                Must be a valid UPI handle format (e.g. yourname@okhdfcbank, shop@icici, mobile@paytm).
              </p>
            </div>

            {/* QR Code Mode Selector */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                QR Code Generation Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setQrMode("generated")}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    qrMode === "generated"
                      ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/40 ring-2 ring-purple-600/20"
                      : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600"
                  }`}
                >
                  <span className="font-bold text-xs text-gray-900 dark:text-white block mb-0.5">
                    Dynamic Generated QR
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block leading-tight">
                    Generates dynamic QR with order amount and order reference automatically prefilled.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setQrMode("uploaded_image")}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    qrMode === "uploaded_image"
                      ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/40 ring-2 ring-purple-600/20"
                      : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600"
                  }`}
                >
                  <span className="font-bold text-xs text-gray-900 dark:text-white block mb-0.5">
                    Uploaded Shop QR
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block leading-tight">
                    Display an image of your printed counter standee QR code.
                  </span>
                </button>
              </div>
            </div>

            {/* Upload Shop QR (when mode === uploaded_image) */}
            {qrMode === "uploaded_image" && (
              <div className="space-y-2 pt-2 animate-in fade-in">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Upload Counter QR Code Image
                </label>
                <div className="flex items-center gap-4">
                  <label className="px-4 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 hover:bg-purple-100 font-bold text-xs cursor-pointer border border-purple-200 dark:border-purple-800 transition flex items-center gap-1.5">
                    <Upload className="w-4 h-4" />
                    {uploadingQr ? "Uploading..." : "Select QR Image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleUploadQrFile}
                    />
                  </label>
                  {uploadedQrImageUrl && (
                    <span className="text-xs text-emerald-600 font-medium">
                      ✓ Image uploaded
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Custom Payment Instructions */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                Custom Customer Guidance Instructions (Optional)
              </label>
              <textarea
                rows={3}
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                placeholder="e.g. Please mention your full name in the UPI transfer remarks or call our counter if facing issues."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Live Preview Panel (Right) */}
          <div className="md:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Eye className="w-4 h-4 text-purple-600" />
              Customer Checkout Preview
            </h2>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                {merchantName || "Bishnu Studio"}
              </div>

              {previewQrUrl ? (
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                  <img
                    src={previewQrUrl}
                    alt="UPI QR Code Preview"
                    className="w-44 h-44 object-contain"
                  />
                </div>
              ) : (
                <div className="w-44 h-44 bg-slate-200 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
                  <QrCode className="w-10 h-10" />
                </div>
              )}

              <div className="space-y-1 w-full">
                <span className="font-mono font-bold text-xs text-gray-900 dark:text-white block bg-slate-100 dark:bg-slate-800/80 px-3 py-1 rounded-lg truncate">
                  {upiId || "your_vpa@bank"}
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold block">
                  Mode: {qrMode === "generated" ? "Dynamic UPI Generator" : "Uploaded Image"}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-300 text-[11px] space-y-1">
              <span className="font-bold flex items-center gap-1">
                <Info className="w-3.5 h-3.5 shrink-0" /> How this works
              </span>
              <p>
                When a customer checks out, Bishnu Studio generates a unique UPI deep link pre-filled with the order total. After paying, customers upload their screenshot and 12-digit UTR for you to verify in the Admin Payments Queue.
              </p>
            </div>
          </div>
        </div>

        {/* Save Changes Button */}
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
                <RefreshCw className="w-4 h-4 animate-spin" /> Saving Settings...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save UPI Configuration
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
