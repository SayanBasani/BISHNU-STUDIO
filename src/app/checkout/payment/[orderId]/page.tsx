"use strict";
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  QrCode,
  Copy,
  Check,
  Upload,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  FileText,
  RotateCcw,
  Smartphone,
  ChevronRight,
  HelpCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

interface OrderInfo {
  id: string;
  orderReference: string;
  totalAmount: number;
  paymentStatus: string;
  paymentMethod: string;
  orderStatus: string;
  deliveryType: string;
  createdAt: number;
}

interface PaymentConfig {
  upiEnabled: boolean;
  merchantName: string;
  upiId: string;
  accountDisplayName?: string;
  receivingAccountId?: string;
  receivingAccountLabel?: string;
  qrMode: "generated_upi_id" | "uploaded_image";
  qrCodeDataUrl: string | null;
  upiUri: string | null;
  upiAppLinks?: {
    universal: string;
    gpay: string;
    phonepe: string;
    paytm: string;
  } | null;
  paymentInstructions: string | null;
}

interface PaymentSubmission {
  id: string;
  orderId: string;
  amount: number;
  paymentMethod: string;
  upiIdUsed: string;
  transactionId: string;
  screenshotFileId: string | null;
  screenshotUrl: string | null;
  status: "pending_verification" | "verified" | "rejected" | "expired" | "review_required";
  submissionType?: "standard" | "post_cancellation_claim" | null;
  isDuplicateFlagged?: boolean;
  duplicateNotes?: string | null;
  rejectionReason: string | null;
  rejectionNote: string | null;
  verifiedAt: number | null;
  verificationNote: string | null;
  attemptNumber: number;
  createdAt: number;
}

