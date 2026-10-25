"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatINR, formatDate } from "@/lib/utils";
import {
  Package,
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  Truck,
  ShoppingBag,
  CreditCard,
  FileText,
  Download,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Save,
  Send,
  Eye,
  X,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit states for fulfillment & payment
  const [orderStatus, setOrderStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [deliveryPersonName, setDeliveryPersonName] = useState("");
  const [deliveryPersonPhone, setDeliveryPersonPhone] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [customerFulfillmentNote, setCustomerFulfillmentNote] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [allowAdminOverride, setAllowAdminOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Copy feedback states
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Image lightbox
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) fetchOrderDetail();
  }, [orderId]);

  const fetchOrderDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load order details");
      }
      const ord = data.order;
      setOrder(ord);
      setOrderStatus(ord.orderStatus);
      setPaymentStatus(ord.paymentStatus);
      setCourierName(ord.courierName || "");
      setTrackingNumber(ord.trackingNumber || "");
      setTrackingUrl(ord.trackingUrl || "");
      setDeliveryPersonName(ord.deliveryPersonName || "");
      setDeliveryPersonPhone(ord.deliveryPersonPhone || "");
      setExpectedDeliveryDate(ord.expectedDeliveryDate || "");
      setCustomerFulfillmentNote(ord.customerFulfillmentNote || "");
      setInternalNotes(ord.internalNotes || "");
    } catch (err: any) {
      setError(err?.message || "Error loading order");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFulfillment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderStatus,
          paymentStatus,
          courierName: courierName.trim() || null,
          trackingNumber: trackingNumber.trim() || null,
          trackingUrl: trackingUrl.trim() || null,
          deliveryPersonName: deliveryPersonName.trim() || null,
          deliveryPersonPhone: deliveryPersonPhone.trim() || null,
          expectedDeliveryDate: expectedDeliveryDate.trim() || null,
          customerFulfillmentNote: customerFulfillmentNote.trim() || null,
          internalNotes: internalNotes.trim() || null,
          allowAdminOverride,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update order");

      setSaveSuccess("Order fulfillment details successfully saved!");
      await fetchOrderDetail();
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      alert(err?.message || "Failed to save order");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "processing":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
      case "ready_for_collection":
        return "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800";
      case "out_for_delivery":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "completed":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "cancelled":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "pending":
      case "pending_verification":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "unpaid":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  if (loading) {
    return (
      <div className="py-32 text-center">
        <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-3">
          Loading order details...
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h2 className="text-lg font-bold text-rose-900 dark:text-rose-200">
            {error || "Order Not Found"}
          </h2>
          <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
            The requested order ID may not exist or you lack permission to view it.
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Orders List
        </Link>
      </div>
    );
  }

  const isPickup = order.deliveryType === "store_pickup";
  const isAddressMissing = order.isAddressMissing;
  const addr = order.shippingAddress;
  const submissions = order.paymentSubmissions || [];
  const latestSubmission = order.latestPaymentSubmission;

  // Format courier-ready address block
  const formattedAddressText = addr
    ? [
        addr.recipientName || order.customer?.fullName,
        addr.recipientPhone || order.customer?.phone ? `Phone: +91 ${addr.recipientPhone || order.customer?.phone}` : null,
        addr.houseBuilding,
        addr.streetLocality,
        addr.landmark ? `Landmark: ${addr.landmark}` : null,
        `${addr.cityTown}, ${addr.state} - ${addr.pinCode}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Orders
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {order.orderReference}
            </h1>
            <span
              className={`inline-flex items-center font-bold capitalize px-3 py-0.5 rounded-full text-xs border ${getStatusBadge(
                order.orderStatus
              )}`}
            >
              {order.orderStatus.replace(/_/g, " ")}
            </span>
            <span
              className={`inline-flex items-center font-bold capitalize px-3 py-0.5 rounded-full text-xs border ${getPaymentBadge(
                order.paymentStatus
              )}`}
            >
              Payment: {order.paymentStatus}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Placed on {formatDate(order.createdAt)} • Last updated on {formatDate(order.updatedAt)}
          </p>
        </div>

        <button
          onClick={fetchOrderDetail}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reload Details
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {saveSuccess}
        </div>
      )}

      {/* SECTION 1: ORDER SUMMARY & CUSTOMER IDENTITY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Information Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-4 h-4 text-purple-600" /> Customer Identity
          </h3>
          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Full Name</span>
              <strong className="text-sm text-slate-900 dark:text-white">
                {order.customer?.fullName || "Guest Customer"}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Phone Number</span>
              <div className="flex items-center gap-2">
                <strong className="text-slate-900 dark:text-white font-mono">
                  +91 {order.customer?.phone || "Not recorded"}
                </strong>
                {order.customer?.phone && (
                  <button
                    onClick={() => copyToClipboard(order.customer.phone, "phone")}
                    className="text-slate-400 hover:text-purple-600 p-1"
                    title="Copy Phone"
                  >
                    {copiedText === "phone" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Email Address</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-900 dark:text-white font-mono truncate">
                  {order.customer?.email || "N/A"}
                </span>
                {order.customer?.email && (
                  <button
                    onClick={() => copyToClipboard(order.customer.email, "email")}
                    className="text-slate-400 hover:text-purple-600 p-1"
                    title="Copy Email"
                  >
                    {copiedText === "email" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Fulfillment & Logistics Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            {isPickup ? (
              <ShoppingBag className="w-4 h-4 text-blue-600" />
            ) : (
              <Truck className="w-4 h-4 text-purple-600" />
            )}
            Fulfillment Method
          </h3>
          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Type</span>
              <strong className="text-sm text-slate-900 dark:text-white capitalize">
                {isPickup ? "Store Counter Pickup" : "Doorstep Home Delivery"}
              </strong>
            </div>
            {order.courierName && (
              <div>
                <span className="text-slate-400 block text-[11px]">Assigned Courier</span>
                <strong className="text-slate-900 dark:text-white">{order.courierName}</strong>
              </div>
            )}
            {order.trackingNumber && (
              <div>
                <span className="text-slate-400 block text-[11px]">Tracking Reference</span>
                <div className="flex items-center gap-2 font-mono font-bold text-purple-600 dark:text-purple-400">
                  <span>{order.trackingNumber}</span>
                  <button
                    onClick={() => copyToClipboard(order.trackingNumber, "tracking")}
                    className="text-slate-400 hover:text-purple-600 p-1"
                  >
                    {copiedText === "tracking" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}
            {order.dispatchedAt && (
              <div>
                <span className="text-slate-400 block text-[11px]">Dispatched At</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {formatDate(order.dispatchedAt)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Financial Overview Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-emerald-600" /> Financial Summary
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Items Subtotal</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {formatINR(order.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Delivery Fee</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {order.additionalCharges > 0 ? formatINR(order.additionalCharges) : "FREE"}
              </span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span className="font-mono font-bold">-{formatINR(order.discount)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline">
              <span className="font-bold text-slate-900 dark:text-white">Grand Total</span>
              <span className="font-black text-lg text-slate-900 dark:text-white font-mono">
                {formatINR(order.totalAmount)}
              </span>
            </div>
            <div className="pt-1 flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Payment Channel:</span>
              <span className="font-semibold uppercase font-mono text-purple-600 dark:text-purple-400">
                {order.paymentMethod.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: DELIVERY ADDRESS OR STORE PICKUP INSTRUCTIONS */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-purple-600" />
            {isPickup ? "Store Pickup Point & Counter Instructions" : "Courier Shipping Address"}
          </h3>

          {!isPickup && addr && !isAddressMissing && (
            <button
              onClick={() => copyToClipboard(formattedAddressText, "full_address")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 font-bold text-xs transition border border-purple-200 dark:border-purple-800"
            >
              {copiedText === "full_address" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Address Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Delivery Address
                </>
              )}
            </button>
          )}
        </div>

        {isPickup ? (
          <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs space-y-2">
            <p className="font-bold text-blue-950 dark:text-blue-200">
              Customer selected in-store pickup at Bishnu Studio.
            </p>
            <p className="text-blue-800 dark:text-blue-300">
              <strong>Studio Address:</strong> Bishnu Studio, College Road, Near Head Post Office,
              Bhadrak, Odisha - 756100.
            </p>
            <p className="text-blue-700 dark:text-blue-400">
              Customer should show Order Reference <strong>{order.orderReference}</strong> or
              registered phone number at counter.
            </p>
          </div>
        ) : isAddressMissing ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-800 dark:text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              Delivery Address Missing!
            </div>
            <p className="text-rose-700 dark:text-rose-300">
              This home delivery order does not have a recorded shipping address. Do not dispatch
              until customer contact (+91 {order.customer?.phone || "N/A"}) is verified and
              delivery address confirmed.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2 font-mono">
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              {addr.recipientName || order.customer?.fullName}
            </div>
            <div className="text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {formattedAddressText}
            </div>
            {order.orderNotes && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 font-sans text-slate-600 dark:text-slate-300">
                <strong>Customer Delivery Note:</strong> {order.orderNotes}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3: ORDERED ITEMS & ATTACHED PRODUCTION FILES */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <FileText className="w-4 h-4 text-purple-600" />
          Ordered Items & Production Specifications ({order.items?.length || 0})
        </h3>

        <div className="space-y-4">
          {order.items?.map((item: any, idx: number) => {
            const config = item.configuration || {};
            const files = item.files || [];

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2.5">
                  <div>
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm capitalize">
                      {idx + 1}. {item.itemType.replace(/_/g, " ")}
                    </span>
                    <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                      Qty: {item.quantity}
                    </span>
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-900 dark:text-white text-right">
                    <span>
                      {formatINR(item.unitPriceSnapshot)} × {item.quantity} ={" "}
                    </span>
                    <span className="text-sm font-black text-purple-600 dark:text-purple-400">
                      {formatINR(item.totalPriceSnapshot)}
                    </span>
                  </div>
                </div>

                {/* Technical Specifications */}
                {Object.keys(config).length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {Object.entries(config).map(([key, val]) => {
                      if (key === "uploadedFiles" || val === null || val === undefined) return null;
                      return (
                        <div
                          key={key}
                          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                        >
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                            {key.replace(/([A-Z])/g, " $1")}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                            {String(val)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Special Instructions */}
                {item.specialInstructions && (
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                    <strong>Special Instructions:</strong> {item.specialInstructions}
                  </div>
                )}

                {/* Customer Uploaded Production Files */}
                {files.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-purple-600" />
                      Attached Production Artwork / Documents ({files.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {files.map((file: any) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                        >
                          <div className="truncate pr-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                              {file.originalFilename}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {(file.fileSize / 1024).toFixed(1)} KB • {file.mimeType}
                            </span>
                          </div>
                          <a
                            href={file.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shrink-0 transition"
                          >
                            <Download className="w-3 h-3" /> Download
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 4: PAYMENT RECONCILIATION & UTR AUDIT */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Payment Reconciliation & Proof Verification
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[11px]">Total Due</span>
            <span className="text-base font-black text-slate-900 dark:text-white font-mono">
              {formatINR(order.totalAmount)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
            <span className="text-emerald-700 dark:text-emerald-400 block text-[11px]">
              Amount Verified
            </span>
            <span className="text-base font-black text-emerald-800 dark:text-emerald-200 font-mono">
              {formatINR(order.amountPaid || 0)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
            <span className="text-rose-700 dark:text-rose-400 block text-[11px]">
              Outstanding Balance
            </span>
            <span className="text-base font-black text-rose-800 dark:text-rose-200 font-mono">
              {formatINR(order.amountRemaining || 0)}
            </span>
          </div>
        </div>

        {/* UPI Submissions Table */}
        {submissions.length > 0 ? (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Submitted Payment Claims & Screenshots ({submissions.length}):
            </h4>
            <div className="space-y-3">
              {submissions.map((sub: any, sIdx: number) => (
                <div
                  key={sub.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        Submission #{sIdx + 1}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          sub.status === "verified"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : sub.status === "rejected"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {sub.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span className="text-slate-400 font-mono">{formatDate(sub.createdAt)}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px]">UTR / Transaction Ref</span>
                      <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                        <span>{sub.utrNumber || sub.transactionId || "N/A"}</span>
                        {(sub.utrNumber || sub.transactionId) && (
                          <button
                            onClick={() =>
                              copyToClipboard(sub.utrNumber || sub.transactionId, `utr_${sub.id}`)
                            }
                            className="text-slate-400 hover:text-purple-600 p-1"
                          >
                            {copiedText === `utr_${sub.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        Target Receiving UPI Snapshot
                      </span>
                      <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                        {sub.receivingUpiIdSnapshot || "bishnu.studio@oksbi"}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Claimed Amount</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatINR(sub.amountClaimed ?? sub.amount ?? 0)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Proof Screenshot */}
                  {sub.paymentProofUrl && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-3">
                      <span className="font-semibold text-slate-600 dark:text-slate-400 text-xs">
                        Proof Screenshot:
                      </span>
                      <button
                        onClick={() => setPreviewImage(sub.paymentProofUrl)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Screenshot
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 text-center">
            No UPI payment submissions or UTR references recorded yet.
          </div>
        )}
      </div>

      {/* SECTION 5: FULFILLMENT CONTROLLER, TRACKING & TIMELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fulfillment & Tracking Controller Form */}
        <form
          onSubmit={handleSaveFulfillment}
          className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Truck className="w-4 h-4 text-purple-600" />
            Update Order Status & Dispatch Tracking
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fulfillment Workflow Status
              </label>
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500"
              >
                <option value="pending">Pending Review</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing in Studio</option>
                <option value="ready_for_collection">Ready for Pickup</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="completed">Completed & Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Verification State
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500"
              >
                <option value="unpaid">Unpaid (Awaiting payment)</option>
                <option value="pending">Pending verification</option>
                <option value="paid">Paid (Confirmed received)</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>

          {/* Courier & Tracking Fields (especially for Home Delivery) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Courier / Logistics Partner
              </label>
              <input
                type="text"
                placeholder="e.g. DTDC, BlueDart, Delhivery, Speed Post"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tracking / AWB Number
              </label>
              <input
                type="text"
                placeholder="e.g. DTDC-9876543210"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>Direct Courier Tracking Link (URL)</span>
                {trackingUrl && (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-normal"
                  >
                    Test Link <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </label>
              <input
                type="url"
                placeholder="https://track.dtdc.com/tracking?awb=..."
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Delivery Person's Name
              </label>
              <input
                type="text"
                placeholder="e.g. Rajesh Ghosh (Courier Associate)"
                value={deliveryPersonName}
                onChange={(e) => setDeliveryPersonName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Delivery Person Contact No.
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210 (Customer visible only if set)"
                value={deliveryPersonPhone}
                onChange={(e) => setDeliveryPersonPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Estimated Delivery Date / Time Window
              </label>
              <input
                type="text"
                placeholder="e.g. Tomorrow by 4:00 PM or Oct 28, 2026"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Customer-Facing Fulfillment Note */}
          <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 space-y-1.5">
            <label className="block font-bold text-blue-900 dark:text-blue-300 text-xs flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" /> Customer-Visible Fulfillment Update
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Your PVC card is printed and ready at Counter 2. Please bring your order confirmation SMS/email..."
              value={customerFulfillmentNote}
              onChange={(e) => setCustomerFulfillmentNote(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-blue-700 dark:text-blue-400">
              This message is displayed directly on the customer's order tracking screen.
            </p>
          </div>

          {/* Private Staff Note */}
          <div className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-1.5">
            <label className="block font-bold text-purple-900 dark:text-purple-300 text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Internal Staff Notes (PRIVATE)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Printed on Canon Pro-200, packaged in secure sleeve, box #4..."
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-[10px] text-purple-700 dark:text-purple-400">
              Strictly private to studio admins. Never returned by customer APIs or notifications.
            </p>
          </div>

          {/* Admin Override Checkbox */}
          {(order?.orderStatus === "completed" || order?.orderStatus === "cancelled") && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-bold text-xs">Finalized Order Protection</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This order has reached terminal status ({order.orderStatus}). Normal status changes are prevented. Check the box below if you are performing an emergency administrative correction:
              </p>
              <label className="flex items-center gap-2 font-semibold text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAdminOverride}
                  onChange={(e) => setAllowAdminOverride(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span>Authorize emergency status override (Audited)</span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-60 shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving Updates...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Status & Tracking Details
              </>
            )}
          </button>
        </form>

        {/* Status Event Timeline */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Clock className="w-4 h-4 text-purple-600" />
            Order Event & Status History
          </h3>

          <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800 text-xs">
            {order.timeline?.map((ev: any) => (
              <div key={ev.id} className="relative pl-7 space-y-1">
                <div className="absolute left-1.5 top-1 w-3.5 h-3.5 rounded-full bg-purple-600 border-2 border-white dark:border-slate-900" />
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white capitalize">
                    {ev.newStatus.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatDate(ev.createdAt)}
                  </span>
                </div>
                {ev.customerMessage && (
                  <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                    {ev.customerMessage}
                  </p>
                )}
                {ev.internalNote && (
                  <p className="text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 p-2 rounded-lg text-[11px] font-mono border border-purple-200 dark:border-purple-800">
                    Staff note: {ev.internalNote}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Payment Screenshot */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                Payment Proof Screenshot
              </h4>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 max-h-[75vh] flex items-center justify-center bg-slate-950">
              <img
                src={previewImage}
                alt="Payment Proof"
                className="max-h-[75vh] object-contain w-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
