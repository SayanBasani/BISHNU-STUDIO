"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatINR, formatDate } from "@/lib/utils";
import {
  RotateCcw,
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Truck,
  DollarSign,
  Package,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Save,
  Send,
  Boxes,
  ShieldCheck,
  Check,
  X,
  CreditCard,
  Building,
  Eye,
  FileCheck,
  Archive,
  CheckCircle,
  ShieldAlert,
  ArrowUpRight,
  Ban,
  RefreshCw,
} from "lucide-react";

export default function AdminReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const returnId = params?.id as string;

  const [returnRecord, setReturnRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states - Physical Workflow
  const [status, setStatus] = useState("");
  const [allowedPhysicalTransitions, setAllowedPhysicalTransitions] = useState<string[]>([]);
  const [rejectionReason, setRejectionReason] = useState("");
  const [pickupMethod, setPickupMethod] = useState("courier_pickup");
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [deliveryPersonName, setDeliveryPersonName] = useState("");
  const [deliveryPersonPhone, setDeliveryPersonPhone] = useState("");
  const [expectedPickupDate, setExpectedPickupDate] = useState("");
  const [customerInstructions, setCustomerInstructions] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [inspectionResult, setInspectionResult] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");

  // Form states - Financial Refund Workflow
  const [refundStatus, setRefundStatus] = useState("pending_review");
  const [allowedRefundTransitions, setAllowedRefundTransitions] = useState<string[]>([]);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundMethod, setRefundMethod] = useState("upi");
  const [refundTransactionReference, setRefundTransactionReference] = useState("");
  const [refundProofUrl, setRefundProofUrl] = useState("");
  const [restockInventory, setRestockInventory] = useState(false);
  const [allowAdminOverride, setAllowAdminOverride] = useState(false);

  // Exchange state
  const [replacementOrderId, setReplacementOrderId] = useState("");
  const [exchangeStatus, setExchangeStatus] = useState("requested");
  const [exchangePriceDifference, setExchangePriceDifference] = useState(0);
  const [exchangeNotes, setExchangeNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Modals & Explicit Settlement Action States
  const [isConfirmPayoutOpen, setIsConfirmPayoutOpen] = useState(false);
  const [modalPayoutAmount, setModalPayoutAmount] = useState<number>(0);
  const [modalPayoutMethod, setModalPayoutMethod] = useState("upi");
  const [modalPayoutRef, setModalPayoutRef] = useState("");
  const [modalPayoutProof, setModalPayoutProof] = useState("");
  const [modalPayoutTimestamp, setModalPayoutTimestamp] = useState("");
  const [modalConfirmChecked, setModalConfirmChecked] = useState(false);

  const [isPayoutFailedOpen, setIsPayoutFailedOpen] = useState(false);
  const [payoutFailureReasonInput, setPayoutFailureReasonInput] = useState("");

  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (returnId) fetchReturnDetail();
  }, [returnId]);

  const fetchReturnDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/returns/${returnId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load return details");

      const ret = data.returnRecord;
      setReturnRecord(ret);
      setStatus(ret.status);
      setAllowedPhysicalTransitions(ret.allowedPhysicalTransitions || []);
      setRejectionReason(ret.rejectionReason || "");
      setPickupMethod(ret.pickupMethod || "courier_pickup");
      setCourierName(ret.courierName || "");
      setTrackingNumber(ret.trackingNumber || "");
      setTrackingUrl(ret.trackingUrl || "");
      setDeliveryPersonName(ret.deliveryPersonName || "");
      setDeliveryPersonPhone(ret.deliveryPersonPhone || "");
      setExpectedPickupDate(ret.expectedPickupDate || "");
      setCustomerInstructions(ret.customerInstructions || "");
      setInternalNotes(ret.internalNotes || "");
      setInspectionResult(ret.inspectionResult || "");
      setInspectionNotes(ret.inspectionNotes || "");

      setRefundStatus(ret.refundStatus || "pending_review");
      setAllowedRefundTransitions(ret.allowedRefundTransitions || []);
      setRefundAmount(ret.refundAmount || 0);
      setRefundMethod(ret.refundMethod || "upi");
      setRefundTransactionReference(ret.refundTransactionReference || "");
      setRefundProofUrl(ret.refundProofUrl || "");
      setReplacementOrderId(ret.replacementOrderId || "");
      setExchangeStatus(ret.exchangeStatus || "requested");
      setExchangePriceDifference(ret.exchangePriceDifference || 0);
      setExchangeNotes(ret.exchangeNotes || "");
      setRestockInventory(false);

      // Preload modal inputs
      setModalPayoutAmount(ret.refundAmount || 0);
      setModalPayoutMethod(ret.refundMethod || "upi");
      setModalPayoutRef(ret.refundTransactionReference || "");
      setModalPayoutProof(ret.refundProofUrl || "");
      setModalPayoutTimestamp(new Date().toISOString().slice(0, 16));
    } catch (err: any) {
      setError(err?.message || "Error loading return");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRefund = async () => {
    if (!confirm("Are you sure you want to approve this refund request?")) return;
    setActionLoading(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/returns/${returnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_refund" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve refund");
      setSaveSuccess("Refund approved successfully!");
      await fetchReturnDetail();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPayoutInitiated = async () => {
    if (!confirm("Record that payout transfer has been initiated in your banking portal? Note: This records that transfer was initiated, not yet paid.")) return;
    setActionLoading(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/returns/${returnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_payout_initiated",
          refundMethod,
          refundTransactionReference: refundTransactionReference.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payout initiation");
      setSaveSuccess("Payout initiation recorded. Payout status marked as in-transfer.");
      await fetchReturnDetail();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPayoutCompleted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalConfirmChecked) {
      setFormError("You must check the confirmation checkbox to explicitly confirm refund payout completion.");
      return;
    }
    if (!modalPayoutRef.trim()) {
      setFormError("A verified Bank UTR, UPI reference, or Cash voucher number is mandatory.");
      return;
    }
    if (!modalPayoutProof.trim()) {
      setFormError("A proof receipt URL or screenshot is mandatory to verify payout completion.");
      return;
    }

    setActionLoading(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/returns/${returnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_payout_completed",
          refundAmount: Number(modalPayoutAmount) || returnRecord.refundAmount,
          refundMethod: modalPayoutMethod,
          refundTransactionReference: modalPayoutRef.trim(),
          refundProofUrl: modalPayoutProof.trim(),
          payoutTimestamp: modalPayoutTimestamp ? new Date(modalPayoutTimestamp).getTime() : Date.now(),
          confirmationChecked: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to confirm refund payout");
      setSaveSuccess("Refund payout confirmed and settled as Paid!");
      setIsConfirmPayoutOpen(false);
      await fetchReturnDetail();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPayoutFailed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutFailureReasonInput.trim()) {
      setFormError("A clear failure reason is mandatory.");
      return;
    }

    setActionLoading(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/returns/${returnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_payout_failed",
          payoutFailureReason: payoutFailureReasonInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payout failure");
      setSaveSuccess("Payout failure recorded. Refund kept unpaid for retry.");
      setIsPayoutFailedOpen(false);
      await fetchReturnDetail();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleArchive = async () => {
    const isCurrentlyArchived = Boolean(returnRecord.isArchived);
    const targetAction = isCurrentlyArchived ? "unarchive_case" : "archive_case";
    if (!confirm(isCurrentlyArchived ? "Unarchive this return case?" : "Archive this return case? This preserves all evidence and marks the case archived.")) return;

    setActionLoading(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/returns/${returnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: targetAction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change archive status");
      setSaveSuccess(isCurrentlyArchived ? "Case unarchived successfully!" : "Case archived successfully!");
      await fetchReturnDetail();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setFormError(null);

    if (status === "rejected" && !rejectionReason.trim()) {
      setFormError("A rejection reason is mandatory when setting physical return status to Rejected.");
      setSaving(false);
      return;
    }

    if (refundStatus === "paid" && !refundTransactionReference.trim()) {
      setFormError("A verified payout transaction reference (UTR, UPI reference, or Cash voucher number) is required when marking refund as Paid.");
      setSaving(false);
      return;
    }

    if (refundStatus === "paid" && !refundProofUrl.trim() && !allowAdminOverride) {
      setFormError("A verified payout proof URL or signed receipt image is required when marking refund as Paid.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/returns/${returnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          refundStatus,
          rejectionReason: rejectionReason.trim() || null,
          pickupMethod,
          courierName: courierName.trim() || null,
          trackingNumber: trackingNumber.trim() || null,
          trackingUrl: trackingUrl.trim() || null,
          deliveryPersonName: deliveryPersonName.trim() || null,
          deliveryPersonPhone: deliveryPersonPhone.trim() || null,
          expectedPickupDate: expectedPickupDate.trim() || null,
          customerInstructions: customerInstructions.trim() || null,
          internalNotes: internalNotes.trim() || null,
          inspectionResult: inspectionResult || null,
          inspectionNotes: inspectionNotes.trim() || null,
          refundAmount: Number(refundAmount) || null,
          refundMethod: refundMethod || null,
          refundTransactionReference: refundTransactionReference.trim() || null,
          refundProofUrl: refundProofUrl.trim() || null,
          replacementOrderId: replacementOrderId.trim() || null,
          exchangeStatus: exchangeStatus || null,
          exchangePriceDifference: Number(exchangePriceDifference) || 0,
          exchangeNotes: exchangeNotes.trim() || null,
          restockInventory,
          allowAdminOverride,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update return");
      }

      setSaveSuccess("Return workflow and refund settlement updated successfully!");
      await fetchReturnDetail();
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err: any) {
      setFormError(err?.message || "Failed to save return updates");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span>Loading return inspector...</span>
      </div>
    );
  }

  if (error || !returnRecord) {
    return (
      <div className="p-10 text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Return Record Not Found</h2>
        <p className="text-xs text-slate-500">{error || "Unable to locate this return reference."}</p>
        <Link
          href="/admin/returns"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Returns Queue
        </Link>
      </div>
    );
  }

  // All possible physical statuses for display/override (generalized terminology)
  const allPhysicalStatuses = [
    { value: "requested", label: "Requested (Customer Initial Request)" },
    { value: "under_review", label: "Under Review" },
    { value: "approved", label: "Approved (Ready for Pickup / Dropoff)" },
    { value: "pickup_scheduled", label: "Pickup Scheduled with Courier" },
    { value: "picked_up", label: "Items Picked Up by Courier" },
    { value: "counter_dropoff", label: "Items Dropped Off at Counter" },
    { value: "in_transit", label: "In Transit" },
    { value: "received_at_studio", label: "Received at Return Location" },
    { value: "inspection_in_progress", label: "Inspection in Progress" },
    { value: "inspection_passed", label: "Inspection Passed (Condition Verified)" },
    { value: "inspection_failed", label: "Inspection Failed (Item Damaged)" },
    { value: "return_completed", label: "Return Completed & Archived" },
    { value: "rejected", label: "Rejected (Requires Reason)" },
    { value: "cancelled", label: "Cancelled" },
    { value: "pickup_failed", label: "Pickup Attempt Failed" },
  ];

  // Dynamic filter for physical status options
  const physicalOptions = allowAdminOverride
    ? allPhysicalStatuses
    : allPhysicalStatuses.filter(
        (opt) => opt.value === returnRecord.status || allowedPhysicalTransitions.includes(opt.value)
      );

  // All possible refund settlement statuses - 'paid' is strictly executed via Record Refund Payment action
  const allRefundStatuses = [
    { value: "pending_review", label: "Pending Review (Awaiting Inspection)" },
    { value: "approved", label: "Approved (Awaiting Payout Execution)" },
    { value: "awaiting_payout", label: "Awaiting Payout Execution" },
    { value: "pending_payout", label: "Awaiting Payout Execution" },
    { value: "payout_initiated", label: "Payout Initiated via Bank/UPI" },
    ...(allowAdminOverride ? [{ value: "paid", label: "Paid & Settled (Administrative Override)" }] : []),
    { value: "not_eligible", label: "Not Eligible (Declined / Failed Condition)" },
    { value: "disputed", label: "Disputed by Customer" },
    { value: "failed", label: "Payout Transfer Failed" },
    { value: "cancelled", label: "Refund Cancelled" },
  ];

  const refundOptions = allowAdminOverride
    ? allRefundStatuses
    : allRefundStatuses.filter(
        (opt) => opt.value === returnRecord.refundStatus || allowedRefundTransitions.includes(opt.value)
      );

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header & Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <Link
            href="/admin/returns"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-purple-600 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Returns Queue
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {returnRecord.returnReference}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                returnRecord.status === "return_completed" || returnRecord.status === "completed"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200"
                  : returnRecord.status === "rejected" || returnRecord.status === "cancelled"
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200"
                  : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200"
              }`}
            >
              Physical: {returnRecord.status?.replace(/_/g, " ")}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                returnRecord.refundStatus === "paid"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200"
                  : returnRecord.refundStatus === "payout_failed"
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200"
                  : returnRecord.refundStatus === "disputed"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200"
                  : returnRecord.refundStatus === "not_eligible"
                  ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200"
              }`}
            >
              Refund: {(returnRecord.refundStatus || "pending_review").replace(/_/g, " ")}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                returnRecord.caseEvaluation?.isCaseClosed
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200"
              }`}
            >
              Case: {returnRecord.caseEvaluation?.caseStatusLabel || "Open / In Progress"}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                returnRecord.isArchived
                  ? "bg-slate-700 text-slate-200 border border-slate-600"
                  : "bg-purple-950 text-purple-300 border border-purple-800"
              }`}
            >
              {returnRecord.isArchived ? "Archived" : "Active Case"}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Requested on {formatDate(returnRecord.createdAt)} • Original Order:{" "}
            <Link
              href={`/admin/orders/${returnRecord.orderId}`}
              className="text-purple-600 hover:underline font-mono font-bold"
            >
              #{returnRecord.order?.orderReference || returnRecord.orderId}
            </Link>
          </p>
        </div>

        {saveSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}
      </div>

      {/* Explicit Settlement & Action Controls Bar */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-purple-400" />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">
              Administrative Settlement Actions
            </h4>
            <p className="text-[11px] text-slate-400">
              Audit-logged financial state transitions with explicit confirmation.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Approve Refund */}
          {(returnRecord.refundStatus === "pending_review" || !returnRecord.refundStatus) && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleApproveRefund}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> Approve Refund
            </button>
          )}

          {/* 2. Record Payout Initiated */}
          {returnRecord.refundStatus !== "paid" && returnRecord.refundStatus !== "cancelled" && returnRecord.refundStatus !== "not_eligible" && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleRecordPayoutInitiated}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Clock className="w-3.5 h-3.5" /> Record Payout Initiated
            </button>
          )}

          {/* 3. Confirm Refund Paid / Payout Completed */}
          {returnRecord.refundStatus !== "paid" && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => {
                setModalPayoutAmount(returnRecord.refundAmount || 0);
                setModalPayoutMethod(returnRecord.refundMethod || "upi");
                setModalPayoutRef(returnRecord.refundTransactionReference || "");
                setModalPayoutProof(returnRecord.refundProofUrl || "");
                setModalConfirmChecked(false);
                setIsConfirmPayoutOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50 shadow-md shadow-emerald-950/40"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Confirm Refund Paid
            </button>
          )}

          {/* 4. Record Payout Failed */}
          {returnRecord.refundStatus !== "paid" && (returnRecord.refundStatus === "payout_initiated" || returnRecord.refundStatus === "awaiting_payout") && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => {
                setPayoutFailureReasonInput("");
                setIsPayoutFailedOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Ban className="w-3.5 h-3.5" /> Record Payout Failed
            </button>
          )}

          {/* 5. Archive / Unarchive */}
          <button
            type="button"
            disabled={actionLoading}
            onClick={handleToggleArchive}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50 ${
              returnRecord.isArchived
                ? "bg-slate-700 hover:bg-slate-600 text-slate-200"
                : "bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-700"
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            {returnRecord.isArchived ? "Unarchive Case" : "Archive Case"}
          </button>
        </div>
      </div>

      {/* Disputed Alert Banner */}
      {returnRecord.refundStatus === "disputed" && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-amber-900 dark:text-amber-200">
              URGENT: Customer Has Disputed This Refund Payout
            </h4>
            <p className="text-amber-800 dark:text-amber-300">
              <strong>Reported Reason:</strong> &ldquo;{returnRecord.refundDisputeReason || "Payment not credited to customer bank account."}&rdquo;
            </p>
            {returnRecord.refundDisputedAt && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-mono">
                Disputed at: {new Date(returnRecord.refundDisputedAt).toLocaleString("en-IN")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Form Error Banner */}
      {formError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Grid: Context & Items (Left) vs Controller Actions Form (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Context, Return Items, Customer Explanation */}
        <div className="lg:col-span-6 space-y-6">
          {/* Customer & Destination Context */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-purple-600" /> Customer &amp; Refund Destination
            </h3>

            <div className="grid grid-cols-2 gap-3 text-slate-600 dark:text-slate-300">
              <div>
                <span className="text-slate-400 block text-[11px]">Customer Name:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {returnRecord.customer?.fullName || "Registered Customer"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Contact Phone:</span>
                <span className="font-mono text-slate-900 dark:text-white">
                  {returnRecord.customer?.phone || "—"}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block text-[11px]">Email Address:</span>
                <span className="font-mono text-slate-900 dark:text-white">
                  {returnRecord.customer?.email || "—"}
                </span>
              </div>
            </div>

            {/* Customer Refund Preference & Bank/UPI details */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <span className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" /> Customer Refund Channel Preference
              </span>

              {returnRecord.refundDestination ? (
                <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 text-slate-700 dark:text-slate-300 space-y-1">
                  {returnRecord.refundDestination.upiId && (
                    <p>
                      <strong>UPI ID:</strong>{" "}
                      <span className="font-mono font-bold text-purple-700 dark:text-purple-300">
                        {returnRecord.refundDestination.upiId}
                      </span>
                    </p>
                  )}
                  {returnRecord.refundDestination.accountHolderName && (
                    <p>
                      <strong>Account Holder:</strong> {returnRecord.refundDestination.accountHolderName}
                    </p>
                  )}
                  {returnRecord.refundDestination.accountNumber && (
                    <p>
                      <strong>Account Number (Masked):</strong>{" "}
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {returnRecord.refundDestination.accountNumber}
                      </span>
                    </p>
                  )}
                  {returnRecord.refundDestination.ifsc && (
                    <p>
                      <strong>IFSC Code:</strong>{" "}
                      <span className="font-mono">{returnRecord.refundDestination.ifsc}</span>
                    </p>
                  )}
                  {returnRecord.refundDestination.bankName && (
                    <p>
                      <strong>Bank Name:</strong> {returnRecord.refundDestination.bankName}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500 italic">
                  Customer selected standard method: <strong className="uppercase">{returnRecord.refundMethod || "UPI"}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Requested Items Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-600" /> Items for Return
            </h3>

            <div className="space-y-3">
              {returnRecord.items?.map((item: any) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {item.productName || "Catalog Product / Service Item"}
                    </p>
                    <span className="text-[11px] text-slate-400">
                      Unit Snapshot: {formatINR(item.unitPriceSnapshot)} • Qty to return: {item.quantity}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatINR(item.totalPriceSnapshot)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-bold text-sm">
              <span>Total Eligible Refund:</span>
              <span className="text-purple-600 dark:text-purple-400 font-extrabold text-base">
                {formatINR(returnRecord.refundAmount || 0)}
              </span>
            </div>
          </div>

          {/* Customer Explanation & Evidence Photos */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              Customer Explanation &amp; Reason
            </h3>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Reason Category:</span>
                <span className="font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950">
                  {returnRecord.reason?.replace(/_/g, " ")}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 leading-relaxed">
                {returnRecord.customerDescription}
              </div>
            </div>

            {returnRecord.evidenceUrls && returnRecord.evidenceUrls.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">
                  Customer Uploaded Evidence Photos:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {returnRecord.evidenceUrls.map((url: string, i: number) => (
                    <img
                      key={i}
                      src={url}
                      alt="Return evidence"
                      onClick={() => setPreviewImage(url)}
                      className="w-full h-20 object-cover rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Workflow Actions, Courier, Inspection, and Refund Form */}
        <div className="lg:col-span-6 space-y-6">
          <form
            onSubmit={handleSaveReturn}
            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-600" />
                Return Workflow &amp; Refund Settlement
              </h3>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAdminOverride}
                  onChange={(e) => setAllowAdminOverride(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span>Admin Override</span>
              </label>
            </div>

            {/* WORKFLOW 1: Physical Return Lifecycle */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-purple-600" />
                1. Physical Return Workflow Stage
              </span>

              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Current Status: <strong className="uppercase text-purple-600">{returnRecord.status.replace(/_/g, " ")}</strong>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500"
                >
                  {physicalOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {!allowAdminOverride && physicalOptions.length <= 1 && (
                  <p className="text-[10px] text-slate-400 italic">
                    Physical return is in a terminal stage. Enable Admin Override to force-change.
                  </p>
                )}
              </div>

              {/* Rejection Reason (Mandatory if rejected) */}
              {status === "rejected" && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-1.5">
                  <label className="block font-bold text-rose-900 dark:text-rose-200">
                    Rejection Reason (Mandatory - Displayed to Customer) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="e.g. Return request is outside the 7-day policy window..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              )}

              {/* Pickup / Courier Logistics Assignment */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pickup Logistics Partner
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DTDC, Delhivery, Staff Associate"
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pickup AWB / Tracking Ref
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. RET-AWB-10482"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Direct Courier Tracking Link (URL)
                  </label>
                  <input
                    type="url"
                    placeholder="https://track.dtdc.com/..."
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pickup Person Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Suresh Das"
                    value={deliveryPersonName}
                    onChange={(e) => setDeliveryPersonName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expected Pickup Date
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tomorrow by 2 PM"
                    value={expectedPickupDate}
                    onChange={(e) => setExpectedPickupDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              </div>

              {/* Physical Inspection Outcome */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Physical Quality Inspection
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <select
                      value={inspectionResult}
                      onChange={(e) => setInspectionResult(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white text-xs"
                    >
                      <option value="">Pending Inspection</option>
                      <option value="passed">Inspection Passed</option>
                      <option value="partial">Partial Pass</option>
                      <option value="failed">Inspection Failed</option>
                    </select>
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Inspection notes (e.g. sealed tag intact)"
                      value={inspectionNotes}
                      onChange={(e) => setInspectionNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* WORKFLOW 2: Financial Refund Settlement Workflow */}
            <div className="p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" />
                  2. Financial Refund Settlement Workflow
                </span>
                {returnRecord.refundStatus === "paid" && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                    Paid &amp; Settled
                  </span>
                )}
              </div>

              {returnRecord.refundStatus === "paid" && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Refund Disbursed and Locked
                  </p>
                  <p>
                    UTR/Reference: <strong className="font-mono">{returnRecord.refundTransactionReference}</strong>
                    {returnRecord.refundDisbursedAt && ` • Paid on ${new Date(returnRecord.refundDisbursedAt).toLocaleDateString("en-IN")}`}
                  </p>
                  {returnRecord.refundProofUrl && (
                    <a
                      href={returnRecord.refundProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 hover:underline pt-0.5"
                    >
                      <Eye className="w-3 h-3" /> View Verified Payout Proof Receipt
                    </a>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Refund Settlement Stage *
                </label>
                <select
                  value={refundStatus}
                  onChange={(e) => setRefundStatus(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500"
                >
                  {refundOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Disbursed Refund Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Disbursement Channel
                  </label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white text-xs"
                  >
                    <option value="upi">Direct UPI Transfer</option>
                    <option value="bank_transfer">NEFT / IMPS Bank Transfer</option>
                    <option value="cash">Counter Cash Refund</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bank / UPI / Cash Voucher Reference (UTR #) *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 12-digit UTR, UPI transaction ref, or signed cash voucher #"
                    value={refundTransactionReference}
                    onChange={(e) => setRefundTransactionReference(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white text-xs"
                  />
                  <p className="text-[10px] text-purple-700 dark:text-purple-400 mt-1">
                    Must be unique. Deduplicated across all system transactions to guarantee idempotency.
                  </p>
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Refund Payout Proof Image / Receipt (URL)
                  </label>
                  <input
                    type="url"
                    placeholder="https://... (screenshot of UPI transfer, bank statement entry, or signed cash slip)"
                    value={refundProofUrl}
                    onChange={(e) => setRefundProofUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                  />
                  {refundProofUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewImage(refundProofUrl)}
                        className="px-2.5 py-1 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-semibold text-[11px] flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> Preview Payout Proof
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* WORKFLOW 2.5: Exchange & Replacement Logistics */}
            {returnRecord.requestedResolution === "exchange" && (
              <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4" />
                    Exchange &amp; Replacement Item Workflow
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 uppercase">
                    {exchangeStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Exchange Stage *
                    </label>
                    <select
                      value={exchangeStatus}
                      onChange={(e) => setExchangeStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white text-xs"
                    >
                      <option value="requested">Exchange Requested</option>
                      <option value="under_review">Under Review</option>
                      <option value="approved">Exchange Approved</option>
                      <option value="replacement_created">Replacement Order Created</option>
                      <option value="dispatched">Replacement Dispatched</option>
                      <option value="completed">Exchange Completed</option>
                      <option value="rejected">Exchange Declined</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Replacement Order ID / Reference
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ord_xxx or EXC-202610-01"
                      value={replacementOrderId}
                      onChange={(e) => setReplacementOrderId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Price Difference Adjustment (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={exchangePriceDifference}
                      onChange={(e) => setExchangePriceDifference(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Exchange Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Swapped for Size L Navy Blue"
                      value={exchangeNotes}
                      onChange={(e) => setExchangeNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Inventory Restocking Control */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-purple-600" />
                  3. Catalog Inventory Restocking
                </span>
                {returnRecord.restocked && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                    Already Restocked
                  </span>
                )}
              </div>

              {returnRecord.restocked ? (
                <p className="text-[11px] text-slate-500">
                  Item quantities from this return were already restocked to catalog inventory. Duplicate restocking is prevented.
                </p>
              ) : (
                <label className="flex items-center gap-2 font-semibold text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restockInventory}
                    onChange={(e) => setRestockInventory(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Restock approved items back to catalog inventory upon saving</span>
                </label>
              )}
            </div>

            {/* Customer-Facing vs Internal Notes */}
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-blue-900 dark:text-blue-300 mb-1">
                  Customer-Facing Instructions (Public to Customer)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Please keep item packaged with original accessories for associate pickup..."
                  value={customerInstructions}
                  onChange={(e) => setCustomerInstructions(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-purple-900 dark:text-purple-300 mb-1">
                  Internal Staff Notes (PRIVATE &bull; Staff Eyes Only)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Verified with supervisor, refund approved via bank transfer..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-md shadow-purple-600/20"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving Return Updates...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Return Updates &amp; Settlement
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Confirm Refund Paid / Payout Completed Modal */}
      {isConfirmPayoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Confirm Refund Paid &amp; Payout Completed
              </h3>
              <button
                type="button"
                onClick={() => setIsConfirmPayoutOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              This action explicitly marks the refund as <strong>Paid</strong> and settles the transaction. Payout transaction reference and verified proof receipt are mandatory.
            </p>

            <form onSubmit={handleConfirmPayoutCompleted} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Actual Amount Disbursed (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={modalPayoutAmount}
                    onChange={(e) => setModalPayoutAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Disbursement Channel *
                  </label>
                  <select
                    value={modalPayoutMethod}
                    onChange={(e) => setModalPayoutMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="upi">UPI Direct Transfer</option>
                    <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="cash">Counter Cash Slip</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bank UTR / UPI Ref / Cash Voucher # *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 12-digit UTR, UPI transaction ref, or signed cash voucher #"
                    value={modalPayoutRef}
                    onChange={(e) => setModalPayoutRef(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payout Proof Receipt URL *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://... (screenshot of successful UPI payout or bank transfer voucher)"
                    value={modalPayoutProof}
                    onChange={(e) => setModalPayoutProof(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payout Completion Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={modalPayoutTimestamp}
                    onChange={(e) => setModalPayoutTimestamp(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={modalConfirmChecked}
                    onChange={(e) => setModalConfirmChecked(e.target.checked)}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-[11px] font-semibold text-purple-950 dark:text-purple-200 leading-tight">
                    I explicitly confirm that ₹{modalPayoutAmount} has actually cleared our payment portal and been disbursed to the customer.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsConfirmPayoutOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>Finalize &amp; Record as Paid</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payout Failed Modal */}
      {isPayoutFailedOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-600" />
                Record Payout Failure
              </h3>
              <button
                type="button"
                onClick={() => setIsPayoutFailedOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-bold">Kept Unpaid &amp; Retryable</p>
              <p className="text-[11px]">
                Recording payout failure keeps the return record unpaid so finance staff can retry after correcting customer payment details.
              </p>
            </div>

            <form onSubmit={handleRecordPayoutFailed} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Failure Reason (Mandatory) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Beneficiary VPA not active, Bank server timeout, or invalid account number..."
                  value={payoutFailureReasonInput}
                  onChange={(e) => setPayoutFailureReasonInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPayoutFailedOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                  <span>Save Payout Failure</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewImage}
              alt="Evidence preview"
              className="w-full max-h-[80vh] object-contain rounded-2xl bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
}
