"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Database,
  Server,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ArrowRight,
  Lock,
  Clock,
  Activity,
  Layers,
  ChevronLeft,
  AlertCircle,
  Check,
  Loader2,
  HardDrive,
  Cpu,
  FileCheck2,
  ShieldCheck,
  Info,
} from "lucide-react";

interface DatabaseStatusData {
  controlPlane: {
    mode: "neon_primary" | "emergency_fallback" | "local_development" | "maintenance";
    activeProvider: "neon-postgres" | "sqlite-libsql";
    authoritativeDatabase?: string;
    writesEnabled?: boolean;
    fencingToken: number;
    lastSwitchedAt: number | null;
    lastSwitchedBy: string | null;
    switchReason: string | null;
    lastSyncAt: number | null;
    lastSyncStatus: string | null;
  };
  health: {
    primary: {
      status: "healthy" | "unhealthy" | "not_configured";
      latencyMs: number;
      checkedAt: number;
      error?: string;
    };
    fallback: {
      status: "healthy" | "unhealthy" | "not_configured";
      latencyMs: number;
      checkedAt: number;
      error?: string;
    };
  };
  hostingSafety: {
    isVercel: boolean;
    isProduction: boolean;
    fallbackConfigured: boolean;
    fallbackUrlType: string;
    isFallbackPersistentAndSafe: boolean;
    warning?: string;
  };
  syncSummary: {
    pendingCount: number;
    syncedCount: number;
    conflictCount: number;
    failedCount: number;
    lastHistory: any | null;
  };
}

