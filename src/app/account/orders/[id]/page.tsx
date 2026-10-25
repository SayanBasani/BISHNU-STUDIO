"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDate } from "@/lib/utils";
import {
  Package,
  CheckCircle2,
  Check,
  Clock,
  ArrowLeft,
  FileText,
  Download,
  AlertCircle,
  Truck,
  Store,
  ShieldCheck,
  XCircle,
  Loader2,
  QrCode,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Eye,
  Star,
  MessageSquare,
  X,
  Printer,
  Sparkles,
  CreditCard,
  Copy,
} from "lucide-react";

interface TimelineEvent {
  id: string;
  orderId: string;
  previousStatus: string | null;
  newStatus: string;
  previousPaymentStatus: string | null;
  newPaymentStatus: string | null;
  actorRole: "customer" | "admin" | "system";
  customerMessage: string | null;
  createdAt: number;
}

interface PaymentSubmission {
  id: string;
  transactionId: string;
  screenshotUrl: string | null;
  status: "pending_verification" | "verified" | "rejected" | "expired" | "review_required";
  rejectionReason: string | null;
  rejectionNote: string | null;
  verifiedAt: number | null;
  createdAt: number;
}

export default function OrderTrackingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Review modal state
  const [reviewModalItem, setReviewModalItem] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  // Return requests state
  const [orderReturnsList, setOrderReturnsList] = useState<any[]>([]);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedReturnItems, setSelectedReturnItems] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState<string>("damaged");
  const [returnDescription, setReturnDescription] = useState("");
  const [requestedResolution, setRequestedResolution] = useState<"refund" | "exchange">("refund");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccess, setReturnSuccess] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/${id}`);
      const data = await res.json();
      if (data.success) {
        setOrder(data.order);
        try {
          const retRes = await fetch(`/api/returns?orderId=${id}`);
          if (retRes.ok) {
            const retData = await retRes.json();
            setOrderReturnsList(retData.returns || []);
          }
        } catch {}
      }
    } catch (err) {
      console.error("Failed to load order:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setReturnSubmitting(true);
    setReturnError(null);
    setReturnSuccess(null);

    const itemsPayload = Object.entries(selectedReturnItems)
      .filter(([_, qty]) => qty > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

    if (itemsPayload.length === 0) {
      setReturnError("Please select at least one item and quantity to return.");
      setReturnSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: id,
          reason: returnReason,
          customerDescription: returnDescription.trim(),
          requestedResolution,
          pickupMethod: order?.deliveryType === "store_pickup" ? "counter_dropoff" : "courier_pickup",
          items: itemsPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit return request.");

      setReturnSuccess(`Return request ${data.returnReference} submitted successfully!`);
      setTimeout(async () => {
        setReturnModalOpen(false);
        setReturnSuccess(null);
        await fetchOrder();
      }, 2500);
    } catch (err: any) {
      setReturnError(err?.message || "Failed to submit return request.");
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!confirm("Are you sure you want to cancel this order?")) return;

    setCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/orders/${id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel order.");
      }
      await fetchOrder();
    } catch (err: any) {
      setCancelError(err?.message || "Failed to cancel order.");
    } finally {
      setCancelling(false);
    }
  };

  const openReviewModal = (item: any) => {
    setReviewModalItem(item);
    setReviewRating(item.userReview?.rating || 5);
    setReviewTitle(item.userReview?.reviewTitle || "");
    setReviewText(item.userReview?.reviewText || "");
    setReviewError(null);
    setReviewSuccess(null);
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalItem?.productId) return;

    if (reviewText.trim().length < 5) {
      setReviewError("Review explanation must be at least 5 characters.");
      return;
    }

    setReviewSubmitting(true);
    setReviewError(null);

    try {
      const res = await fetch(`/api/products/${reviewModalItem.productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: reviewRating,
          reviewTitle: reviewTitle.trim(),
          reviewText: reviewText.trim(),
          orderId: order.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit review.");
      }

      setReviewSuccess("Review saved successfully!");
      setTimeout(() => {
        setReviewModalItem(null);
        fetchOrder();
      }, 1200);
    } catch (err: any) {
      setReviewError(err?.message || "An error occurred submitting your review.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4 shadow-sm">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Order Not Found</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The requested order does not exist or you do not have permission to view it.
          </p>
          <Link
            href="/account/orders"
            className="inline-block px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm"
          >
            View All Orders
          </Link>
        </div>
      </div>
    );
  }

  const isCancelled = order.orderStatus === "cancelled";
  const latestPayment = order.latestPaymentSubmission as PaymentSubmission | null;
  const isUpiOrder = order.paymentMethod === "upi_mock";
  const rawTimeline: TimelineEvent[] = order.timeline || [];

  // Construct 5 standard fulfillment milestones based on real persisted order state
  const isDelivery = order.deliveryType === "home_delivery";
  const milestones = [
    {
      key: "placed",
      title: "Order Placed",
      subtitle: "Order reference registered",
    },
    {
      key: "confirmed",
      title: "Confirmed & Approved",
      subtitle: order.paymentStatus === "paid" ? "Payment verified" : "Awaiting payment verification",
    },
    {
      key: "processing",
      title: "Print Room Processing",
      subtitle: "Printing & packaging",
    },
    {
      key: "ready",
      title: isDelivery ? "Out for Delivery" : "Ready for Pickup",
      subtitle: isDelivery ? "Courier dispatched" : "Studio counter",
    },
    {
      key: "completed",
      title: isDelivery ? "Delivered" : "Collected",
      subtitle: "Fulfillment complete",
    },
  ];

  // Map real backend state to milestone index (0 to 4)
  let activeMilestoneIndex = 0;
  if (!isCancelled) {
    switch (order.orderStatus) {
      case "completed":
        activeMilestoneIndex = 4;
        break;
      case "ready_for_collection":
      case "out_for_delivery":
        activeMilestoneIndex = 3;
        break;
      case "processing":
        activeMilestoneIndex = 2;
        break;
      case "confirmed":
        activeMilestoneIndex = 1;
        break;
      case "pending":
      default:
        // If customer already paid and verified, move to step 1
        activeMilestoneIndex = order.paymentStatus === "paid" ? 1 : 0;
        break;
    }
  }

  // Synthesize complete chronological events for activity timeline
  const activityEvents: Array<{
    id: string;
    title: string;
    description: string;
    timestamp: number;
    icon: any;
    statusVariant: "completed" | "active" | "warning" | "danger" | "pending";
  }> = [];

  // Baseline Order Placed event
  activityEvents.push({
    id: `base_${order.id}`,
    title: "Order Placed & Logged",
    description: `Order reference ${order.orderReference} was generated and recorded in Bishnu Studio.`,
    timestamp: order.createdAt,
    icon: Package,
    statusVariant: "completed",
  });

  // Payment proof events
  if (order.paymentSubmissions && order.paymentSubmissions.length > 0) {
    for (const sub of order.paymentSubmissions) {
      activityEvents.push({
        id: `pay_${sub.id}`,
        title: sub.status === "verified"
          ? "UPI Payment Confirmed"
          : sub.status === "rejected"
          ? "Payment Proof Rejected"
          : "Payment Proof Submitted",
        description: sub.status === "verified"
          ? `UTR #${sub.transactionId} was verified against studio bank accounts.`
          : sub.status === "rejected"
          ? `Proof rejected: ${sub.rejectionNote || sub.rejectionReason || "Please verify your UTR and resubmit."}`
          : `Customer uploaded screenshot and submitted UTR #${sub.transactionId} for verification.`,
        timestamp: sub.createdAt,
        icon: sub.status === "verified" ? ShieldCheck : sub.status === "rejected" ? AlertCircle : QrCode,
        statusVariant: sub.status === "verified" ? "completed" : sub.status === "rejected" ? "danger" : "active",
      });
    }
  }

  // Timeline events from order_status_history
  for (const ev of rawTimeline) {
    let title = "Status Updated";
    let desc = ev.customerMessage || `Order status transitioned to ${ev.newStatus.replace(/_/g, " ")}.`;
    let icon = Clock;
    let variant: "completed" | "active" | "warning" | "danger" | "pending" = "completed";

    switch (ev.newStatus) {
      case "confirmed":
        title = "Order Confirmed & Approved";
        desc = ev.customerMessage || "Order verified and approved for production queue.";
        icon = ShieldCheck;
        variant = "completed";
        break;
      case "processing":
        title = "Print Room Processing Started";
        desc = ev.customerMessage || "Custom printing, cutting, or lamination is actively underway.";
        icon = Printer;
        variant = "active";
        break;
      case "ready_for_collection":
        title = "Ready for Counter Pickup";
        desc = ev.customerMessage || "Order is packaged and waiting at Bishnu Studio counter.";
        icon = Store;
        variant = "active";
        break;
      case "out_for_delivery":
        title = "Dispatched for Doorstep Delivery";
        desc = ev.customerMessage || "Package has been dispatched with delivery courier.";
        icon = Truck;
        variant = "active";
        break;
      case "completed":
        title = isDelivery ? "Order Delivered Successfully" : "Order Collected by Customer";
        desc = ev.customerMessage || "Fulfillment completed and verified by studio staff.";
        icon = CheckCircle2;
        variant = "completed";
        break;
      case "cancelled":
        title = "Order Cancelled";
        desc = ev.customerMessage || "Order was cancelled. Production has been halted.";
        icon = XCircle;
        variant = "danger";
        break;
      default:
        break;
    }

    activityEvents.push({
      id: ev.id,
      title,
      description: desc,
      timestamp: ev.createdAt,
      icon,
      statusVariant: variant,
    });
  }

  // Sort events chronologically (oldest to newest)
  activityEvents.sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-10 transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Back button & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="space-y-1.5">
            <Link
              href="/account/orders"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 mb-1 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to My Orders
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                {order.orderReference}
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isCancelled
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                    : order.orderStatus === "completed"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                }`}
              >
                {order.orderStatus.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Placed on {formatDate(order.createdAt)} • Payment Status:{" "}
              <strong className="capitalize text-slate-800 dark:text-slate-200">
                {order.paymentStatus.replace(/_/g, " ")}
              </strong>
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            {order.orderStatus === "completed" && (
              <button
                onClick={() => {
                  const initial: Record<string, number> = {};
                  order.items?.forEach((i: any) => {
                    initial[i.id] = i.quantity;
                  });
                  setSelectedReturnItems(initial);
                  setReturnModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Request Return / Exchange
              </button>
            )}

            {isUpiOrder && order.paymentStatus !== "paid" && (
              <Link
                href={`/checkout/payment/${order.id}`}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <QrCode className="w-4 h-4" />
                {isCancelled
                  ? "Report Paid Transfer"
                  : latestPayment?.status === "rejected"
                  ? "Resubmit Payment Proof"
                  : latestPayment?.status === "pending_verification" || latestPayment?.status === "review_required"
                  ? "View Payment Details"
                  : "Complete UPI Payment"}
              </Link>
            )}

            {order.orderStatus === "pending" && (
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="px-4 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-xl transition disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Cancel Order"}
              </button>
            )}
          </div>
        </div>

        {cancelError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 rounded-xl font-medium">
            {cancelError}
          </div>
        )}

        {/* UPI Payment Status Card for Customer */}
        {isUpiOrder && (
          <div className="p-5 sm:p-6 rounded-2xl border transition shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    order.paymentStatus === "paid"
                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300"
                      : order.paymentStatus === "review_required" || latestPayment?.status === "review_required"
                      ? "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-300"
                      : latestPayment?.status === "rejected"
                      ? "bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300"
                      : latestPayment?.status === "pending_verification"
                      ? "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-300"
                      : "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300"
                  }`}
                >
                  {order.paymentStatus === "paid" ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : order.paymentStatus === "review_required" || latestPayment?.status === "review_required" ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : latestPayment?.status === "rejected" ? (
                    <XCircle className="w-5 h-5" />
                  ) : latestPayment?.status === "pending_verification" ? (
                    <Clock className="w-5 h-5 animate-pulse motion-reduce:animate-none" />
                  ) : (
                    <QrCode className="w-5 h-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      UPI Payment Status:{" "}
                      <span className="capitalize">
                        {order.paymentStatus === "paid"
                          ? "Payment Confirmed"
                          : latestPayment?.status === "pending_verification"
                          ? "Proof Under Review"
                          : latestPayment?.status === "rejected"
                          ? "Payment Rejected"
                          : latestPayment?.status === "review_required"
                          ? "Verification Required"
                          : "Awaiting Payment"}
                      </span>
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {order.paymentStatus === "paid"
                      ? "Your UPI payment has been verified by the studio. Printing and processing are underway."
                      : latestPayment?.status === "pending_verification"
                      ? `Your UTR #${latestPayment.transactionId} and payment screenshot are being verified against shop accounts.`
                      : latestPayment?.status === "rejected"
                      ? `Proof was rejected: ${latestPayment.rejectionNote || latestPayment.rejectionReason || "Please verify your UTR and resubmit."}`
                      : latestPayment?.status === "review_required"
                      ? "Your transfer details have been submitted for special review."
                      : "Please submit your payment proof to confirm production."}
                  </p>
                </div>
              </div>

              {order.paymentStatus !== "paid" && (
                <Link
                  href={`/checkout/payment/${order.id}`}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition shrink-0 text-center"
                >
                  Payment Page &rarr;
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Polished Fulfillment Tracker with Animated Connectors & Breathing Pulse */}
        {!isCancelled ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Live Fulfillment Journey
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Real-time status tracking based on verified studio production events
                </p>
              </div>

              {order.orderStatus === "completed" && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Order Fulfilled
                </span>
              )}
            </div>

            <div className="overflow-x-auto pb-4 pt-2">
              <div className="flex items-start justify-between min-w-[620px] relative">
                {milestones.map((m, idx) => {
                  const isDone = order.orderStatus === "completed" || activeMilestoneIndex > idx;
                  const isCurrent = order.orderStatus !== "completed" && activeMilestoneIndex === idx;
                  const isUpcoming = !isDone && !isCurrent;

                  return (
                    <div key={m.key} className="flex-1 flex flex-col items-center relative text-center px-2">
                      {/* Animated Connector Line between Steps */}
                      {idx > 0 && (
                        <div
                          className="absolute top-4 -left-1/2 w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden -z-0"
                          aria-hidden="true"
                        >
                          <div
                            className={`h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-700 ease-in-out motion-reduce:transition-none ${
                              activeMilestoneIndex >= idx ? "w-full" : "w-0"
                            }`}
                          />
                        </div>
                      )}

                      {/* Milestone Circle Icon */}
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs relative z-10 transition-all duration-500 motion-reduce:transition-none ${
                          isDone
                            ? "bg-emerald-600 text-white ring-4 ring-emerald-100 dark:ring-emerald-950/80 shadow-sm"
                            : isCurrent
                            ? "border-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-slate-900 ring-4 ring-blue-500/20 text-blue-600 dark:text-blue-400 animate-pulse motion-reduce:animate-none shadow-md"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700"
                        }`}
                        aria-current={isCurrent ? "step" : undefined}
                      >
                        {isDone ? (
                          <Check className="w-4 h-4 stroke-[3]" />
                        ) : isCurrent ? (
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>

                      {/* Title & Subtitle */}
                      <div className="mt-3 text-center space-y-0.5">
                        <p
                          className={`text-xs font-bold leading-tight ${
                            isCurrent
                              ? "text-blue-600 dark:text-blue-400"
                              : isDone
                              ? "text-slate-900 dark:text-slate-100"
                              : "text-slate-400 dark:text-slate-500 font-medium"
                          }`}
                        >
                          {m.title}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
                          {m.subtitle}
                        </p>

                        {isCurrent && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 animate-pulse motion-reduce:animate-none">
                            Active Stage
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-sm text-rose-900 dark:text-rose-200 shadow-sm">
            <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold">This order has been cancelled.</p>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Production and billing have been stopped. No completed fulfillment steps will occur.
              </p>
            </div>
          </div>
        )}

        {/* Main Grid: Items & Specs (Left) vs Upgraded Activity Timeline & Payment Summary (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Order Items & Uploaded Documents */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
                Order Items &amp; Specifications
              </h2>

              <div className="space-y-4">
                {order.items?.map((item: any) => {
                  const isCompleted = order.orderStatus === "completed";
                  const isPickup = order.deliveryType === "store_pickup";

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                              {item.itemType?.replace(/_/g, " ")}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              Rate: {formatINR(item.unitPriceSnapshot)}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm mt-1">
                            {item.itemType === "pvc_card"
                              ? `${item.configuration?.documentType?.toUpperCase()} PVC Smart Card`
                              : item.itemType === "document_print"
                              ? `Document Printing (${item.configuration?.paperSize} ${item.configuration?.printMode})`
                              : item.itemType === "lamination"
                              ? `Document Lamination (${item.configuration?.laminationSize})`
                              : item.itemType === "photo_print"
                              ? `Photo Studio Print (${item.configuration?.photoSize})`
                              : "Shop Product"}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {formatINR(item.totalPriceSnapshot)}
                          </p>
                          <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                        </div>
                      </div>

                      {/* Product Review Action / Notice */}
                      {item.productId && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                          {isCompleted ? (
                            <div className="flex items-center gap-2">
                              {item.userReview ? (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="flex items-center text-amber-500 font-bold">
                                    <Star className="w-3.5 h-3.5 fill-current mr-0.5" />
                                    {item.userReview.rating}/5
                                  </span>
                                  <span className="text-slate-500 dark:text-slate-400">You reviewed this item</span>
                                  <button
                                    onClick={() => openReviewModal(item)}
                                    className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline border border-blue-200 dark:border-blue-900/60 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                                  >
                                    Edit Review
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => openReviewModal(item)}
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-sm flex items-center gap-1.5"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  Write a Review
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 italic flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {isPickup
                                ? "Review will be available after counter collection"
                                : "Review will be available after delivery is completed"}
                            </div>
                          )}

                          <Link
                            href={`/shop/${item.productId}`}
                            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                          >
                            Product Details <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      )}

                      {/* Uploaded Files for this item */}
                      {item.files && item.files.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            Uploaded Order Document:
                          </p>
                          {item.files.map((file: any) => (
                            <div
                              key={file.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                  {file.originalFilename}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  ({(file.fileSize / 1024).toFixed(1)} KB)
                                </span>
                              </div>

                              <a
                                href={file.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-semibold rounded-md transition"
                              >
                                <Download className="w-3 h-3" /> Download / View
                              </a>
                            </div>
                          ))}
                        </div>
                      )}

                      {item.specialInstructions && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                          <strong>Customer Note:</strong> {item.specialInstructions}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Upgraded Order Activity Timeline & Payment Summary */}
          <div className="lg:col-span-5 space-y-6">
            {/* Real Order Activity Timeline */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" /> Chronological Activity History
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {activityEvents.length} {activityEvents.length === 1 ? "event" : "events"}
                </span>
              </div>

              {activityEvents.length > 0 ? (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                  {activityEvents.map((event, idx) => {
                    const Icon = event.icon;
                    return (
                      <div key={event.id || idx} className="relative group">
                        {/* Circle marker with context-aware color */}
                        <div
                          className={`absolute -left-6 top-0.5 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-900 text-[10px] shadow-xs ${
                            event.statusVariant === "completed"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                              : event.statusVariant === "active"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
                              : event.statusVariant === "danger"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-700"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {event.title}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {new Date(event.timestamp).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {event.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic text-center py-4">
                  Timeline events will appear as your order progresses.
                </div>
              )}
            </div>

            {/* Pricing & Delivery Details */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm text-xs">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm border-b border-slate-100 dark:border-slate-800 pb-3">
                Payment &amp; Fulfillment
              </h3>

              <div className="space-y-2 text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>Items Subtotal:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatINR(order.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Charge:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {order.additionalCharges === 0
                      ? "FREE"
                      : formatINR(order.additionalCharges)}
                  </span>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between font-bold text-sm text-slate-900 dark:text-white">
                  <span>Final Total:</span>
                  <span className="text-blue-600 dark:text-blue-400 font-extrabold text-base">
                    {formatINR(order.totalAmount)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Fulfillment Mode:{" "}
                  <span className="capitalize text-blue-600 dark:text-blue-400 font-bold">
                    {order.deliveryType?.replace(/_/g, " ")}
                  </span>
                </p>
                {order.deliveryType === "store_pickup" ? (
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 space-y-1 border border-blue-100 dark:border-blue-900/60">
                    <p className="font-bold flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5" /> Bishnu Studio Counter
                    </p>
                    <p className="text-[11px]">
                      12/B Station Road, Main Market, Barasat, West Bengal - 700001
                    </p>
                    <p className="text-[10px] text-blue-700 dark:text-blue-300">
                      Counter Hours: Mon-Sat 9:00 AM - 9:00 PM
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Delivery Address
                    </p>
                    {order.shippingAddress && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed pt-1 space-y-0.5">
                        {order.shippingAddress.recipientName && (
                          <p className="font-bold text-slate-900 dark:text-white">
                            {order.shippingAddress.recipientName}{" "}
                            <span className="font-mono text-slate-500 font-normal">
                              ({order.shippingAddress.recipientPhone || "No phone"})
                            </span>
                          </p>
                        )}
                        <p>
                          {order.shippingAddress.houseBuilding}, {order.shippingAddress.streetLocality}
                          {order.shippingAddress.landmark ? `, Near ${order.shippingAddress.landmark}` : ""}
                          <br />
                          {order.shippingAddress.cityTown}, {order.shippingAddress.state} -{" "}
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {order.shippingAddress.pinCode}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Logistics & Courier Tracking Assignment (Phase 4.2 & 4.3) */}
                {order.deliveryType === "home_delivery" && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                      <span>Logistics &amp; Courier Tracking</span>
                      {order.courierName && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                          {order.courierName}
                        </span>
                      )}
                    </p>

                    {order.trackingNumber || order.courierName ? (
                      <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 space-y-2 text-xs">
                        {order.trackingNumber && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Tracking / AWB:</span>
                            <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                              <span>{order.trackingNumber}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(order.trackingNumber);
                                  setCopiedTracking(true);
                                  setTimeout(() => setCopiedTracking(false), 2000);
                                }}
                                className="p-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-600 transition"
                                title="Copy tracking number"
                              >
                                {copiedTracking ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        )}

                        {order.trackingUrl && (
                          <div className="pt-1.5 border-t border-purple-200/60 dark:border-purple-800/60 flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400">Live Courier Status:</span>
                            <a
                              href={order.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-600 dark:text-purple-400 hover:underline font-bold flex items-center gap-1"
                            >
                              Track on Courier Portal <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}

                        {order.deliveryPersonName && (
                          <div className="pt-1.5 border-t border-purple-200/60 dark:border-purple-800/60 flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400">Delivery Associate:</span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {order.deliveryPersonName}
                              {order.deliveryPersonPhone && (
                                <a href={`tel:${order.deliveryPersonPhone}`} className="ml-1 text-purple-600 hover:underline font-mono">
                                  ({order.deliveryPersonPhone})
                                </a>
                              )}
                            </span>
                          </div>
                        )}

                        {order.expectedDeliveryDate && (
                          <div className="pt-1.5 border-t border-purple-200/60 dark:border-purple-800/60 flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400">Expected Delivery:</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {order.expectedDeliveryDate}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Delivery partner not assigned yet. Courier details will appear here once dispatched.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Customer-Facing Fulfillment Instructions */}
                {order.customerFulfillmentNote && (
                  <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-1">
                    <p className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5 text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Latest Fulfillment Update
                    </p>
                    <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                      {order.customerFulfillmentNote}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Returns & Exchanges Summary Card */}
            {orderReturnsList.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm text-xs">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-purple-600" /> Return &amp; Refund Status
                </h3>

                <div className="space-y-3">
                  {orderReturnsList.map((ret: any) => (
                    <div
                      key={ret.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold font-mono text-slate-900 dark:text-white">
                          {ret.returnReference}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            ret.status === "completed" || ret.status === "refund_processed"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : ret.status === "rejected" || ret.status === "cancelled"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {ret.status.replace(/_/g, " ")}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        Reason: <strong className="capitalize">{ret.reason.replace(/_/g, " ")}</strong>
                      </p>

                      {ret.refundAmount && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          Eligible Refund: <strong className="text-slate-900 dark:text-white">{formatINR(ret.refundAmount)}</strong>
                        </p>
                      )}

                      {ret.customerInstructions && (
                        <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-[11px]">
                          <strong>Studio Notice:</strong> {ret.customerInstructions}
                        </div>
                      )}

                      {ret.courierName && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          Pickup Partner: <strong>{ret.courierName}</strong>
                          {ret.trackingNumber && ` (AWB: ${ret.trackingNumber})`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {reviewModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {reviewModalItem.userReview ? "Edit Your Review" : "Write a Verified Customer Review"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Order #{order.orderReference}
                </p>
              </div>
              <button
                onClick={() => setReviewModalItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reviewError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {reviewError}
              </div>
            )}

            {reviewSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
                {reviewSuccess}
              </div>
            )}

            <form onSubmit={submitReview} className="space-y-4 text-xs">
              {/* Star Rating Selection */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Rating (1 to 5 Stars) *
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setReviewRating(star)}
                      className="p-1 text-slate-300 hover:scale-110 transition"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= reviewRating
                            ? "text-amber-400 fill-amber-400"
                            : "text-slate-300 dark:text-slate-700"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 font-bold text-slate-700 dark:text-slate-300">
                    {reviewRating} out of 5
                  </span>
                </div>
              </div>

              {/* Review Title */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Headline / Review Title (Optional)
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="e.g. Excellent paper quality and fast delivery!"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Review Text */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Your Review Feedback *
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {reviewText.length} / 1000 characters
                  </span>
                </div>
                <textarea
                  rows={4}
                  required
                  minLength={5}
                  maxLength={1000}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share details of your experience with this product..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModalItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition disabled:opacity-50"
                >
                  {reviewSubmitting ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Request Modal */}
      {returnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-purple-600" />
                  Request Return or Exchange
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Order #{order.orderReference}
                </p>
              </div>
              <button
                onClick={() => setReturnModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {returnError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {returnError}
              </div>
            )}

            {returnSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
                {returnSuccess}
              </div>
            )}

            <form onSubmit={handleRequestReturn} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  1. Select Items to Return &amp; Quantity
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-1">
                  {order.items?.map((item: any) => {
                    const currentQty = selectedReturnItems[item.id] || 0;
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white truncate">
                            {item.itemType === "product"
                              ? "Shop Product"
                              : item.itemType.replace(/_/g, " ").toUpperCase()}
                          </p>
                          <span className="text-[11px] text-slate-500">
                            Ordered: {item.quantity} • {formatINR(item.unitPriceSnapshot)}/unit
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            Return Qty:
                          </label>
                          <select
                            value={currentQty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setSelectedReturnItems((prev) => ({
                                ...prev,
                                [item.id]: val,
                              }));
                            }}
                            className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                          >
                            {Array.from({ length: item.quantity + 1 }, (_, i) => (
                              <option key={i} value={i}>
                                {i}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  2. Reason for Return *
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
                >
                  <option value="damaged">Item Damaged / Scratched during Transit</option>
                  <option value="wrong_item">Wrong Item Received</option>
                  <option value="defective">Defective / Non-Functional Product</option>
                  <option value="print_specification_mismatch">Print Misalignment / Color Inaccuracy</option>
                  <option value="missing_parts">Missing Parts / Incomplete Package</option>
                  <option value="other">Other Issue (Explain below)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  3. Requested Resolution *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="radio"
                      name="resolution"
                      value="refund"
                      checked={requestedResolution === "refund"}
                      onChange={() => setRequestedResolution("refund")}
                      className="text-purple-600"
                    />
                    <span>Refund (UPI/Bank)</span>
                  </label>
                  <label className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="radio"
                      name="resolution"
                      value="exchange"
                      checked={requestedResolution === "exchange"}
                      onChange={() => setRequestedResolution("exchange")}
                      className="text-purple-600"
                    />
                    <span>Replacement / Exchange</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  4. Explanation &amp; Issue Details *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Please describe the defect or reason for return in detail..."
                  value={returnDescription}
                  onChange={(e) => setReturnDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={returnSubmitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold transition disabled:opacity-50"
                >
                  {returnSubmitting ? "Submitting..." : "Submit Return Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
