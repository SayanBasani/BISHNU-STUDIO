"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Camera,
  Trash2,
  Upload,
  RefreshCw,
  Lock,
  ArrowLeft,
  Server,
  Terminal,
  Copy,
  Clock,
  Sparkles,
} from "lucide-react";

export default function AdminSecurityPage() {
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile picture states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [copiedHashCmd, setCopiedHashCmd] = useState(false);

  const hashCommand = `node -e "console.log(require('bcryptjs').hashSync('YourStrongPasswordHere', 10))"`;

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(hashCommand);
    setCopiedHashCmd(true);
    setTimeout(() => setCopiedHashCmd(false), 2000);
  };

  // Synchronize preview when user changes or loads
  useEffect(() => {
    if (user?.avatarUrl && !selectedFile) {
      setPreviewUrl(user.avatarUrl);
    }
  }, [user?.avatarUrl, selectedFile]);

  // Validation checklist
  const hasMinLength = newPassword.length >= 8;
  const hasLetters = /[a-zA-Z]/.test(newPassword);
  const hasNumbersOrSpecial = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword);
  const isDifferentFromCurrent = currentPassword !== "" && newPassword !== currentPassword;
  const matchesConfirmation = newPassword !== "" && newPassword === confirmPassword;
  const isPasswordValid =
    hasMinLength &&
    hasLetters &&
    hasNumbersOrSpecial &&
    isDifferentFromCurrent &&
    matchesConfirmation;

  // Avatar file selection handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError(null);
    setAvatarSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError("Only JPG, PNG, and WebP images are allowed.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("File size exceeds 5MB limit. Please choose a smaller image.");
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  // Upload Avatar
  const handleUploadAvatar = async () => {
    if (!selectedFile) return;
    setUploadingAvatar(true);
    setAvatarError(null);
    setAvatarSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/account/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload administrator photo.");
      }

      setAvatarSuccess("Administrator profile photo updated successfully.");
      setSelectedFile(null);
      await refreshUser();
    } catch (err: any) {
      setAvatarError(err.message || "An unexpected error occurred during upload.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Remove Avatar
  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    setAvatarError(null);
    setAvatarSuccess(null);

    try {
      const res = await fetch("/api/account/avatar", {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove administrator photo.");
      }

      setPreviewUrl(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setAvatarSuccess("Administrator profile photo removed. Restored system avatar.");
      await refreshUser();
    } catch (err: any) {
      setAvatarError(err.message || "An unexpected error occurred while removing photo.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Submit Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!isPasswordValid) {
      setPasswordError("Please meet all password requirements before submitting.");
      return;
    }

    setSubmittingPassword(true);
    try {
      const res = await fetch("/api/admin/auth/change-password", {
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
        throw new Error(data.error || "Failed to update administrator password.");
      }

      setPasswordSuccess(data.message || "Administrator password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await refreshUser();
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update administrator password.");
    } finally {
      setSubmittingPassword(false);
    }
  };

  const formattedPasswordDate = user?.passwordUpdatedAt
    ? new Date(user.passwordUpdatedAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Bootstrap Initial Default";

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header breadcrumb & title */}
      <div>
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to System Settings
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              Administrator Profile &amp; Security
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Manage your administrator avatar, rotate master credentials, and review session security
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Active Admin Session
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Admin Identity & Avatar */}
        <div className="lg:col-span-5 space-y-6">
          {/* Identity Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md border-2 border-white dark:border-slate-800">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={user?.fullName || "Administrator"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ShieldCheck className="w-10 h-10" />
                  )}
                </div>
                <label
                  htmlFor="admin-avatar-input"
                  className="absolute bottom-0 right-0 p-1.5 rounded-lg bg-purple-600 text-white shadow hover:bg-purple-700 cursor-pointer transition transform translate-x-1 translate-y-1"
                  title="Upload new photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </label>
                <input
                  id="admin-avatar-input"
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              <div className="space-y-1 truncate">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  System Administrator
                </span>
                <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">
                  {user?.fullName || "Store Owner"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                  {user?.email}
                </p>
              </div>
            </div>

            {/* Avatar action controls */}
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800 space-y-3">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Supports JPG, PNG, WebP up to 5MB.
              </div>

              {selectedFile && (
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-between">
                  <div className="truncate pr-2">
                    <p className="text-xs font-semibold text-purple-900 dark:text-purple-200 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] text-purple-600 dark:text-purple-400">
                      {(selectedFile.size / 1024).toFixed(0)} KB &bull; Ready to save
                    </p>
                  </div>
                  <button
                    onClick={handleUploadAvatar}
                    disabled={uploadingAvatar}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 shadow-sm transition flex items-center gap-1 shrink-0 disabled:opacity-60"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    Save Photo
                  </button>
                </div>
              )}

              {avatarSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{avatarSuccess}</span>
                </div>
              )}

              {avatarError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{avatarError}</span>
                </div>
              )}

              {user?.avatarUrl && !selectedFile && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="w-full py-2 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition flex items-center justify-center gap-1.5 border border-dashed border-rose-200 dark:border-rose-800 disabled:opacity-60"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Custom Avatar
                </button>
              )}
            </div>
          </div>

          {/* Account Security Overview */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
              <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Security Metadata
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-slate-800/60">
                <span className="text-gray-500 dark:text-gray-400">Configured Identity:</span>
                <span className="font-mono font-bold text-gray-800 dark:text-gray-200 truncate max-w-[180px]">
                  {user?.email}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-slate-800/60">
                <span className="text-gray-500 dark:text-gray-400">Password Last Updated:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {formattedPasswordDate}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-slate-800/60">
                <span className="text-gray-500 dark:text-gray-400">Credential Source:</span>
                <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  {user?.passwordUpdatedAt ? "Database-Backed (Primary)" : "Environment Bootstrap"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-gray-500 dark:text-gray-400">Session Protection:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Single-Device Active
                </span>
              </div>
            </div>
          </div>

          {/* Emergency Recovery Instructions */}
          <div className="bg-slate-900 text-gray-200 rounded-2xl border border-slate-800 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
              <Server className="w-4 h-4" />
              Emergency Owner Recovery
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              In case of forgotten credentials or locked-out states, the shop owner can always sign in using the environment master secret configured in <code className="text-purple-300">.env.local</code> (<code className="text-purple-300">ADMIN_PASSWORD</code> or <code className="text-purple-300">ADMIN_PASSWORD_HASH</code>).
            </p>
            <div className="pt-1">
              <span className="text-[10px] text-slate-400 block mb-1">
                Bcrypt Hash Utility Generator:
              </span>
              <div className="p-2 rounded-lg bg-slate-950 font-mono text-[10px] text-purple-300 flex items-center justify-between border border-slate-800">
                <span className="truncate pr-2">{hashCommand}</span>
                <button
                  type="button"
                  onClick={handleCopyCmd}
                  className="p-1 hover:text-white shrink-0 text-slate-400"
                  title="Copy command"
                >
                  {copiedHashCmd ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Change Password Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4 mb-6">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Change Administrator Password
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Changing your password persists directly to the database and invalidates all other active sessions
                </p>
              </div>
              <Lock className="w-5 h-5 text-gray-300 dark:text-slate-600 hidden sm:block" />
            </div>

            {passwordSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-bold">Password Updated Successfully</p>
                  <p className="mt-0.5 leading-relaxed">{passwordSuccess}</p>
                </div>
              </div>
            )}

            {passwordError && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <p className="font-bold">Password Change Failed</p>
                  <p className="mt-0.5 leading-relaxed">{passwordError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-5">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Current Administrator Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter current password or bootstrap secret"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label={showCurrent ? "Hide password" : "Show password"}
                    title={showCurrent ? "Hide password" : "Show password"}
                    tabIndex={0}
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                  Verified against database hash or configured ADMIN_PASSWORD
                </p>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  New Administrator Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Enter minimum 8 characters with letters & numbers"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label={showNew ? "Hide password" : "Show password"}
                    title={showNew ? "Hide password" : "Show password"}
                    tabIndex={0}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Confirm New Administrator Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-type new password exactly"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    title={showConfirm ? "Hide password" : "Show password"}
                    tabIndex={0}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Quality Checklist */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Security Checklist:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-slate-500"}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${hasMinLength ? "text-emerald-500" : "text-gray-300 dark:text-slate-600"}`} />
                    <span>8+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasLetters ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-slate-500"}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${hasLetters ? "text-emerald-500" : "text-gray-300 dark:text-slate-600"}`} />
                    <span>Contains letters (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumbersOrSpecial ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-slate-500"}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${hasNumbersOrSpecial ? "text-emerald-500" : "text-gray-300 dark:text-slate-600"}`} />
                    <span>Numbers or symbols</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${isDifferentFromCurrent ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-slate-500"}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isDifferentFromCurrent ? "text-emerald-500" : "text-gray-300 dark:text-slate-600"}`} />
                    <span>Distinct from current</span>
                  </div>
                  <div className={`flex items-center gap-1.5 sm:col-span-2 ${matchesConfirmation ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-slate-500"}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${matchesConfirmation ? "text-emerald-500" : "text-gray-300 dark:text-slate-600"}`} />
                    <span>Confirmation matches new password</span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submittingPassword || !isPasswordValid}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition flex items-center justify-center gap-2"
                >
                  {submittingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating Credentials...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      Save New Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
