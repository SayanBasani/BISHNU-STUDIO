import React from "react";
import { ShieldCheck, Lock, Trash2, EyeOff, Server, Clock } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          Data Security & Retention Policy
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          Privacy Policy & Identity Document Safeguards
        </h1>
        <p className="text-gray-500 text-sm">
          Effective Date: October 2026 • Bishnu Studio Document Processing Protocols
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-8 text-sm text-gray-600 leading-relaxed">
        {/* Core Notice */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" />
            1. Protection of Sensitive Identity Documents
          </h2>
          <p>
            Bishnu Studio processes electronic identity files (including e-Aadhaar PDFs, e-PAN cards, Driving Licences from Parivahan Sarathi, Voter ID e-EPIC cards, and digital Ration cards) strictly for the purpose of printing physical PVC cards, lamination, and document copies requested by customers.
          </p>
          <p>
            We adhere to the principle of data minimization: we collect only the digital document file and optional reference number necessary to print and fulfill your physical request.
          </p>
        </section>

        {/* Storage Architecture */}
        <section className="space-y-3 pt-4 border-t border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-600" />
            2. Private Storage & Non-Public Access Controls
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>No Public URLs:</strong> Uploaded identity documents and photographs are never stored in publicly exposed web directories.
            </li>
            <li>
              <strong>Cryptographic Random Identifiers:</strong> File names on disk are replaced with random, cryptographically non-guessable identifiers to prevent enumeration attacks.
            </li>
            <li>
              <strong>Role-Based Access Enforcement:</strong> Document download streams (<code className="bg-gray-100 px-1 py-0.5 rounded text-xs">/api/files/download/[fileId]</code>) require authenticated session cookies and verify that the caller is either the customer who uploaded the document or authorized Bishnu Studio print operators.
            </li>
          </ul>
        </section>

        {/* Retention Policy */}
        <section className="space-y-3 pt-4 border-t border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" />
            3. Automated 30-Day Retention & Deletion Workflow
          </h2>
          <p>
            Customer-uploaded PDF and image files are assigned a maximum retention period of 30 days from the date of order completion.
          </p>
          <p>
            Upon expiration of the retention window, files are automatically shredded and marked deleted from database indexes. Customers can also request immediate manual deletion by contacting the shop manager.
          </p>
        </section>

        {/* Application Logging */}
        <section className="space-y-3 pt-4 border-t border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-amber-600" />
            4. No Identity Content in Application Logs
          </h2>
          <p>
            Application server logs record transactional references, timestamps, and HTTP response codes. Sensitive identity numbers (such as unmasked 12-digit Aadhaar numbers or PAN tax identifiers) and binary image buffers are never written into persistent server logs or diagnostics.
          </p>
        </section>

        {/* Contact */}
        <section className="space-y-2 pt-4 border-t border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">5. Privacy Officer Contact</h2>
          <p>
            For privacy inquiries or immediate data erasure requests:
          </p>
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs font-medium space-y-1">
            <p><strong>Bishnu Studio Privacy Desk</strong></p>
            <p>12/B Station Road, Main Market, West Bengal - 700001</p>
            <p>Email: contact@bishnustudio.com • Phone: +91 98765 43210</p>
          </div>
        </section>
      </div>
    </div>
  );
}
