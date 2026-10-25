"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShieldAlert, Send, Clock, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

function BlockedContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const initialReason = searchParams.get("reason") || "Account restriction due to security or policy terms.";
  const initialCategory = searchParams.get("category") || "other";
  const dateStr = searchParams.get("date");
  const initialEmail = searchParams.get("email") || "";
  const initialPhone = searchParams.get("phone") || "";

  const [contactEmail, setContactEmail] = useState(initialEmail);
  const [contactPhone, setContactPhone] = useState(initialPhone);
  const [category, setCategory] = useState(initialCategory);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [existingAppeal, setExistingAppeal] = useState<any | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);

  useEffect(() => {
    if (userId || contactEmail) {
      setCheckingExisting(true);
      const url = userId
        ? `/api/appeals?userId=${encodeURIComponent(userId)}`
        : `/api/appeals?email=${encodeURIComponent(contactEmail)}`;

      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (data.latestAppeal && (data.latestAppeal.status === "submitted" || data.latestAppeal.status === "under_review")) {
            setExistingAppeal(data.latestAppeal);
          }
        })
        .catch(() => {})
        .finally(() => setCheckingExisting(false));
    }
  }, [userId, contactEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!userId) {
      setError("Account identification is missing. Please attempt sign-in first or contact support directly.");
      return;
    }

    if (message.trim().length < 10) {
      setError("Please provide at least 10 characters explaining your appeal.");
      return;
    }

    if (message.length > 1000) {
      setError("Appeal message cannot exceed 1000 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          contactEmail,
          contactPhone,
          category,
          message,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.existingAppeal) {
          setExistingAppeal(data.existingAppeal);
        }
        throw new Error(data.error || "Failed to submit appeal.");
      }

      setSuccessMessage(data.message || "Your appeal has been submitted successfully.");
      setExistingAppeal({
        status: "submitted",
        message,
        createdAt: Date.now(),
      });
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = dateStr
    ? new Date(parseInt(dateStr, 10) || Date.now()).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Recently";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center transition-colors">
      <div className="max-w-xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Banner */}
        <div className="bg-rose-50 dark:bg-rose-950/40 border-b border-rose-100 dark:border-rose-900/50 p-6 sm:p-8 text-center">
          <div className="w-14 h-14 bg-rose-100 dark:bg-rose-900/60 rounded-full flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400 mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Account Access Restricted</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Your Bishnu Studio account is currently suspended from customer access.
          </p>
        </div>

        {/* Details Card */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Restriction Details</span>
              <span>Effective Date: {formattedDate}</span>
            </div>
            <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
              <span className="text-slate-500 dark:text-slate-400 font-normal">Reason: </span>
              {initialReason}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-normal">Category: </span>
              <span className="capitalize font-medium text-slate-700 dark:text-slate-300">{initialCategory}</span>
            </div>
          </div>

          {/* Existing Appeal Banner or Form */}
          {existingAppeal ? (
            <div className="p-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <span>Appeal In Review</span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                You have already submitted an appeal for this account. Our administrative team reviews requests within <strong>24 to 48 business hours</strong>.
              </p>
              <div className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-lg border border-amber-100 dark:border-amber-900/50">
                <div className="font-medium text-slate-700 dark:text-slate-300 mb-1">Your appeal text:</div>
                <div className="italic">&ldquo;{existingAppeal.message}&rdquo;</div>
                <div className="mt-2 text-[11px] text-slate-400">
                  Status: <span className="font-semibold uppercase text-amber-600 dark:text-amber-400">{existingAppeal.status}</span>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Submit an Account Appeal</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  If you believe this restriction was made in error, submit an appeal below for manual administrator review.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Contact Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Contact Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Appeal Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="other">General Account Inquiry</option>
                  <option value="fraud">Payment / Transaction Verification</option>
                  <option value="spam">Accidental / False Spam Flag</option>
                  <option value="misuse">Policy Clarification / Resolution</option>
                  <option value="abusive">Account Security Compromise</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Appeal Explanation *
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {message.length} / 1000 characters
                  </span>
                </div>
                <textarea
                  rows={4}
                  required
                  maxLength={1000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Explain why you believe this account restriction should be reconsidered or provide any clarifying payment/order details..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Rate limit: Maximum 2 appeals per 24 hours. Your IP address is recorded for verification security.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading ? "Submitting Appeal..." : "Submit Reconsideration Request"}
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex items-center justify-between text-xs">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Storefront
            </Link>
            <Link
              href="/contact"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Contact Bishnu Studio Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BlockedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-xs text-slate-400">Loading...</div>}>
      <BlockedContent />
    </Suspense>
  );
}
