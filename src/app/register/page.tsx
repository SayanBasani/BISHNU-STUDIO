"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Printer, AlertCircle, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Address
  const [houseBuilding, setHouseBuilding] = useState("");
  const [streetLocality, setStreetLocality] = useState("");
  const [cityTown, setCityTown] = useState("");
  const [state, setState] = useState("West Bengal");
  const [pinCode, setPinCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: any = {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      };

      if (houseBuilding && streetLocality && cityTown && pinCode) {
        payload.address = {
          houseBuilding: houseBuilding.trim(),
          streetLocality: streetLocality.trim(),
          cityTown: cityTown.trim(),
          state: state.trim(),
          pinCode: pinCode.trim(),
        };
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      await refreshUser();
      router.push("/");
    } catch (err: any) {
      setError(err?.message || "Registration error. Please check your information.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full space-y-6 card-theme p-8 rounded-2xl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md">
            <Printer className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Create Customer Account
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Join Bishnu Studio for seamless online document printing and tracking
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sen"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl input-theme text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Mobile Number (10 Digits) <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                maxLength={10}
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl input-theme text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="rahul@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl input-theme text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Password (min 6 characters) <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl input-theme text-sm"
              />
            </div>
          </div>

          {/* Optional Initial Address */}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-3">
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
              Address Details <span className="text-gray-400 dark:text-slate-500 font-normal">(Optional for delivery)</span>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  placeholder="House / Flat / Building"
                  value={houseBuilding}
                  onChange={(e) => setHouseBuilding(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl input-theme text-xs"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Street / Locality"
                  value={streetLocality}
                  onChange={(e) => setStreetLocality(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl input-theme text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <input
                  type="text"
                  placeholder="City / Town"
                  value={cityTown}
                  onChange={(e) => setCityTown(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl input-theme text-xs"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="State"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl input-theme text-xs"
                />
              </div>
              <div>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="PIN Code"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl input-theme text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Creating Account...
              </>
            ) : (
              "Complete Registration"
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-gray-100 dark:border-slate-800 text-xs text-gray-500 dark:text-gray-400">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
