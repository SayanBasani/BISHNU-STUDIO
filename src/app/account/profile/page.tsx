"use strict";
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Lock,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  Home,
  Briefcase,
  Star,
  Check,
  Upload,
  Camera,
  RotateCcw,
  ArrowRight,
  Shield,
} from "lucide-react";

interface SavedAddress {
  id: string;
  recipientName: string;
  recipientPhone: string;
  addressType: "home" | "work" | "other";
  label: string;
  houseBuilding: string;
  streetLocality: string;
  landmark?: string | null;
  cityTown: string;
  state: string;
  pinCode: string;
  isDefault: boolean;
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Avatar Upload States
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // OTP verification states
  const [otpTarget, setOtpTarget] = useState<"email_verify" | "phone_otp" | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);

  // Address book states
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Address form fields
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [addressType, setAddressType] = useState<"home" | "work" | "other">("home");
  const [houseBuilding, setHouseBuilding] = useState("");
  const [streetLocality, setStreetLocality] = useState("");
  const [landmark, setLandmark] = useState("");
  const [cityTown, setCityTown] = useState("");
  const [state, setState] = useState("West Bengal");
  const [pinCode, setPinCode] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [addressFormError, setAddressFormError] = useState<string | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    if (user?.fullName) {
      setFullName(user.fullName);
    }
    fetchAddresses();
  }, [user]);

  const fetchAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const res = await fetch("/api/account/addresses");
      if (res.ok) {
        const data = await res.json();
        setAddresses(data.addresses || []);
      }
    } catch (err) {
      console.error("Failed to load addresses", err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarMsg({
        type: "error",
        text: "Please select a valid image file (JPEG, PNG, or WebP).",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarMsg({
        type: "error",
        text: "Image file size must be less than 5 MB.",
      });
      return;
    }

    setAvatarMsg(null);
    setSelectedAvatarFile(file);
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
  };

  const handleSaveAvatar = async () => {
    if (!selectedAvatarFile) return;
    setUploadingAvatar(true);
    setAvatarMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedAvatarFile);

      const res = await fetch("/api/account/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload profile picture.");
      }

      setAvatarMsg({ type: "success", text: "Profile picture updated successfully!" });
      setSelectedAvatarFile(null);
      setAvatarPreview(null);
      await refreshUser();
    } catch (err: any) {
      setAvatarMsg({ type: "error", text: err?.message || "Failed to save profile picture." });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!confirm("Are you sure you want to remove your profile picture?")) return;
    setRemovingAvatar(true);
    setAvatarMsg(null);

    try {
      const res = await fetch("/api/account/avatar", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove profile picture.");
      }

      setAvatarMsg({ type: "success", text: "Profile picture removed. Reverted to default avatar." });
      setSelectedAvatarFile(null);
      setAvatarPreview(null);
      await refreshUser();
    } catch (err: any) {
      setAvatarMsg({ type: "error", text: err?.message || "Failed to remove avatar." });
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleCancelAvatarSelect = () => {
    setSelectedAvatarFile(null);
    setAvatarPreview(null);
    setAvatarMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setSavingProfile(true);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile details.");
      }

      setProfileMsg({ type: "success", text: "Your profile details have been saved." });
      await refreshUser();
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err?.message || "Profile update failed." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSendOtp = async (type: "email_verify" | "phone_otp") => {
    setOtpTarget(type);
    setOtpSending(true);
    setProfileMsg(null);
    setDevCodeHint(null);

    const identifier = type === "email_verify" ? user?.email : user?.phone;

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, type }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code.");
      }

      if (data.devCodeHint) {
        setDevCodeHint(data.devCodeHint);
      }
      setProfileMsg({ type: "success", text: `Verification code sent to ${identifier}` });
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err?.message || "Could not send verification code." });
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpTarget) return;

    setOtpVerifying(true);
    setProfileMsg(null);

    const identifier = otpTarget === "email_verify" ? user?.email : user?.phone;

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          type: otpTarget,
          code: otpCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid code.");
      }

      setProfileMsg({ type: "success", text: "Verification successful!" });
      setOtpTarget(null);
      setOtpCode("");
      await refreshUser();
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err?.message || "OTP verification failed." });
    } finally {
      setOtpVerifying(false);
    }
  };

  const openAddAddressModal = () => {
    setEditingAddressId(null);
    setRecipientName(user?.fullName || "");
    setRecipientPhone(user?.phone || "");
    setAddressType("home");
    setHouseBuilding("");
    setStreetLocality("");
    setLandmark("");
    setCityTown("");
    setState("West Bengal");
    setPinCode("");
    setIsDefault(addresses.length === 0);
    setAddressFormError(null);
    setAddressModalOpen(true);
  };

  const openEditAddressModal = (addr: SavedAddress) => {
    setEditingAddressId(addr.id);
    setRecipientName(addr.recipientName || user?.fullName || "");
    setRecipientPhone(addr.recipientPhone || user?.phone || "");
    setAddressType(addr.addressType || "home");
    setHouseBuilding(addr.houseBuilding || "");
    setStreetLocality(addr.streetLocality || "");
    setLandmark(addr.landmark || "");
    setCityTown(addr.cityTown || "");
    setState(addr.state || "West Bengal");
    setPinCode(addr.pinCode || "");
    setIsDefault(addr.isDefault || false);
    setAddressFormError(null);
    setAddressModalOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressFormError(null);

    if (!recipientName.trim()) {
      setAddressFormError("Recipient name is required.");
      return;
    }
    if (!/^[0-9]{10}$/.test(recipientPhone.trim())) {
      setAddressFormError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!houseBuilding.trim() || !streetLocality.trim() || !cityTown.trim() || !pinCode.trim()) {
      setAddressFormError("Please fill in all required address fields.");
      return;
    }
    if (!/^[0-9]{6}$/.test(pinCode.trim())) {
      setAddressFormError("PIN code must be a 6-digit number.");
      return;
    }

    setSavingAddress(true);
    try {
      const payload = {
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        addressType,
        houseBuilding: houseBuilding.trim(),
        streetLocality: streetLocality.trim(),
        landmark: landmark.trim() || null,
        cityTown: cityTown.trim(),
        state: state.trim(),
        pinCode: pinCode.trim(),
        isDefault,
      };

      const url = editingAddressId
        ? `/api/account/addresses/${editingAddressId}`
        : "/api/account/addresses";
      const method = editingAddressId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save address.");
      }

      setAddressModalOpen(false);
      await fetchAddresses();
      await refreshUser();
    } catch (err: any) {
      setAddressFormError(err.message || "Failed to save address.");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm("Are you sure you want to delete this delivery address?")) return;
    try {
      const res = await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchAddresses();
        await refreshUser();
      }
    } catch (err) {
      console.error("Delete address failed", err);
    }
  };

  const handleSetDefaultAddress = async (id: string) => {
    try {
      const res = await fetch(`/api/account/addresses/${id}`, { method: "PATCH" });
      if (res.ok) {
        await fetchAddresses();
        await refreshUser();
      }
    } catch (err) {
      console.error("Set default failed", err);
    }
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">Please log in to manage your account profile.</p>
      </div>
    );
  }

  const currentDisplayAvatar = avatarPreview || user.avatarUrl;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Title & Breadcrumb */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Account Profile &amp; Preferences
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
          Manage your personal details, profile picture, verification status, and saved delivery addresses.
        </p>
      </div>

      {profileMsg && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold animate-in fade-in ${
            profileMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
          }`}
        >
          {profileMsg.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{profileMsg.text}</span>
        </div>
      )}

      {/* Main Grid: Avatar & Identity Card (Left) vs Profile & Password Navigation (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Profile Picture & Verification */}
        <div className="lg:col-span-5 space-y-6">
          {/* Profile Picture Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
              <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Profile Picture
            </h3>

            {avatarMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  avatarMsg.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                }`}
              >
                {avatarMsg.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{avatarMsg.text}</span>
              </div>
            )}

            <div className="flex flex-col items-center justify-center space-y-4">
              {/* Avatar Preview Ring */}
              <div className="relative group">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-blue-500/20 dark:border-blue-500/40 shadow-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  {currentDisplayAvatar ? (
                    <img
                      src={currentDisplayAvatar}
                      alt={user.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-3xl sm:text-4xl flex items-center justify-center select-none">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {avatarPreview && (
                  <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow">
                    Preview
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 w-full">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarFileSelect}
                />

                {!selectedAvatarFile ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-2.5 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center gap-1.5 transition border border-blue-200 dark:border-blue-800"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {user.avatarUrl ? "Replace Picture" : "Upload Picture"}
                    </button>

                    {user.avatarUrl ? (
                      <button
                        type="button"
                        disabled={removingAvatar}
                        onClick={handleRemoveAvatar}
                        className="py-2.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 transition border border-rose-200 dark:border-rose-900"
                      >
                        {removingAvatar ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Remove Picture
                      </button>
                    ) : (
                      <div className="py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-400 text-xs text-center border border-gray-200 dark:border-slate-700">
                        Default Avatar Active
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 animate-in fade-in">
                    <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-900 dark:text-blue-200 text-center">
                      Ready to save: <strong>{selectedAvatarFile.name}</strong>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={uploadingAvatar}
                        onClick={handleSaveAvatar}
                        className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition"
                      >
                        {uploadingAvatar ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" /> Confirm &amp; Save
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelAvatarSelect}
                        className="py-2.5 px-3 rounded-xl border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold text-xs"
                      >
                        Cancel Selection
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-gray-400 text-center pt-1">
                  Supports JPEG, PNG, or WebP up to 5 MB.
                </p>
              </div>
            </div>
          </div>

          {/* Verification Status Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Account Security &amp; Contact
            </h3>

            {/* Email Verification */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" /> Email Address
                </span>
                {user.isEmailVerified ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1 text-[10px]">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
                    Unverified
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all">{user.email}</p>
              {!user.isEmailVerified && !otpTarget && (
                <button
                  type="button"
                  onClick={() => handleSendOtp("email_verify")}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Verify via 6-digit OTP &rarr;
                </button>
              )}
            </div>

            {/* Mobile Verification */}
            <div className="space-y-1.5 pt-3 border-t border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-gray-400" /> Mobile Number
                </span>
                {user.isPhoneVerified ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1 text-[10px]">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
                    Unverified
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-gray-600 dark:text-gray-400">+91 {user.phone}</p>
              {!user.isPhoneVerified && !otpTarget && (
                <button
                  type="button"
                  onClick={() => handleSendOtp("phone_otp")}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Verify via Mobile OTP &rarr;
                </button>
              )}
            </div>

            {/* Active OTP prompt */}
            {otpTarget && (
              <form
                onSubmit={handleVerifyOtp}
                className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-3 animate-in fade-in"
              >
                <div className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  Enter 6-digit code for {otpTarget === "email_verify" ? user.email : user.phone}:
                </div>

                {devCodeHint && (
                  <div className="p-2 bg-amber-100/70 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 rounded text-[11px]">
                    <strong>Simulated Dev Code:</strong> {devCodeHint}
                  </div>
                )}

                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full px-3 py-2 text-center text-sm font-mono tracking-widest rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={otpVerifying}
                    className="flex-1 py-1.5 px-3 bg-blue-600 text-white font-semibold text-xs rounded-xl hover:bg-blue-700 disabled:opacity-60"
                  >
                    {otpVerifying ? "Verifying..." : "Confirm OTP"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpTarget(null);
                      setOtpCode("");
                    }}
                    className="py-1.5 px-3 border border-gray-300 dark:border-slate-700 text-gray-600 dark:text-gray-300 text-xs rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Personal Information & Password Quick Link */}
        <div className="lg:col-span-7 space-y-6">
          {/* Personal Information Form */}
          <form
            onSubmit={handleUpdateProfile}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-5"
          >
            <h3 className="font-bold text-gray-900 dark:text-white text-sm border-b border-gray-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Personal Information
            </h3>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">
                  Account Email (Primary Identifier)
                </label>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 text-xs text-gray-500 font-mono cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">
                  Registered Mobile
                </label>
                <input
                  type="tel"
                  disabled
                  value={`+91 ${user.phone}`}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 text-xs text-gray-500 font-mono cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={savingProfile || fullName === user.fullName}
                className="px-6 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-50 transition flex items-center gap-2"
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving Changes...
                  </>
                ) : (
                  "Save Personal Details"
                )}
              </button>
            </div>
          </form>

          {/* Dedicated Security & Password Navigation Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                    Password &amp; Security Settings
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Keep your account secure with regular password updates.
                  </p>
                </div>
              </div>

              <Link
                href="/account/security"
                className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-bold text-xs flex items-center gap-1.5 transition"
              >
                Change Password <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Multiple Saved Addresses Section (Flipkart / Amazon style) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Saved Delivery Addresses
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Manage multiple shipping destinations for home delivery orders.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddAddressModal}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/20 transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Add New Address
          </button>
        </div>

        {loadingAddresses ? (
          <div className="py-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            <span>Loading addresses...</span>
          </div>
        ) : addresses.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mx-auto">
              <MapPin className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No saved addresses yet</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Add your home, office, or counter delivery address for faster 1-click checkout.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`p-5 rounded-2xl border transition relative space-y-3 ${
                  addr.isDefault
                    ? "border-purple-600/60 bg-purple-50/30 dark:bg-purple-950/20 ring-1 ring-purple-600/30"
                    : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      {addr.addressType === "home" ? (
                        <Home className="w-3 h-3 text-purple-600" />
                      ) : (
                        <Briefcase className="w-3 h-3 text-blue-600" />
                      )}
                      {addr.addressType}
                    </span>
                    {addr.isDefault && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-purple-600 text-white flex items-center gap-1">
                        <Star className="w-3 h-3 fill-white" /> Default Address
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditAddressModal(addr)}
                      className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                      title="Edit address"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title="Delete address"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="font-bold text-gray-900 dark:text-white text-sm">
                    {addr.recipientName || user.fullName}
                  </p>
                  <p className="font-mono text-gray-500 dark:text-gray-400">
                    +91 {addr.recipientPhone || user.phone}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed pt-1">
                    {addr.houseBuilding}, {addr.streetLocality}
                    {addr.landmark ? `, Near ${addr.landmark}` : ""}
                    <br />
                    {addr.cityTown}, {addr.state} - <strong className="font-mono text-gray-900 dark:text-white">{addr.pinCode}</strong>
                  </p>
                </div>

                {!addr.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleSetDefaultAddress(addr.id)}
                    className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline pt-1 block"
                  >
                    Set as Default Delivery Address
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Address Modal */}
      {addressModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl relative border border-gray-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {editingAddressId ? "Edit Delivery Address" : "Add New Delivery Address"}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Recipient name, phone, and complete street address.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddressModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold p-1"
              >
                &times;
              </button>
            </div>

            {addressFormError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addressFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAddress} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    Recipient Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Rahul Sen"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    10-Digit Mobile *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Address Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["home", "work", "other"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAddressType(type)}
                      className={`py-2 rounded-xl text-xs font-bold uppercase transition ${
                        addressType === type
                          ? "bg-purple-600 text-white shadow-sm"
                          : "border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Flat, House No., Building *
                </label>
                <input
                  type="text"
                  required
                  value={houseBuilding}
                  onChange={(e) => setHouseBuilding(e.target.value)}
                  placeholder="e.g. Flat 3B, Sunshine Apartments"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Area, Street, Locality *
                </label>
                <input
                  type="text"
                  required
                  value={streetLocality}
                  onChange={(e) => setStreetLocality(e.target.value)}
                  placeholder="e.g. Station Road, Post Office Para"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near Shiv Temple / Behind SBI"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    City / Town *
                  </label>
                  <input
                    type="text"
                    required
                    value={cityTown}
                    onChange={(e) => setCityTown(e.target.value)}
                    placeholder="Barasat"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="West Bengal"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    PIN Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="700001"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="defaultAddressCheckbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-slate-700"
                />
                <label
                  htmlFor="defaultAddressCheckbox"
                  className="text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Make this my default delivery address
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddressModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAddress}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/20 disabled:opacity-50"
                >
                  {savingAddress ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save Address"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
