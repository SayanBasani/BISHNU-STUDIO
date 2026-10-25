"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Printer, AlertCircle, Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";
  const { refreshUser } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.isBlocked) {
          const params = new URLSearchParams({
            userId: data.userId || "",
            reason: data.blockedReason || "",
            category: data.blockedCategory || "",
            date: data.blockedAt ? String(data.blockedAt) : "",
            email: data.email || "",
            phone: data.phone || "",
          });
          router.push(`/blocked?${params.toString()}`);
          return;
        }
        throw new Error(data.error || "Login failed.");
      }

      await refreshUser();
      router.push(redirectUrl);
    } catch (err: any) {
      setError(err?.message || "An error occurred during sign-in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full space-y-8 card-theme p-8 rounded-2xl">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md">
          <Printer className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Sign In to Bishnu Studio
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Access your orders, track printing requests, and manage documents
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Email Address or 10-Digit Mobile Number
          </label>
          <input
            type="text"
            required
            placeholder="e.g. rahul@example.com or 9876543210"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl input-theme text-sm"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl input-theme text-sm"
          />
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
              <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <div className="text-center pt-2 border-t border-gray-100 dark:border-slate-800 text-xs text-gray-500 dark:text-gray-400">
        Don't have an account yet?{" "}
        <Link
          href="/register"
          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={<Loader2 className="w-8 h-8 text-blue-600 animate-spin" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
