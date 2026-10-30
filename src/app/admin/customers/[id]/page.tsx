"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDate } from "@/lib/utils";
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  MapPin,
  Package,
  History,
  ArrowLeft,
  Loader2,
  ExternalLink,
  Home,
  Briefcase,
  Navigation,
  Star,
  Activity,
  Calendar,
  Ban,
  UserCheck,
  AlertCircle,
  Clock,
  KeyRound,
  Laptop,
  Smartphone,
  Globe,
  LogOut,
} from "lucide-react";

export default function AdminCustomerDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user: currentAdmin } = useAuth();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Sessions state
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [showForceLogoutModal, setShowForceLogoutModal] = useState(false);
  const [forceLogoutLoading, setForceLogoutLoading] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  // Block/Unblock action states
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockCategory, setBlockCategory] = useState<"spam" | "abusive" | "fraud" | "misuse" | "other">("other");
  const [blockLoading, setBlockLoading] = useState(false);

  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [unblockLoading, setUnblockLoading] = useState(false);

  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    if (id) {
      fetchCustomerDetail();
      fetchSessions();
    }
  }, [id]);

  const fetchSessions = async () => {
    try {
      setSessionsLoading(true);
      const res = await fetch(`/api/admin/customers/${id}/sessions`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setSessions(json.sessions || []);
        }
      }
    } catch {
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      setRevokingSessionId(sessionId);
      const res = await fetch(`/api/admin/customers/${id}/sessions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to revoke session");

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setFeedbackMessage({ text: "Customer session revoked successfully." });
    } catch (err: any) {
      setFeedbackMessage({ text: err?.message || "Failed to revoke session", isError: true });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleForceLogoutAll = async () => {
    try {
      setForceLogoutLoading(true);
      const res = await fetch(`/api/admin/customers/${id}/sessions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to force logout customer");

      setSessions([]);
      setShowForceLogoutModal(false);
      setFeedbackMessage({
        text: "All customer sessions terminated successfully. The customer will need to log in again.",
      });
    } catch (err: any) {
      setFeedbackMessage({ text: err?.message || "Failed to force logout customer", isError: true });
    } finally {
      setForceLogoutLoading(false);
    }
  };

  const fetchCustomerDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/customers/${id}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || "Customer not found");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load customer profile");
    } finally {
      setLoading(false);
    }
  };

  const handleBlockCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blockReason.trim().length < 3) {
      setFeedbackMessage({ text: "Please enter a reason with at least 3 characters", isError: true });
      return;
    }

    setBlockLoading(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch(`/api/admin/customers/${id}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: blockReason, category: blockCategory }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to block customer");

      setFeedbackMessage({ text: "Customer account restricted and active sessions terminated." });
      setShowBlockModal(false);
      setBlockReason("");
      await fetchCustomerDetail();
    } catch (err: any) {
      setFeedbackMessage({ text: err?.message || "Error blocking customer", isError: true });
    } finally {
      setBlockLoading(false);
    }
  };

  const handleUnblockCustomer = async () => {
    setUnblockLoading(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch(`/api/admin/customers/${id}/unblock`, {
        method: "POST",
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to unblock customer");

      setFeedbackMessage({ text: "Customer account restored to active status successfully." });
      setShowUnblockModal(false);
      await fetchCustomerDetail();
    } catch (err: any) {
      setFeedbackMessage({ text: err?.message || "Error unblocking customer", isError: true });
    } finally {
      setUnblockLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
        <p className="text-xs text-slate-400 mt-2">Loading customer profile...</p>
      </div>
    );
  }

  if (!data || !data.customer) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-rose-600 text-sm font-semibold">{error || "Customer not found."}</p>
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Customers
        </Link>
      </div>
    );
  }

  const { customer, addresses = [], orders = [], authEvents = [], appeals = [] } = data;
  const isBlocked = customer.status === "blocked";
  const isAdmin = customer.role === "admin";

  const totalSpent = orders
    .filter((o: any) => o.paymentStatus === "paid")
    .reduce((sum: number, o: any) => sum + o.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Customers Directory
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {customer.avatarUrl ? (
              <img
                src={customer.avatarUrl}
                alt={customer.fullName}
                className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-base uppercase">
                {customer.fullName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                {customer.fullName}
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isBlocked
                      ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                      : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {isBlocked ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                  {isBlocked ? "Blocked" : "Active"}
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Customer ID: <span className="font-mono">{customer.id}</span> &bull; Registered on{" "}
                {formatDate(customer.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-3.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 text-xs font-bold">
              Total Spent: <span className="font-mono">{formatINR(totalSpent)}</span>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 text-xs font-bold">
              Orders Placed: <span className="font-mono">{orders.length}</span>
            </div>

            {isAdmin || currentAdmin?.id === customer.id ? (
              <div className="px-3.5 py-1.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 text-xs font-bold flex items-center gap-1.5 shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5" /> Protected Administrator
              </div>
            ) : (
              <>
                {/* Force Logout Button (visible when active sessions exist) */}
                {sessions.length > 0 && !isBlocked && (
                  <button
                    onClick={() => setShowForceLogoutModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Force Logout ({sessions.length})
                  </button>
                )}

                {isBlocked ? (
                  <button
                    onClick={() => setShowUnblockModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Unblock Account
                  </button>
                ) : (
                  <button
                    onClick={() => setShowBlockModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Ban className="w-3.5 h-3.5" /> Block Account
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            feedbackMessage.isError
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
              : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {feedbackMessage.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Block Notification Alert if customer is blocked */}
      {isBlocked && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-rose-900 dark:text-rose-200">
                This account is currently blocked from customer access
              </p>
              <p className="text-rose-700 dark:text-rose-300">
                <strong>Reason:</strong> {customer.blockedReason || "Unspecified policy violation"} &bull;{" "}
                <strong>Category:</strong> <span className="capitalize">{customer.blockedCategory || "other"}</span>
              </p>
              <p className="text-rose-600 dark:text-rose-400 font-mono text-[11px]">
                Restricted at: {customer.blockedAt ? formatDate(customer.blockedAt) : "N/A"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowUnblockModal(true)}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 transition flex-shrink-0"
          >
            Lift Restriction
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Customer Profile & Addresses */}
        <div className="lg:col-span-5 space-y-6">
          {/* Identity Info Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              Account Verification Status
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-slate-400" /> Email Address
                </span>
                {customer.isEmailVerified ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    Unverified
                  </span>
                )}
              </div>
              <p className="font-mono font-semibold text-slate-800 dark:text-slate-200 pl-5">{customer.email}</p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-slate-400" /> Mobile Number
                </span>
                {customer.isPhoneVerified ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    Unverified
                  </span>
                )}
              </div>
              <p className="font-mono font-semibold text-slate-800 dark:text-slate-200 pl-5">+91 {customer.phone}</p>
            </div>
          </div>

          {/* Multiple Saved Addresses Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-600" />
                Saved Delivery Addresses ({addresses.length})
              </h2>
            </div>

            {addresses.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No saved addresses on file.</p>
            ) : (
              <div className="space-y-3">
                {addresses.map((addr: any) => {
                  const TypeIcon =
                    addr.addressType === "work"
                      ? Briefcase
                      : addr.addressType === "other"
                      ? Navigation
                      : Home;

                  return (
                    <div
                      key={addr.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                        addr.isDefault
                          ? "border-purple-300 dark:border-purple-800 bg-purple-50/20 dark:bg-purple-950/20"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            <TypeIcon className="w-2.5 h-2.5" />
                            {addr.addressType}
                          </span>
                          {addr.isDefault && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                              <Star className="w-2.5 h-2.5 fill-emerald-700" /> Default
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">
                          {addr.recipientPhone || customer.phone}
                        </span>
                      </div>

                      <p className="font-bold text-slate-900 dark:text-white">
                        {addr.recipientName || customer.fullName}
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {addr.houseBuilding}, {addr.streetLocality}
                        {addr.landmark ? `, Near ${addr.landmark}` : ""}
                        <br />
                        {addr.cityTown}, {addr.state} -{" "}
                        <strong className="text-slate-800 dark:text-slate-200 font-mono">{addr.pinCode}</strong>
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Appeals History Section for this customer */}
          {appeals.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  Account Appeals History ({appeals.length})
                </span>
                <Link
                  href="/admin/customers/appeals"
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-normal"
                >
                  Appeals Queue &rarr;
                </Link>
              </h2>

              <div className="space-y-3">
                {appeals.map((app: any) => (
                  <div
                    key={app.id}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-400">
                        {formatDate(app.createdAt)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          app.status === "approved"
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                            : app.status === "rejected"
                            ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                            : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>
                    <p className="italic text-slate-700 dark:text-slate-300 font-serif">
                      &ldquo;{app.message}&rdquo;
                    </p>
                    {app.adminResponseNote && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-1">
                        <strong>Admin Note:</strong> {app.adminResponseNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Active Sessions, Order History & Authentication Logs */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Device Sessions Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-purple-600" />
                Active Device Sessions ({sessions.length})
              </h2>

              {sessions.length > 0 && !isAdmin && currentAdmin?.id !== customer.id && (
                <button
                  type="button"
                  onClick={() => setShowForceLogoutModal(true)}
                  className="px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 transition flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" /> Force Logout All
                </button>
              )}
            </div>

            {sessionsLoading ? (
              <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" /> Loading active sessions...
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                No active sessions. This customer is currently signed out on all devices.
              </p>
            ) : (
              <div className="space-y-3">
                {sessions.map((sess: any) => {
                  const ua = sess.userAgent || "";
                  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
                  const deviceLabel = isMobile ? "Mobile Device" : "Desktop / Laptop";

                  return (
                    <div
                      key={sess.id}
                      className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                          {isMobile ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {deviceLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              Active
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 font-mono">
                            {ua || "Standard Web Browser"}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500 pt-0.5">
                            <span className="flex items-center gap-1 font-mono">
                              <Globe className="w-3 h-3 text-slate-400" />
                              {sess.ipAddress || "127.0.0.1"}
                            </span>
                            <span>•</span>
                            <span>Last active: {sess.lastActiveAt ? formatDate(sess.lastActiveAt) : "Recently"}</span>
                          </div>
                        </div>
                      </div>

                      {!isAdmin && currentAdmin?.id !== customer.id && (
                        <button
                          type="button"
                          disabled={revokingSessionId === sess.id}
                          onClick={() => handleRevokeSession(sess.id)}
                          title="Revoke this session"
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0"
                        >
                          {revokingSessionId === sess.id ? "Revoking..." : "Revoke"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Order History */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-600" />
              Order History ({orders.length})
            </h2>

            {orders.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                This customer has not placed any orders yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Payment</th>
                      <th className="py-2.5 px-3 text-right">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {orders.map((ord: any) => (
                      <tr key={ord.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                          {ord.orderReference}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {formatDate(ord.createdAt)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-mono">
                          {formatINR(ord.totalAmount)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold capitalize bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                            {ord.orderStatus.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-semibold capitalize ${
                              ord.paymentStatus === "paid" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {ord.paymentStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            href={`/admin/orders/${ord.id}`}
                            className="text-purple-600 dark:text-purple-400 hover:underline font-bold"
                          >
                            Details &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Authentication Activity Logs */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              Authentication Activity History ({authEvents.length})
            </h2>

            {authEvents.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                No recent authentication events recorded for this customer.
              </p>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Event Type</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">IP Address</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {authEvents.map((evt: any) => (
                      <tr key={evt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200 capitalize">
                          {evt.eventType.replace(/_/g, " ")}
                        </td>
                        <td className="py-2 px-3">
                          {evt.status === "success" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                              Success
                            </span>
                          ) : (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                              title={evt.failureReason || "Failed"}
                            >
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500">
                          {evt.ipAddress || "127.0.0.1"}
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {formatDate(evt.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Force Logout Confirmation Modal */}
      {showForceLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Force Logout Customer</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{customer.fullName} ({customer.email})</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-bold">Terminates {sessions.length} active device session(s).</p>
              <p>
                The customer will be signed out on all devices immediately. Their account status remains <strong>Active</strong>, and they can sign in again anytime.
              </p>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Note: To permanently prevent a customer from signing in, use <strong>Block Account</strong> instead.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={forceLogoutLoading}
                onClick={() => setShowForceLogoutModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={forceLogoutLoading}
                onClick={handleForceLogoutAll}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 transition"
              >
                {forceLogoutLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Force Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Block Customer Account</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{customer.fullName} ({customer.email})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Restricting this customer immediately invalidates all active sessions. Existing orders and payment verification history remain preserved.
            </p>

            <form onSubmit={handleBlockCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Restriction *
                </label>
                <input
                  type="text"
                  required
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="e.g. Fraudulent payment submission, abusive conduct..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Violation Category
                </label>
                <select
                  value={blockCategory}
                  onChange={(e: any) => setBlockCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="spam">Spam or Automated Abuse</option>
                  <option value="abusive">Abusive Language / Behavior</option>
                  <option value="fraud">Payment Fraud / Fake UTR</option>
                  <option value="misuse">Service Misuse / Bad Uploads</option>
                  <option value="other">Other Terms Violation</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={blockLoading}
                  onClick={() => setShowBlockModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={blockLoading}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition"
                >
                  {blockLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Restriction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unblock Modal */}
      {showUnblockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Unblock Customer Account</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{customer.fullName} ({customer.email})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to restore full customer access for this account? The customer will be able to log in, submit orders, and use all services.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={unblockLoading}
                onClick={() => setShowUnblockModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={unblockLoading}
                onClick={handleUnblockCustomer}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition"
              >
                {unblockLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Unblock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
