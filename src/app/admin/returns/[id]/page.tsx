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
} from "lucide-react";

export default function AdminReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const returnId = params?.id as string;

  const [returnRecord, setReturnRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [status, setStatus] = useState("");
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
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundMethod, setRefundMethod] = useState("upi");
  const [refundTransactionReference, setRefundTransactionReference] = useState("");
  const [restockInventory, setRestockInventory] = useState(false);
  const [allowAdminOverride, setAllowAdminOverride] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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
      setRefundAmount(ret.refundAmount || 0);
      setRefundMethod(ret.refundMethod || "upi");
      setRefundTransactionReference(ret.refundTransactionReference || "");
      setRestockInventory(false); // Reset toggle for each fetch
    } catch (err: any) {
      setError(err?.message || "Error loading return");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);

    if (status === "rejected" && !rejectionReason.trim()) {
      alert("A rejection reason is mandatory when setting status to Rejected.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/returns/${returnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
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
          restockInventory,
          allowAdminOverride,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update return");

      setSaveSuccess("Return details, refund record, and inventory status saved successfully!");
      await fetchReturnDetail();
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      alert(err?.message || "Failed to save return updates");
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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {returnRecord.returnReference}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                returnRecord.status === "completed" || returnRecord.status === "refund_processed"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200"
                  : returnRecord.status === "rejected"
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200"
                  : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200"
              }`}
            >
              {returnRecord.status.replace(/_/g, " ")}
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

      {/* Grid: Context & Items (Left) vs Controller Actions Form (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Context, Return Items, Customer Explanation */}
        <div className="lg:col-span-6 space-y-6">
          {/* Customer & Order Context */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-purple-600" /> Customer Information
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
            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-purple-600" />
              Manage Return Workflow &amp; Resolution
            </h3>

            {/* Stage Selector */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                1. Return Stage Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500"
              >
                <option value="requested">Requested (Under Evaluation)</option>
                <option value="under_review">Under Review by Studio Staff</option>
                <option value="approved">Approved (Awaiting Pickup Assignment)</option>
                <option value="pickup_scheduled">Pickup Scheduled</option>
                <option value="in_transit">In Transit to Studio</option>
                <option value="received">Return Received at Counter</option>
                <option value="inspection_in_progress">Inspection in Progress</option>
                <option value="refund_pending">Inspection Passed &bull; Refund Pending</option>
                <option value="refund_processed">Refund Processed (UTR Recorded)</option>
                <option value="exchange_processing">Exchange Processing</option>
                <option value="completed">Completed &amp; Closed</option>
                <option value="rejected">Rejected (Requires Reason Below)</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Rejection Reason (Mandatory if rejected) */}
            {status === "rejected" && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-1.5 animate-in fade-in">
                <label className="block font-bold text-rose-900 dark:text-rose-200">
                  Rejection Reason (Mandatory - Displayed to Customer) *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Return request is outside the 7-day policy window, or custom-produced smart card has no manufacturing defect..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                />
              </div>
            )}

            {/* Pickup / Courier Logistics Assignment */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-purple-600" />
                2. Pickup Logistics &amp; Courier Assignment
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pickup Logistics Partner
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DTDC, Delhivery, Studio Associate"
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
            </div>

            {/* Quality Inspection Result */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-purple-600" />
                3. Physical Inspection Result
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Inspection Outcome
                  </label>
                  <select
                    value={inspectionResult}
                    onChange={(e) => setInspectionResult(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white text-xs"
                  >
                    <option value="">Not Inspected Yet</option>
                    <option value="passed">Inspection Passed (Item in returnable condition)</option>
                    <option value="partial">Partial Pass (Minor wear / partial refund)</option>
                    <option value="failed">Inspection Failed (Customer induced damage)</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Inspection Staff Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Verified defective sensor / package unopened..."
                    value={inspectionNotes}
                    onChange={(e) => setInspectionNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Refund Settlement Recording */}
            <div className="p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-3">
              <span className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" />
                4. Verified Refund Settlement
              </span>

              <div className="grid grid-cols-2 gap-3">
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
                    Bank / UPI Refund Reference (UTR #)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 12-digit UTR reference from bank statement"
                    value={refundTransactionReference}
                    onChange={(e) => setRefundTransactionReference(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white text-xs"
                  />
                  <p className="text-[10px] text-purple-700 dark:text-purple-400 mt-1">
                    Enter the genuine bank reference number once the refund transfer has completed.
                  </p>
                </div>
              </div>
            </div>

            {/* Idempotent Inventory Restocking Control (Phase 6.6) */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-purple-600" />
                  5. Catalog Inventory Restocking
                </span>
                {returnRecord.restocked && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                    Already Restocked
                  </span>
                )}
              </div>

              {returnRecord.restocked ? (
                <p className="text-[11px] text-slate-500">
                  Item quantities from this return were previously restocked to catalog inventory. Duplicate restocking is blocked.
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
                  placeholder="e.g. Verified with manufacturer, warranty claim filed #W-8492..."
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

      {/* Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-2xl w-full">
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
