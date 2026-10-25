import React from "react";
import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 text-center">
      <div className="max-w-md space-y-4">
        <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
          <Printer className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900">404</h1>
        <h2 className="text-xl font-bold text-gray-800">Page Not Found</h2>
        <p className="text-sm text-gray-500">
          The requested service page, product, or document does not exist or may have been moved.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
