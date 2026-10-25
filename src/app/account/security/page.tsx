"use strict";
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  KeyRound,
  Loader2,
  ShieldAlert,
} from "lucide-react";

export default function CustomerSecurityPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <Lock className="w-12 h-12 text-gray-400 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Authentication Required</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Please log in to manage your account security settings.
        </p>
        <Link
          href="/login"
          className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs"
        >
          Sign In
        </Link>
      </div>
    );
  }

  // Password Policy Checklist
  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumberOrSymbol = /[0-9!@#$%^&*]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isDifferentFromCurrent = newPassword.length > 0 && newPassword !== currentPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setErrorMsg("Please enter your current password.");
      return;
    }

    if (!hasMinLength || !hasLetter || !hasNumberOrSymbol) {
      setErrorMsg("New password must be at least 8 characters long and contain both letters and numbers/symbols.");
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMsg("New password cannot be identical to your current password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Password confirmation does not match the new password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to change password.");
      }

      setSuccessMsg(data.message || "Your password has been changed successfully! All other sessions have been logged out.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setErrorMsg(err?.message || "Password update failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      {/* Back Button & Title */}
      <div>
        <Link
          href="/account/profile"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-2 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Account Profile
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <KeyRound className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          Change Account Password
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Update your login password securely. For your protection, other active web sessions will be signed out.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2.5 shadow-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Password Change Form */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Current Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
              Current Password *
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                title={showCurrent ? "Hide password" : "Show password"}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
              New Password *
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters with letters & numbers"
                className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                title={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
              Confirm New Password *
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                title={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password Policy Live Requirements Checklist */}
          {newPassword.length > 0 && (
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 space-y-2 text-xs">
              <span className="font-bold text-gray-800 dark:text-gray-200 block text-[11px] uppercase tracking-wider">
                Password Security Checklist:
              </span>
              <ul className="space-y-1 text-[11px]">
                <li className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Minimum 8 characters in length
                </li>
                <li className={`flex items-center gap-1.5 ${hasLetter ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Contains letters (A-Z)
                </li>
                <li className={`flex items-center gap-1.5 ${hasNumberOrSymbol ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Contains at least one number (0-9) or symbol
                </li>
                <li className={`flex items-center gap-1.5 ${isDifferentFromCurrent ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Distinct from current password
                </li>
                <li className={`flex items-center gap-1.5 ${isMatch ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                </li>
              </ul>
            </div>
          )}

          {/* Submit CTA */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying &amp; Updating...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Update Password &amp; Invalidate Other Sessions
                </>
              )}
            </button>
          </div>
        </form>

        <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-[11px] text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <span>
            Bishnu Studio uses cryptographic salt hashing (bcrypt). Your passwords are never stored in plaintext, logged, or returned in server responses.
          </span>
        </div>
      </div>
    </div>
  );
}