export default function CheckoutPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.orderId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [latestSubmission, setLatestSubmission] = useState<PaymentSubmission | null>(null);
  const [submissionsHistory, setSubmissionsHistory] = useState<PaymentSubmission[]>([]);
  const [canReportPayment, setCanReportPayment] = useState(false);

  // Form State
  const [transactionId, setTransactionId] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [stagedFileId, setStagedFileId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [showResubmitForm, setShowResubmitForm] = useState(false);
  const [appLaunched, setAppLaunched] = useState(false);
  const [showBankLimitHelp, setShowBankLimitHelp] = useState(false);

  const fetchPaymentDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/orders/${orderId}/payment`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load payment details.");
      }

      setOrder(data.order);
      setConfig(data.paymentConfig);
      setLatestSubmission(data.latestSubmission);
      setSubmissionsHistory(data.submissionsHistory || []);
      setCanReportPayment(Boolean(data.canReportPayment));
    } catch (err: any) {
      setError(err?.message || "Failed to load order payment information.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchPaymentDetails();
    }
  }, [orderId]);

  const handleCopyUpi = () => {
    if (!config?.upiId) return;
    navigator.clipboard.writeText(config.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleCopyAmount = () => {
    if (!order?.totalAmount) return;
    navigator.clipboard.writeText(order.totalAmount.toFixed(2));
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFormError("Only image files (JPEG, PNG, WebP) are accepted for payment screenshot.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError("Screenshot image size must be under 10MB.");
      return;
    }

    setFormError(null);
    setScreenshotFile(file);
    setStagedFileId(null); // Reset staged file since new image was chosen
    const previewUrl = URL.createObjectURL(file);
    setScreenshotPreview(previewUrl);
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanTrId = transactionId.trim().replace(/\s+/g, "").toUpperCase();
    if (!cleanTrId) {
      setFormError("Please enter your 12-digit UPI Transaction / UTR Number.");
      return;
    }

    if (cleanTrId.length < 8 || cleanTrId.length > 30) {
      setFormError("Transaction ID must be between 8 and 30 characters.");
      return;
    }

    if (!screenshotFile && !stagedFileId) {
      setFormError("Please select and upload your payment confirmation screenshot.");
      return;
    }

    setIsUploading(true);

    try {
      let fileId = stagedFileId;

      // Step 1: Upload the screenshot file if not already staged
      if (!fileId && screenshotFile) {
        const uploadFormData = new FormData();
        uploadFormData.append("file", screenshotFile);
        uploadFormData.append("category", "payment_proof");

        const uploadRes = await fetch("/api/files/upload", {
          method: "POST",
          body: uploadFormData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "Failed to upload payment screenshot.");
        }

        fileId = uploadData.file.fileId;
        setStagedFileId(fileId); // Staged safely for partial-write recovery
      }

      // Step 2: Submit payment proof with transaction ID and file ID
      const submitRes = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: cleanTrId,
          screenshotFileId: fileId,
          idempotencyKey: `sub_${orderId}_${cleanTrId}`,
        }),
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        throw new Error(submitData.error || "Failed to submit payment proof.");
      }

      // Success! Reset form and refresh details
      setScreenshotFile(null);
      setScreenshotPreview(null);
      setStagedFileId(null);
      setTransactionId("");
      setShowResubmitForm(false);
      setAppLaunched(false);
      await fetchPaymentDetails();
    } catch (err: any) {
      setFormError(err?.message || "Failed to submit payment proof. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
          Loading secure UPI payment details...
        </p>
      </div>
    );
  }

  if (error || !order || !config) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Unable to Load Payment</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {error || "Order not found or you do not have permission to view this payment page."}
        </p>
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition"
        >
          View My Orders
        </Link>
      </div>
    );
  }

  const isVerified = order.paymentStatus === "paid" || latestSubmission?.status === "verified";
  const isReviewRequired =
    latestSubmission?.status === "review_required" || order.paymentStatus === "review_required";
  const isPending =
    latestSubmission?.status === "pending_verification" && !isVerified && !isReviewRequired;
  const isRejected = latestSubmission?.status === "rejected" && !isVerified;
  const isCancelled = order.orderStatus === "cancelled";
  const canShowForm = !isVerified && (!isPending || showResubmitForm || isCancelled);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <Link href="/" className="hover:text-blue-600 transition">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/account/orders" className="hover:text-blue-600 transition">My Orders</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href={`/account/orders/${order.id}`} className="hover:text-blue-600 transition font-mono">
              {order.orderReference}
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-gray-900 dark:text-white font-semibold">Payment</span>
          </div>
          <Link
            href={`/account/orders/${order.id}`}
            className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-semibold"
          >
            Track Order Details <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Status Alert Banners */}
        {isVerified && (
          <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Payment Verified
                </span>
                <h2 className="text-lg font-bold text-emerald-950 dark:text-emerald-100">
                  Your UPI Payment has been confirmed!
                </h2>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1">
                  Thank you! Bishnu Studio has verified your payment of {formatINR(order.totalAmount)}. Your order is in production.
                </p>
                {latestSubmission?.transactionId && (
                  <p className="text-xs font-mono text-emerald-900 dark:text-emerald-200 mt-2">
                    UTR: {latestSubmission.transactionId}
                  </p>
                )}
              </div>
            </div>
            <Link
              href={`/account/orders/${order.id}`}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition text-center shrink-0"
            >
              Track Order Status
            </Link>
          </div>
        )}

        {isReviewRequired && !isVerified && (
          <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 shadow-sm space-y-3">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Payment Under Investigation
                </span>
                <h2 className="text-lg font-bold text-amber-950 dark:text-amber-100">
                  {isCancelled
                    ? "Payment Reported for Cancelled Order — Under Review"
                    : "Payment Outcome Requires Investigation"}
                </h2>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90">
                  {isCancelled
                    ? "You reported a payment transfer for this cancelled order. Our shop administrator is reviewing bank records. Please do not make another transfer."
                    : "Your transaction reference was flagged for standard verification against our bank statement. Our team is actively reviewing your payment."}
                </p>
              </div>
            </div>

            {latestSubmission?.transactionId && (
              <div className="p-3 bg-white/70 dark:bg-slate-900/70 rounded-xl border border-amber-100 dark:border-amber-900/60 text-xs">
                <span className="text-gray-500 dark:text-gray-400">Claimed Reference (UTR):</span>{" "}
                <span className="font-mono font-bold text-gray-900 dark:text-white">
                  {latestSubmission.transactionId}
                </span>
              </div>
            )}
          </div>
        )}

        {isPending && (
          <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 shadow-sm space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                <Clock className="w-7 h-7 animate-pulse" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Pending Verification
                </span>
                <h2 className="text-lg font-bold text-amber-950 dark:text-amber-100">
                  Payment Proof Submitted & Under Review
                </h2>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90">
                  Our shop admin is verifying your payment with our bank records. Once verified, your order status will automatically advance to Confirmed.
                </p>
              </div>
            </div>

            <div className="bg-white/70 dark:bg-slate-900/70 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-gray-500 dark:text-gray-400 block">Transaction Reference / UTR</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">{latestSubmission?.transactionId}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 block">Submitted At</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {latestSubmission?.createdAt ? new Date(latestSubmission.createdAt).toLocaleString("en-IN") : "Just now"}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 block">Amount Claimed</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{formatINR(order.totalAmount)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowResubmitForm(!showResubmitForm)}
                className="text-xs font-semibold text-amber-900 dark:text-amber-300 hover:underline flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {showResubmitForm ? "Hide resubmission form" : "Entered incorrect UTR? Submit updated proof"}
              </button>

              <Link
                href={`/account/orders/${order.id}`}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                View Order Details <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {isRejected && !showResubmitForm && (
          <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 shadow-sm space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-600/20">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                  Payment Verification Rejected
                </span>
                <h2 className="text-lg font-bold text-rose-950 dark:text-rose-100">
                  We could not verify your payment proof
                </h2>
                <div className="text-xs text-rose-900 dark:text-rose-200 space-y-1 mt-2 p-3 bg-white/70 dark:bg-slate-900/70 rounded-xl border border-rose-200 dark:border-rose-900">
                  <p>
                    <strong>Reason:</strong> {latestSubmission?.rejectionReason?.replace(/_/g, " ") || "Verification failed"}
                  </p>
                  {latestSubmission?.rejectionNote && (
                    <p>
                      <strong>Shop Note:</strong> {latestSubmission.rejectionNote}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowResubmitForm(true)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Resubmit Payment Proof
              </button>
              <Link
                href={`/account/orders/${order.id}`}
                className="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:underline"
              >
                Back to Order
              </Link>
            </div>
          </div>
        )}

        {/* Customer return guidance when UPI app was opened */}
        {appLaunched && !isVerified && !isPending && (
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Returned from your UPI application?</span>
              <p className="mt-0.5">
                If your payment was completed, save your payment receipt screenshot and copy the 12-digit <strong>UPI Ref ID / UTR</strong>. Submit both below so Bishnu Studio can verify your payment and confirm your order.
              </p>
            </div>
          </div>
        )}

        {/* Main Grid: Payment Instruction & QR (Left) vs Proof Submission Form (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: QR Code & UPI Details */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Official Shop Payment Gateway
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                  Pay with Any UPI App
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Scan the QR code with Google Pay, PhonePe, Paytm, BHIM, or any banking app.
                </p>
              </div>

              {/* Order Reference & Amount Card */}
              <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-blue-800 dark:text-blue-300 block">
                    Order Reference
                  </span>
                  <span className="font-mono font-bold text-base text-slate-900 dark:text-white">
                    {order.orderReference}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-blue-800 dark:text-blue-300 block">
                    Exact Payable Amount
                  </span>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="font-mono font-extrabold text-2xl text-blue-600 dark:text-blue-400">
                      {formatINR(order.totalAmount)}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAmount}
                      className="p-1 rounded text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition"
                      title="Copy Amount"
                    >
                      {copiedAmount ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                {config.qrCodeDataUrl ? (
                  <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-200">
                    <img
                      src={config.qrCodeDataUrl}
                      alt="Bishnu Studio UPI QR Code"
                      className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-56 h-56 sm:w-64 sm:h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                    <QrCode className="w-12 h-12 mb-2" />
                    <span className="text-xs">QR Code unavailable</span>
                  </div>
                )}

                <div className="text-center space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified Payee: {config.merchantName || "Bishnu Studio"}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Point your camera or UPI scanner at this QR code
                  </p>
                </div>
              </div>

              {/* Copyable UPI ID */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    {config.receivingAccountLabel || "Intended receiving UPI ID"} (Shown for this payment)
                  </label>
                  {config.accountDisplayName && (
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                      {config.accountDisplayName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 font-mono text-sm text-slate-900 dark:text-white font-bold select-all truncate">
                    {config.upiId}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 shrink-0 transition"
                  >
                    {copiedUpi ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> Copy UPI
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Mobile App Intent Launcher */}
              {config.upiUri && (
                <div className="pt-2 space-y-3">
                  <a
                    href={config.upiUri}
                    onClick={() => setAppLaunched(true)}
                    className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-[0.98] transition"
                  >
                    <Smartphone className="w-4 h-4" /> Pay with Installed UPI App
                  </a>

                  {/* Bank Limit Notice & Troubleshooting */}
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setShowBankLimitHelp(!showBankLimitHelp)}
                      className="w-full flex items-center justify-between font-bold text-left hover:underline text-amber-950 dark:text-amber-100"
                    >
                      <span className="flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        Getting "Bank Limit Exceeded" in Google Pay?
                      </span>
                      <span>{showBankLimitHelp ? "▲" : "▼"}</span>
                    </button>
                    {showBankLimitHelp && (
                      <div className="pt-1.5 text-[11px] leading-relaxed space-y-1.5 border-t border-amber-200 dark:border-amber-800/60 mt-1">
                        <p>
                          Certain banks (e.g. SBI, HDFC, ICICI) apply strict internal limits on web deep links for individual UPI IDs.
                        </p>
                        <p className="font-semibold">
                          ✅ Easy fix: Simply scan the QR code above directly from your UPI app camera, or copy our UPI ID (<strong>{config.upiId}</strong>) and pay manually. Scanning the QR code is never restricted by web intent limits!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step by Step Instructions */}
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  How to complete payment:
                </h3>
                <ol className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      1
                    </span>
                    <span>
                      Scan the QR code above using Google Pay, PhonePe, Paytm, or BHIM.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      2
                    </span>
                    <span>
                      Verify the exact order amount: <strong className="text-slate-900 dark:text-white">{formatINR(order.totalAmount)}</strong> and confirm the transfer.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      3
                    </span>
                    <span>
                      Save a screenshot of the completed payment receipt and copy the 12-digit <strong>UPI Ref ID / UTR</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      4
                    </span>
                    <span>
                      Submit the UTR and upload the screenshot in the verification form. Our shop verifies each transfer before confirmation.
                    </span>
                  </li>
                </ol>
              </div>

              {config.paymentInstructions && (
                <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <span className="font-bold block mb-1">Owner Remarks:</span>
                  <p>{config.paymentInstructions}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Proof Submission Form */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Verification Step
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {isCancelled ? "Report Completed Transfer" : "Submit Payment Evidence"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {isCancelled
                    ? "If you already sent money via UPI before this order was cancelled, submit your details for manual administrative review."
                    : "Manual verification is performed by Bishnu Studio against our bank statement before order confirmation."}
                </p>
              </div>

              {/* Notice */}
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-950 dark:text-amber-100">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  Authentic Verification Policy
                </div>
                <p className="text-[11px] leading-relaxed">
                  Your order is never marked as paid merely by clicking "Pay with UPI app" or opening a banking app. An administrator will verify the funds credit against our bank statement before moving your order into production.
                </p>
              </div>

              {canShowForm ? (
                <form onSubmit={handleSubmitProof} className="space-y-6">
                  {formError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Transaction ID / UTR Input */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      12-Digit UPI Transaction ID / UTR *
                    </label>
                    <input
                      type="text"
                      required
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
                      placeholder="e.g. 423512345678"
                      maxLength={30}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Found on your UPI confirmation receipt as UPI Ref No, UTR, or Transaction Reference.
                    </p>
                  </div>

                  {/* Screenshot Upload Control */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      Payment Screenshot Proof *
                    </label>

                    {!screenshotPreview && !stagedFileId ? (
                      <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition bg-slate-50 dark:bg-slate-950 group">
                        <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-500 transition mb-2" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Click to select payment screenshot
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          JPEG, PNG, or WebP up to 10MB
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    ) : (
                      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
                        {screenshotPreview && (
                          <div className="relative max-h-56 overflow-hidden rounded-xl bg-black/5 flex items-center justify-center">
                            <img
                              src={screenshotPreview}
                              alt="Payment Proof Preview"
                              className="max-h-52 w-auto object-contain rounded-lg"
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                            {screenshotFile ? screenshotFile.name : "Staged screenshot ready"}
                          </span>
                          <label className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-bold">
                            Change Image
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={handleFileChange}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isUploading || (!screenshotFile && !stagedFileId) || !transactionId.trim()}
                    className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Submitting Proof...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        {isCancelled ? "Submit Transfer Report for Review" : "Submit Payment Proof for Verification"}
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center space-y-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {isVerified ? "Payment Successfully Verified" : "Submission Recorded"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                      {isVerified
                        ? "Your order has been verified and confirmed by Bishnu Studio. You can now monitor the production progress."
                        : "Your payment submission is recorded. Our team will verify it with our bank statements shortly."}
                    </p>
                  </div>
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition"
                  >
                    Track Order Progress <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}

              {/* Submissions History (if multiple attempts) */}
              {submissionsHistory.length > 0 && (
                <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Submission History ({submissionsHistory.length})
                  </h3>
                  <div className="space-y-2">
                    {submissionsHistory.map((sub, idx) => (
                      <div
                        key={sub.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              Attempt #{submissionsHistory.length - idx}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                sub.status === "verified"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : sub.status === "rejected"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                  : sub.status === "review_required"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              }`}
                            >
                              {sub.status.replace("_", " ")}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-500 block mt-0.5">
                            UTR: {sub.transactionId}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(sub.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