export default function AdminDatabaseSettingsPage() {
  const [data, setData] = useState<DatabaseStatusData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Switch Modal state
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [targetMode, setTargetMode] = useState<string>("neon_primary");
  const [switchReason, setSwitchReason] = useState("");
  const [switchConfirmation, setSwitchConfirmation] = useState("");
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any | null>(null);

  const fetchStatus = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    try {
      const [resStatus, resHist] = await Promise.all([
        fetch(`/api/admin/database/status${forceRefresh ? "?refresh=true" : ""}`),
        fetch("/api/admin/database/history?limit=10"),
      ]);

      const statusJson = await resStatus.json();
      const histJson = await resHist.json();

      if (!resStatus.ok) throw new Error(statusJson.error || "Failed to load database status");
      setData(statusJson);
      if (resHist.ok && histJson.history) setHistory(histJson.history);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load database diagnostics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSwitchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (switchConfirmation !== "CONFIRM") {
      setSwitchError("Please type 'CONFIRM' to verify mode change.");
      return;
    }
    if (!switchReason || switchReason.trim().length < 5) {
      setSwitchError("Operational reason must be at least 5 characters.");
      return;
    }

    setSwitching(true);
    setSwitchError(null);
    try {
      const res = await fetch("/api/admin/database/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMode,
          reason: switchReason.trim(),
          confirmation: switchConfirmation,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to switch database mode");

      setShowSwitchModal(false);
      setSwitchReason("");
      setSwitchConfirmation("");
      await fetchStatus(true);
    } catch (err: any) {
      setSwitchError(err.message || "Switch failed");
    } finally {
      setSwitching(false);
    }
  };

  const handleRunSync = async (dryRun = false) => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/database/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to run synchronization");
      setSyncResult(json.summary);
      await fetchStatus(true);
    } catch (err: any) {
      alert("Synchronization Error: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const getModeBadge = (mode?: string) => {
    switch (mode) {
      case "neon_primary":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            Mode A: Neon Primary (Authoritative Production)
          </span>
        );
      case "emergency_fallback":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Mode B: Emergency Fallback (Outbox Queued)
          </span>
        );
      case "local_development":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <HardDrive className="w-3.5 h-3.5 text-blue-500" />
            Mode C: Local Development (SQLite File)
          </span>
        );
      case "maintenance":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            Mode D: Maintenance (Read-Only / Writes Blocked)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/admin/settings" className="hover:text-purple-600 flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" /> Settings
            </Link>
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-200 font-medium">Database &amp; Storage</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Database className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            Database &amp; Storage Architecture
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Neon Serverless PostgreSQL Primary (Default), SQLite / LibSQL Fallback &amp; Multi-Engine Synchronization
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-purple-600" : ""}`} />
            Refresh Health
          </button>
          <button
            onClick={() => {
              setTargetMode(data?.controlPlane.mode === "neon_primary" ? "emergency_fallback" : "neon_primary");
              setSwitchError(null);
              setShowSwitchModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all"
          >
            <Layers className="w-3.5 h-3.5" />
            Switch Operating Mode
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <p className="text-xs text-slate-500">Checking database health &amp; control plane state...</p>
        </div>
      ) : data ? (
        <>
          {/* Top Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Operating Mode */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Operating Mode</span>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Token #{data.controlPlane.fencingToken}
                </span>
              </div>
              <div>{getModeBadge(data.controlPlane.mode)}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
                <div className="flex justify-between items-center">
                  <span>Authoritative DB:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white truncate max-w-[130px]" title={data.controlPlane.authoritativeDatabase}>
                    {data.controlPlane.activeProvider === "neon-postgres" ? "Neon PostgreSQL" : "SQLite / LibSQL"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Write Status:</span>
                  {data.controlPlane.writesEnabled !== false ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" /> Writes Enabled
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Writes Blocked
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Primary Database (Neon) */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Neon PostgreSQL Primary</span>
                <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex items-center gap-2">
                {data.health.primary.status === "healthy" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> Connected ({data.health.primary.latencyMs}ms)
                  </span>
                ) : data.health.primary.status === "unhealthy" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                    <XCircle className="w-4 h-4" /> Unreachable: {data.health.primary.error || "Cannot connect"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
                    Not Configured
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80 truncate">
                Role: <span className="font-medium text-slate-700 dark:text-slate-300">Default Production Engine</span>
              </div>
            </div>

            {/* 3. Fallback Database (SQLite / LibSQL) */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Fallback Database</span>
                <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex items-center gap-2">
                {data.health.fallback.status === "healthy" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> Connected ({data.health.fallback.latencyMs}ms)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
                    Not Configured
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                Storage:{" "}
                <span
                  className={`font-semibold ${
                    data.hostingSafety.isFallbackPersistentAndSafe
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {data.hostingSafety.isFallbackPersistentAndSafe
                    ? "Remote LibSQL (Persistent)"
                    : data.hostingSafety.isVercel
                    ? "Ephemeral SQLite (Unsafe on Vercel)"
                    : "Local File (Dev Only)"}
                </span>
              </div>
            </div>

            {/* 4. Synchronization & Outbox */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Sync Outbox Queue</span>
                <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {data.syncSummary.pendingCount}
                </div>
                <span className="text-xs text-slate-500">pending mutations</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80 flex justify-between">
                <span>Conflicts: {data.syncSummary.conflictCount}</span>
                <span>Synced: {data.syncSummary.syncedCount}</span>
              </div>
            </div>
          </div>

          {/* Last Switch Audit Banner */}
          {data.controlPlane.lastSwitchedAt && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 text-xs text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>
                  Last Provider Transition:{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {new Date(data.controlPlane.lastSwitchedAt).toLocaleString("en-IN")}
                  </strong>{" "}
                  by <span className="font-mono text-purple-600 dark:text-purple-400">{data.controlPlane.lastSwitchedBy}</span>
                </span>
              </div>
              {data.controlPlane.switchReason && (
                <div className="italic text-slate-500 truncate max-w-md">
                  &ldquo;{data.controlPlane.switchReason}&rdquo;
                </div>
              )}
            </div>
          )}

          {/* Hosting Reality & Serverless Constraint Banner */}
          {data.hostingSafety.warning && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                Vercel Serverless Hosting Reality &amp; Storage Guarantee
              </div>
              <p className="text-xs text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
                {data.hostingSafety.warning}
              </p>
            </div>
          )}

          {/* Synchronization Control Section */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Primary Recovery &amp; Data Synchronization
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Replays outbox mutations from the fallback database into Neon PostgreSQL with non-blind conflict resolution.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRunSync(true)}
                  disabled={syncing || data.syncSummary.pendingCount === 0}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                >
                  Dry-Run Validate
                </button>
                <button
                  onClick={() => handleRunSync(false)}
                  disabled={syncing || data.syncSummary.pendingCount === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all disabled:opacity-50"
                >
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Execute Synchronization
                </button>
              </div>
            </div>

            {/* Sync Result Banner */}
            {syncResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                  syncResult.status === "completed"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300"
                    : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300"
                }`}
              >
                <div className="font-bold flex items-center gap-2">
                  {syncResult.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  )}
                  Synchronization Batch Result: {syncResult.status.toUpperCase()}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                  <div>Total: {syncResult.totalEvents}</div>
                  <div>Synced: {syncResult.syncedCount}</div>
                  <div>Conflicts: {syncResult.conflictsCount}</div>
                  <div>Failures: {syncResult.failuresCount}</div>
                </div>
              </div>
            )}

            {/* Synchronization History Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                Recent Synchronization Audits
              </h3>
              {history.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No synchronization runs recorded yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Run ID</th>
                        <th className="py-2.5 px-3 font-semibold">Source &rarr; Target</th>
                        <th className="py-2.5 px-3 font-semibold">Events</th>
                        <th className="py-2.5 px-3 font-semibold">Status</th>
                        <th className="py-2.5 px-3 font-semibold">Started At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                      {history.map((h) => (
                        <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300 font-bold">{h.id.substring(0, 16)}...</td>
                          <td className="py-2 px-3 text-slate-500">
                            {h.sourceProvider} &rarr; {h.targetProvider}
                          </td>
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                            {h.syncedCount}/{h.eventsCount} (C: {h.conflictsCount})
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                h.status === "completed"
                                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                  : h.status === "partial"
                                  ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                                  : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                              }`}
                            >
                              {h.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-500">
                            {new Date(h.startedAt).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* Mode Switching Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Change Database Operating Mode
              </h3>
              <button
                onClick={() => setShowSwitchModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSwitchSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Target Operating Mode</label>
                <select
                  value={targetMode}
                  onChange={(e) => setTargetMode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                >
                  <option value="neon_primary">Mode A: Neon Primary (Default Authoritative Production)</option>
                  <option
                    value="emergency_fallback"
                    disabled={data?.hostingSafety.isVercel && !data.hostingSafety.isFallbackPersistentAndSafe}
                  >
                    Mode B: Emergency Fallback (Outbox Queued)
                    {data?.hostingSafety.isVercel && !data.hostingSafety.isFallbackPersistentAndSafe ? " — [Blocked: Local file unsafe on Vercel]" : ""}
                  </option>
                  <option
                    value="local_development"
                    disabled={data?.hostingSafety.isProduction || data?.hostingSafety.isVercel}
                  >
                    Mode C: Local Development (SQLite File)
                    {data?.hostingSafety.isProduction || data?.hostingSafety.isVercel ? " — [Blocked in Production]" : ""}
                  </option>
                  <option value="maintenance">Mode D: Maintenance (Read-Only / Writes Blocked)</option>
                </select>
              </div>

              {/* Mode Consequence Explanation Box */}
              <div className="p-3.5 rounded-xl border space-y-1.5 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                <div className="font-bold flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400">
                  <Info className="w-3.5 h-3.5" /> Consequences of Selected Mode
                </div>
                <p className="text-[11px] leading-relaxed">
                  {targetMode === "neon_primary" && (
                    "Normal production mode. Neon Serverless PostgreSQL is the authoritative database for all reads and writes with multi-AZ failover and automated PITR."
                  )}
                  {targetMode === "emergency_fallback" && (
                    "Emergency failover mode. New reads and writes use the verified fallback database. All mutations are queued in the durable outbox for later non-blind synchronization into Neon."
                  )}
                  {targetMode === "local_development" && (
                    "Uses local file ./data/bishnu.db. Intended only for local machine development and offline test execution. Never permitted in production."
                  )}
                  {targetMode === "maintenance" && (
                    "Disaster mitigation safe mode. Customer orders, checkout, payments, and refunds are immediately blocked on the backend with HTTP 503 to prevent unrecoverable data loss."
                  )}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-purple-900 dark:text-purple-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Fencing Protection
                </div>
                <p className="text-[11px] leading-relaxed">
                  Switching modes increments the fencing token (currently #{data?.controlPlane.fencingToken}).
                  Stale instances will be prevented from writing to the old provider.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Operational Justification (Required)
                </label>
                <textarea
                  value={switchReason}
                  onChange={(e) => setSwitchReason(e.target.value)}
                  placeholder="e.g. Neon primary maintenance window / emergency connectivity failure / recovery verification"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Type <span className="text-purple-600 font-mono font-bold">CONFIRM</span> to verify:
                </label>
                <input
                  type="text"
                  value={switchConfirmation}
                  onChange={(e) => setSwitchConfirmation(e.target.value)}
                  placeholder="CONFIRM"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  required
                />
              </div>

              {switchError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-[11px]">
                  {switchError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSwitchModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={switching || switchConfirmation !== "CONFIRM"}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:opacity-50"
                >
                  {switching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Confirm Mode Switch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
