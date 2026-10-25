"use client";

import React, { useState, useEffect } from "react";
import { formatINR } from "@/lib/utils";
import {
  DollarSign,
  Check,
  Save,
  Loader2,
  RefreshCw,
  AlertCircle,
  CreditCard,
  FileText,
  Layers,
  Camera,
  CheckCircle2,
  Clock,
  Info,
} from "lucide-react";

interface ServiceOption {
  id: string;
  group: string;
  key: string;
  name: string;
  metadata: any;
  price: number | null;
  unit: string;
  minQuantity: number;
  maxQuantity: number;
  priceId: string | null;
  updatedAt: number | null;
}

interface ServiceCatalogItem {
  id: string;
  key: string;
  name: string;
  description: string;
  isActive: boolean;
  options: ServiceOption[];
}

export default function AdminPricingPage() {
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [priceEdits, setPriceEdits] = useState<Record<string, number>>({});
  const [minQtyEdits, setMinQtyEdits] = useState<Record<string, number>>({});
  const [maxQtyEdits, setMaxQtyEdits] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<string>("all");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/pricing");
      const data = await res.json();
      if (res.ok && data.success) {
        setServices(data.services);

        // Prepopulate edit buffer
        const pMap: Record<string, number> = {};
        const minMap: Record<string, number> = {};
        const maxMap: Record<string, number> = {};

        data.services.forEach((srv: ServiceCatalogItem) => {
          srv.options?.forEach((opt) => {
            if (opt.priceId) {
              pMap[opt.priceId] = opt.price ?? 0;
              minMap[opt.priceId] = opt.minQuantity ?? 1;
              maxMap[opt.priceId] = opt.maxQuantity ?? 1000;
            }
          });
        });

        setPriceEdits(pMap);
        setMinQtyEdits(minMap);
        setMaxQtyEdits(maxMap);
      } else {
        throw new Error(data.error || "Failed to load pricing catalog.");
      }
    } catch (e: any) {
      console.error("Failed to load rates:", e);
      setErrorMsg(e?.message || "Failed to load rates from server.");
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (priceId: string, val: string) => {
    const num = parseFloat(val);
    setPriceEdits((prev) => ({
      ...prev,
      [priceId]: isNaN(num) ? 0 : num,
    }));
  };

  const handleMinQtyChange = (priceId: string, val: string) => {
    const num = parseInt(val, 10);
    setMinQtyEdits((prev) => ({
      ...prev,
      [priceId]: isNaN(num) ? 1 : Math.max(1, num),
    }));
  };

  const handleMaxQtyChange = (priceId: string, val: string) => {
    const num = parseInt(val, 10);
    setMaxQtyEdits((prev) => ({
      ...prev,
      [priceId]: isNaN(num) ? 1000 : Math.max(1, num),
    }));
  };

  const handleSavePrice = async (priceId: string, optionName: string) => {
    const newPrice = priceEdits[priceId];
    const minQty = minQtyEdits[priceId] ?? 1;
    const maxQty = maxQtyEdits[priceId] ?? 1000;

    if (newPrice === undefined || isNaN(newPrice) || newPrice < 0) {
      setErrorMsg(`Price for ${optionName} cannot be negative or invalid.`);
      return;
    }

    if (maxQty < minQty) {
      setErrorMsg(`Maximum quantity (${maxQty}) cannot be less than minimum quantity (${minQty}).`);
      return;
    }

    setSavingId(priceId);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          price: Number(newPrice),
          minQuantity: minQty,
          maxQuantity: maxQty,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update price");

      setSuccessMsg(`✓ Saved ${optionName} rate: ${formatINR(data.price)} (Min: ${minQty}, Max: ${maxQty})`);
      setTimeout(() => setSuccessMsg(null), 3500);

      // Refresh list to update timestamps
      await fetchRates();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save rate");
    } finally {
      setSavingId(null);
    }
  };

  const getServiceIcon = (key: string) => {
    switch (key) {
      case "pvc_card":
        return <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case "document_print":
        return <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case "lamination":
        return <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      case "photo_print":
        return <Camera className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
      default:
        return <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
    }
  };

  const filteredServices =
    activeTab === "all"
      ? services
      : services.filter((s) => s.key === activeTab);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            Printing Service Pricing
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage authoritative rates for PVC cards, document printing, lamination, and photo studio
          </p>
        </div>

        <button
          onClick={fetchRates}
          disabled={loading}
          className="px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition self-start sm:self-auto shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Reload Rates
        </button>
      </div>

      {/* Guidance Note */}
      <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-xs text-purple-900 dark:text-purple-300 flex items-start gap-3 shadow-sm">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
        <div className="space-y-1">
          <p className="font-semibold">Authoritative Database Pricing Engine</p>
          <p className="text-[11px] leading-relaxed text-purple-800 dark:text-purple-300">
            Updated prices apply immediately to all customer-facing service forms, Buy Now direct checkout, and order calculations. Previously placed orders retain their immutable unit price snapshots and are never retroactively altered.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 font-bold flex items-center gap-2 shadow-sm animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Service Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === "all"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          All Services ({services.reduce((acc, s) => acc + (s.options?.length || 0), 0)})
        </button>
        {services.map((srv) => (
          <button
            key={srv.id}
            onClick={() => setActiveTab(srv.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === srv.key
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <span>{srv.name}</span>
            <span className="text-[10px] opacity-75">({srv.options?.length || 0})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Loading pricing matrix...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredServices.map((srv) => (
            <div
              key={srv.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                    {getServiceIcon(srv.key)}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white text-base">
                      {srv.name}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{srv.description}</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Active in Catalog
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Option / Spec</th>
                      <th className="py-3 px-3">Option Key</th>
                      <th className="py-3 px-3">Unit</th>
                      <th className="py-3 px-3 w-40">Configured Rate (INR ₹)</th>
                      <th className="py-3 px-3 w-32">Min - Max Qty</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {srv.options?.map((opt) => {
                      if (!opt.priceId) {
                        return (
                          <tr key={opt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                              {opt.name}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {opt.key}
                            </td>
                            <td className="py-3 px-3">{opt.unit}</td>
                            <td className="py-3 px-3" colSpan={3}>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                <AlertCircle className="w-3.5 h-3.5" /> Price record not initialized
                              </span>
                            </td>
                          </tr>
                        );
                      }

                      const isSaving = savingId === opt.priceId;
                      const currentVal = priceEdits[opt.priceId] ?? (opt.price ?? 0);
                      const minVal = minQtyEdits[opt.priceId] ?? (opt.minQuantity ?? 1);
                      const maxVal = maxQtyEdits[opt.priceId] ?? (opt.maxQuantity ?? 1000);
                      const isDirty =
                        currentVal !== (opt.price ?? 0) ||
                        minVal !== (opt.minQuantity ?? 1) ||
                        maxVal !== (opt.maxQuantity ?? 1000);

                      return (
                        <tr
                          key={opt.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${
                            isDirty ? "bg-purple-50/30 dark:bg-purple-950/20" : ""
                          }`}
                        >
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-900 dark:text-white block">
                              {opt.name}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">
                              Group: {opt.group.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <code className="font-mono text-[11px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800/60">
                              {opt.key}
                            </code>
                          </td>
                          <td className="py-3 px-3 capitalize text-slate-600 dark:text-slate-300">
                            {opt.unit.replace(/_/g, " ")}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-500 dark:text-slate-400">₹</span>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={currentVal}
                                onChange={(e) =>
                                  handlePriceChange(opt.priceId!, e.target.value)
                                }
                                className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 focus:outline-none"
                              />
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="1"
                                value={minVal}
                                onChange={(e) =>
                                  handleMinQtyChange(opt.priceId!, e.target.value)
                                }
                                title="Minimum Quantity"
                                className="w-14 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] font-mono text-center"
                              />
                              <span className="text-slate-400">&ndash;</span>
                              <input
                                type="number"
                                min={minVal}
                                value={maxVal}
                                onChange={(e) =>
                                  handleMaxQtyChange(opt.priceId!, e.target.value)
                                }
                                title="Maximum Quantity"
                                className="w-16 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] font-mono text-center"
                              />
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleSavePrice(opt.priceId!, opt.name)}
                              disabled={isSaving}
                              className={`px-3 py-1.5 rounded-lg text-white font-bold text-[11px] shadow-sm flex items-center gap-1 ml-auto transition disabled:opacity-50 ${
                                isDirty
                                  ? "bg-purple-600 hover:bg-purple-700 ring-2 ring-purple-600/30"
                                  : "bg-slate-700 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
                              }`}
                            >
                              {isSaving ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="w-3.5 h-3.5" /> Save
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
