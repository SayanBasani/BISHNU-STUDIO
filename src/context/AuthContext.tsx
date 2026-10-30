"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: "customer" | "admin" | "staff";
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  avatarUrl?: string | null;
  passwordUpdatedAt?: number | null;
  addresses?: any[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Module-level in-flight promise deduplicator to prevent concurrent round-trips
let inFlightMePromise: Promise<any> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      if (!inFlightMePromise) {
        inFlightMePromise = fetch("/api/auth/me", { cache: "no-store" })
          .then(async (res) => {
            if (res.ok) {
              return await res.json();
            }
            return { authenticated: false, user: null };
          })
          .catch(() => ({ authenticated: false, user: null }))
          .finally(() => {
            inFlightMePromise = null;
          });
      }

      const data = await inFlightMePromise;
      if (data && data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      window.location.href = "/";
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
