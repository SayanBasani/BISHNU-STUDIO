"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  FileCheck,
  AlertCircle,
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";

interface UploadedFile {
  fileId: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  pageCount?: number;
  downloadUrl: string;
}

interface FileUploadProps {
  category: "pvc_document" | "general_document" | "photo";
  label?: string;
  helperText?: string;
  onFileUploaded: (file: UploadedFile) => void;
  onFileRemoved?: () => void;
  currentFile?: UploadedFile | null;
}

export default function FileUpload({
  category,
  label = "Upload Document",
  helperText,
  onFileUploaded,
  onFileRemoved,
  currentFile,
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPhoto = category === "photo";
  const allowedFormats = isPhoto
    ? "JPEG, PNG, WebP"
    : "PDF, JPEG, PNG";
  const maxSizeMb = isPhoto ? 10 : 25;
  const acceptAttr = isPhoto
    ? "image/jpeg,image/png,image/webp"
    : "application/pdf,image/jpeg,image/png";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Initial browser-side sanity check
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File is too large. Maximum allowed size is ${maxSizeMb} MB.`);
      return;
    }

    // Generate local preview for image files
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }

    // Submit to server for genuine magic-byte verification and safe storage
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    try {
      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "File upload failed.");
      }

      onFileUploaded(data.file);
    } catch (err: any) {
      setError(err?.message || "Failed to upload document. Please ensure you are logged in.");
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (onFileRemoved) onFileRemoved();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
          {label}
        </label>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
          Allowed: {allowedFormats} (Max {maxSizeMb} MB)
        </span>
      </div>

      {helperText && <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>}

      {!currentFile ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
            isUploading
              ? "bg-blue-50/50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500"
              : "border-gray-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50/80 dark:hover:bg-slate-800/60 bg-white dark:bg-slate-900/60"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptAttr}
            onChange={handleFileChange}
            className="hidden"
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-2 py-3">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Verifying document & calculating page count...
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Running server-side magic byte inspection
              </p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Click to select file or drag & drop here
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Private storage: files are accessible only to you and shop operators
                </p>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/30 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="w-14 h-14 object-cover rounded-lg border border-gray-200 dark:border-slate-700 shrink-0"
              />
            ) : currentFile.mimeType === "application/pdf" ? (
              <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                <ImageIcon className="w-6 h-6" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {currentFile.originalFilename}
                </p>
                <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                <span>{(currentFile.fileSize / 1024).toFixed(1)} KB</span>
                {currentFile.pageCount && currentFile.pageCount > 0 && (
                  <span className="font-semibold text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950 px-2 py-0.5 rounded">
                    {currentFile.pageCount} {currentFile.pageCount === 1 ? "Page" : "Pages"}
                  </span>
                )}
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">Verified Safe</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
            title="Remove or replace file"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Photo Preview crop notice */}
      {isPhoto && previewUrl && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1">
          Note: Preview is for orientation verification only and does not represent physical lab photo crop or paper texture.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
