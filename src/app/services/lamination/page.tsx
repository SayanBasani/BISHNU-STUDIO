"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import FileUpload from "@/components/FileUpload";
import { formatINR } from "@/lib/utils";
import { createDirectServiceIntent, saveCheckoutIntent } from "@/lib/checkout";
import {
  Layers,
  ShieldCheck,
  Check,
  ShoppingBag,
  Sparkles,
  Zap,
} from "lucide-react";

export default function LaminationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { addItem } = useCart();

  const [laminationSize, setLaminationSize] = useState("a4_glossy");
  const [sheets, setSheets] = useState(1);
  const [copies, setCopies] = useState(1);
  const [instructions, setInstructions] = useState("");
  const [uploadedFile, setUploadedFile] = useState<any>(null);

  const [priceData, setPriceData] = useState<{
    unitPrice: number;
    totalPrice: number;
    description: string;
  }>({
    unitPrice: 20,
    totalPrice: 20,
    description: "A4 Thermal Lamination (Glossy)",
  });
  const [calculating, setCalculating] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const fetchPrice = async () => {
      setCalculating(true);
      try {
        const res = await fetch("/api/pricing/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceType: "lamination",
            payload: { laminationSize, sheets, copies },
          }),
        });
        const data = await res.json();
        if (data.success && !isCancelled) {
          setPriceData({
            unitPrice: data.unitPrice,
            totalPrice: data.totalPrice,
            description: data.breakdown.description,
          });
        }
      } catch (err) {
        console.error("Lamination price calculate error:", err);
      } finally {
        if (!isCancelled) setCalculating(false);
      }
    };

    fetchPrice();
    return () => {
      isCancelled = true;
    };
  }, [laminationSize, sheets, copies]);

  const validateInput = (): boolean => {
    setError(null);
    if (!user) {
      setError("Please log in or register before submitting an order.");
      return false;
    }
    return true;
  };

  const buildServiceItem = () => {
    const sizeName =
      laminationSize === "id_card"
        ? "ID Card / PVC Size Lamination"
        : laminationSize === "a4_matte"
        ? "A4 Premium Matte Lamination"
        : laminationSize === "legal_glossy"
        ? "Legal Size Lamination"
        : laminationSize === "a3_glossy"
        ? "A3 Heavy Duty Lamination"
        : "A4 Thermal Glossy Lamination";

    return {
      id: `cart_lam_${Date.now()}`,
      itemType: "lamination" as const,
      name: sizeName,
      description: `${sheets} Sheets × ${copies} Sets (${sheets * copies} Laminations)${
        uploadedFile ? ` | File: ${uploadedFile.originalFilename}` : " | Bring document to counter"
      }`,
      quantity: copies,
      unitPrice: priceData.unitPrice,
      totalPrice: priceData.totalPrice,
      serviceId: "srv_lam",
      fileIds: uploadedFile ? [uploadedFile.fileId] : [],
      configuration: {
        laminationSize,
        sheets,
        specialInstructions: instructions.trim() || undefined,
        uploadedFiles: uploadedFile
          ? [
              {
                fileId: uploadedFile.fileId,
                originalName: uploadedFile.originalFilename,
                fileSize: uploadedFile.fileSize,
                mimeType: uploadedFile.mimeType,
              },
            ]
          : [],
      },
    };
  };

  const handleAddToCart = () => {
    if (!validateInput()) return;
    addItem(buildServiceItem());
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
    }, 3000);
  };

  const handleDirectOrder = () => {
    if (!validateInput()) return;
    const item = buildServiceItem();
    const intent = createDirectServiceIntent(item);
    saveCheckoutIntent(intent);
    router.push("/checkout?intent=direct_service");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 text-xs font-semibold">
          <Layers className="w-4 h-4" />
          Heavy-Duty Thermal Pouch Sealing
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Document Lamination Service
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-sm max-w-2xl leading-relaxed">
          Preserve your valuable certificates, marksheet originals, land deeds, and badges with heavy-grade hot-roll thermal lamination pouches.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Configuration */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
          {/* Lamination Size & Finish */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Select Pouch Size &amp; Thickness
            </label>
            <div className="space-y-2">
              {[
                {
                  key: "a4_glossy",
                  title: "A4 Thermal Lamination (Glossy 125 Micron)",
                  desc: "Standard high-gloss crystal clarity for marks cards, certificates, and resumes",
                  price: "₹20 / sheet",
                },
                {
                  key: "a4_matte",
                  title: "A4 Premium Matte Lamination (250 Micron Heavy)",
                  desc: "Anti-glare, fingerprint resistant luxury velvet matte finish for diplomas",
                  price: "₹35 / sheet",
                },
                {
                  key: "id_card",
                  title: "ID Card / Badge Pouch",
                  desc: "Pre-cut badge size (65 × 95 mm) with optional clip slot",
                  price: "₹10 / sheet",
                },
                {
                  key: "legal_glossy",
                  title: "Legal Size (8.5 × 14 inch) Pouch",
                  desc: "Heavy thermal pouch for stamp papers, court agreements and deeds",
                  price: "₹25 / sheet",
                },
                {
                  key: "a3_glossy",
                  title: "A3 Large Poster Size (12 × 18 inch)",
                  desc: "Industrial hot-melt pouch for blueprints, charts, and display menus",
                  price: "₹50 / sheet",
                },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setLaminationSize(opt.key)}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition ${
                    laminationSize === opt.key
                      ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/40 text-purple-950 dark:text-purple-200 ring-1 ring-purple-600"
                      : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-900"
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold">{opt.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</p>
                  </div>
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-950 px-2 py-1 rounded">
                    {opt.price}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional File Upload (if customer wants Bishnu Studio to print and laminate) */}
          <div className="pt-2">
            <FileUpload
              category="general_document"
              label="Upload Document File (Optional)"
              helperText="If you need us to print the document before laminating, upload it here. Or you can bring your physical sheets directly to the shop counter."
              currentFile={uploadedFile}
              onFileUploaded={(f) => setUploadedFile(f)}
              onFileRemoved={() => setUploadedFile(null)}
            />
          </div>

          {/* Quantities */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Number of Sheets
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={sheets}
                onChange={(e) =>
                  setSheets(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-full px-3 py-2 rounded-xl input-theme text-sm font-bold text-center"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Number of Sets
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={copies}
                onChange={(e) =>
                  setCopies(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-full px-3 py-2 rounded-xl input-theme text-sm font-bold text-center"
              />
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Special Handling Instructions <span className="text-xs font-normal text-gray-400 dark:text-slate-500">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Trim 2mm margin, punch slot on left for lanyard, round corners..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-4 py-2 rounded-xl input-theme text-sm"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
              {error}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleDirectOrder}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/25 flex items-center justify-center gap-2 transition"
            >
              <Zap className="w-5 h-5" /> Order Lamination Now (Direct Checkout)
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleAddToCart}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs border transition flex items-center justify-center gap-2 ${
                  added
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                }`}
              >
                {added ? (
                  <>
                    <Check className="w-4 h-4" /> Added to Cart!
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" /> Add to Cart
                  </>
                )}
              </button>

              <Link
                href="/cart"
                className="py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs text-center transition"
              >
                View Cart
              </Link>
            </div>
          </div>
        </div>

        {/* Right: Price Snapshot */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 space-y-5 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <span>Price Summary</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                Server Verified
              </span>
            </h3>

            <div className="space-y-2.5 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Selected Pouch:</span>
                <span className="font-semibold text-gray-900 dark:text-white text-right">
                  {priceData.description}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Rate per Sheet:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatINR(priceData.unitPrice)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Pouches:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {sheets * copies} sheets
                </span>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-slate-800 pt-3 flex items-baseline justify-between">
              <span className="font-bold text-gray-900 dark:text-white text-base">Total Estimated Price:</span>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
                  {calculating ? "..." : formatINR(priceData.totalPrice)}
                </span>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">All taxes included</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
