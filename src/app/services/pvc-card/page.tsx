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
  CreditCard,
  ShieldCheck,
  Check,
  ShoppingBag,
  Info,
  Clock,
  Sparkles,
  Zap,
} from "lucide-react";

export default function PvcCardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { addItem } = useCart();

  const [documentType, setDocumentType] = useState("aadhaar");
  const [copies, setCopies] = useState(1);
  const [documentNumber, setDocumentNumber] = useState("");
  const [instructions, setInstructions] = useState("");
  const [uploadedFile, setUploadedFile] = useState<any>(null);

  const [priceData, setPriceData] = useState<{
    unitPrice: number;
    totalPrice: number;
    description: string;
  }>({
    unitPrice: 50,
    totalPrice: 50,
    description: "Aadhaar Card PVC Printing",
  });
  const [calculating, setCalculating] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recalculate price dynamically whenever docType or copies changes
  useEffect(() => {
    let isCancelled = false;
    const fetchPrice = async () => {
      setCalculating(true);
      try {
        const res = await fetch("/api/pricing/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceType: "pvc_card",
            payload: { documentType, copies },
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
        console.error("Price calculate failed:", err);
      } finally {
        if (!isCancelled) setCalculating(false);
      }
    };

    fetchPrice();
    return () => {
      isCancelled = true;
    };
  }, [documentType, copies]);

  const validateInput = (): boolean => {
    setError(null);
    if (!user) {
      setError("Please log in or register before submitting your printing order.");
      return false;
    }
    if (!uploadedFile) {
      setError("Please upload your PDF or ID document image file.");
      return false;
    }
    return true;
  };

  const buildServiceItem = () => {
    const docName =
      documentType === "aadhaar"
        ? "Aadhaar Card"
        : documentType === "pan"
        ? "PAN Card"
        : documentType === "dl"
        ? "Driving Licence"
        : documentType === "voter"
        ? "Voter ID Card"
        : documentType === "ration"
        ? "Ration Card"
        : "Custom ID Card";

    return {
      id: `cart_pvc_${Date.now()}`,
      itemType: "pvc_card" as const,
      name: `${docName} PVC Card Printing`,
      description: `${copies} ${copies === 1 ? "Card" : "Cards"} | File: ${uploadedFile.originalFilename}`,
      quantity: copies,
      unitPrice: priceData.unitPrice,
      totalPrice: priceData.totalPrice,
      serviceId: "srv_pvc",
      fileIds: [uploadedFile.fileId],
      configuration: {
        documentType,
        documentNumber: documentNumber.trim() || undefined,
        specialInstructions: instructions.trim() || undefined,
        uploadedFiles: [
          {
            fileId: uploadedFile.fileId,
            originalName: uploadedFile.originalFilename,
            fileSize: uploadedFile.fileSize,
            mimeType: uploadedFile.mimeType,
          },
        ],
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
      {/* Page Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 text-xs font-semibold">
          <CreditCard className="w-4 h-4" />
          High-Durability PVC Smart Card
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          PVC Card Printing Service
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-sm max-w-2xl leading-relaxed">
          Convert your government e-documents (Aadhaar, PAN, Driving Licence, Voter ID, Ration cards) into standard credit-card thickness waterproof PVC cards with high-gloss scratch-resistant thermal finish.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Configuration Form */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
          {/* Document Type Dropdown */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Select Document Type <span className="text-red-500">*</span>
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl input-theme text-sm font-medium"
            >
              <option value="aadhaar">Aadhaar Card (e-Aadhaar)</option>
              <option value="pan">PAN Card (e-PAN / Income Tax)</option>
              <option value="dl">Driving Licence (Parivahan Sarathi)</option>
              <option value="voter">Voter ID Card (e-EPIC)</option>
              <option value="ration">Ration Card (NFSA / Digital)</option>
              <option value="other">Other Official ID / Member Card</option>
            </select>
          </div>

          {/* Secure File Upload */}
          <div className="pt-2">
            <FileUpload
              category="pvc_document"
              label="Upload Document (PDF or Clear Photo)"
              helperText="Upload your official downloaded PDF or scan. Never upload cropped or illegible screenshots."
              currentFile={uploadedFile}
              onFileUploaded={(f) => setUploadedFile(f)}
              onFileRemoved={() => setUploadedFile(null)}
            />
          </div>

          {/* Number of Copies */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Number of Copies
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="50"
                value={copies}
                onChange={(e) =>
                  setCopies(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-28 px-4 py-2 rounded-xl input-theme text-sm font-bold text-center"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Printed on 0.76mm thermal smart card blank
              </span>
            </div>
          </div>

          {/* Optional Document Number (Only if relevant) */}
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Document Number <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Optional reference)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Last 4 digits of Aadhaar or PAN number"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              className="w-full px-4 py-2 rounded-xl input-theme text-sm"
            />
            <p className="text-[11px] text-gray-400 dark:text-slate-500">
              Only provide if needed for order verification. We do not store unmasked identity numbers permanently.
            </p>
          </div>

          {/* Special Instructions */}
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Printing Instructions <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Any specific instructions (e.g. crop front and back, matte finish, punch hole on top)..."
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
              className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition"
            >
              <Zap className="w-5 h-5" /> Order This PVC Card Now (Direct Checkout)
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

        {/* Right: Price Breakdown & Security Guarantee */}
        <div className="lg:col-span-5 space-y-6">
          {/* Price Snapshot Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 space-y-5 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <span>Price Summary</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                Live Server Quote
              </span>
            </h3>

            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Selected Card:</span>
                <span className="font-semibold text-gray-900 dark:text-white capitalize">
                  {documentType}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Base Rate:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatINR(priceData.unitPrice)} / card
                </span>
              </div>
              <div className="flex justify-between">
                <span>Quantity:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {copies} {copies === 1 ? "copy" : "copies"}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-slate-800 pt-3 flex items-baseline justify-between">
              <span className="font-bold text-gray-900 dark:text-white text-base">Estimated Total:</span>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                  {calculating ? "..." : formatINR(priceData.totalPrice)}
                </span>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">Taxes included</p>
              </div>
            </div>
          </div>

          {/* Privacy & Handling Guarantee */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-6 space-y-4 shadow-sm border border-slate-800">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span>Identity Document Protection</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              We understand the sensitive nature of PAN, Aadhaar, and driving licences.
            </p>
            <ul className="text-xs text-gray-300 space-y-2">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Files are saved in secure private storage.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Never exposed via public or guessable links.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Automatically shredded after retention period.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
