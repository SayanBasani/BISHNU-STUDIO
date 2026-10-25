import React from "react";
import Link from "next/link";
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  PackageCheck,
  CreditCard,
  FileText,
} from "lucide-react";
import { getShopSettings } from "@/lib/settings";
import { resolveBusinessName } from "@/lib/business";

export const dynamic = "force-dynamic";

export default async function ReturnsPolicyPage() {
  const settings = await getShopSettings();
  const businessName = resolveBusinessName(settings.shopName);
  const returnWindowDays = settings.returnWindowDays || 7;
  const returnPolicyNotice = settings.returnPolicyNotice;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-xs font-semibold">
          <RotateCcw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Customer Satisfaction &amp; Fair Returns
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Returns, Exchanges &amp; Refund Policy
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Last updated: October 2026 • Standard Fulfillment &amp; Return Terms for {businessName}
        </p>
      </div>

      {/* Main Highlights Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-sm">
            <Clock className="w-5 h-5" />
            <span>Return Window</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {returnWindowDays} Days
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Eligible products may be returned within {returnWindowDays} days of verified delivery.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
            <CreditCard className="w-5 h-5" />
            <span>Refund Settlement</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            Direct UPI / Bank
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Approved refunds are settled directly to original payment method or bank account with official UTR reference.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold text-sm">
            <PackageCheck className="w-5 h-5" />
            <span>Exchange Option</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            Free Replacement
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Choose immediate replacement for damaged items or incorrect sizes/specifications.
          </p>
        </div>
      </div>

      {/* Custom Studio Notice if configured */}
      {returnPolicyNotice && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">Studio Policy Notice:</span>
            <span>{returnPolicyNotice}</span>
          </div>
        </div>
      )}

      {/* Main Content Box */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-8 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
        {/* Section 1: Eligibility */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            1. Return &amp; Exchange Eligibility Criteria
          </h2>
          <p>
            At {businessName}, we take immense pride in the craftsmanship of our printing services and the quality of our office stationery products. To protect both customers and operators, our policy distinguishes between retail products and customized print jobs.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Eligible items */}
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Eligible for Return / Exchange</span>
              </div>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-emerald-900 dark:text-emerald-200">
                <li>Unopened office &amp; school stationery items in original packaging.</li>
                <li>Defective or physically damaged pens, notebooks, files, and staplers.</li>
                <li>Incorrect item delivered compared to the order invoice.</li>
                <li>Custom print orders that arrive defective due to studio equipment malfunction or incorrect specifications caused by our operators.</li>
              </ul>
            </div>

            {/* Non-returnable items */}
            <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 font-semibold text-rose-800 dark:text-rose-300">
                <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Non-Returnable Items</span>
              </div>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-rose-900 dark:text-rose-200">
                <li>Personalized PVC Identity Cards (Aadhaar, PAN, Voter, DL) printed to customer-submitted specifications.</li>
                <li>Custom document printouts and thermal lamination approved and delivered as requested.</li>
                <li>Used or opened consumable stationery where protective seals have been tampered with.</li>
                <li>Return requests initiated after {returnWindowDays} days of successful delivery.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 2: Step-by-Step Return Process */}
        <section className="space-y-4 pt-6 border-t border-gray-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            2. How to Request a Return or Replacement
          </h2>
          <p>
            You can initiate a return or replacement directly through your customer account without needing to call or email:
          </p>

          <ol className="space-y-3 pl-2">
            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0 mt-0.5">
                1
              </span>
              <div>
                <strong className="text-gray-900 dark:text-white">Navigate to Your Completed Order:</strong>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Go to <Link href="/account/orders" className="text-blue-600 dark:text-blue-400 underline">Order History</Link>, click on the fulfilled order, and select <strong>&quot;Request Return / Exchange&quot;</strong>.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0 mt-0.5">
                2
              </span>
              <div>
                <strong className="text-gray-900 dark:text-white">Select Items &amp; State Reason:</strong>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Choose the specific items and quantities you want to return, pick a valid reason (defective, wrong item, damaged in transit), and choose whether you prefer a <strong>Refund</strong> or an <strong>Exchange</strong>.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0 mt-0.5">
                3
              </span>
              <div>
                <strong className="text-gray-900 dark:text-white">Studio Verification &amp; Pickup:</strong>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Our team reviews the request within 24–48 hours. Once approved, our courier or delivery agent will coordinate doorstep pickup or provide local store drop-off instructions.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0 mt-0.5">
                4
              </span>
              <div>
                <strong className="text-gray-900 dark:text-white">Physical Inspection &amp; Settlement:</strong>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Upon passing inspection, your refund is disbursed with a real banking UTR reference, or the replacement item is immediately dispatched.
                </p>
              </div>
            </li>
          </ol>
        </section>

        {/* Section 3: Frequently Asked Questions */}
        <section className="space-y-4 pt-6 border-t border-gray-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            3. Common Return Questions
          </h2>

          <div className="space-y-3">
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-1">
              <p className="font-semibold text-gray-900 dark:text-white text-xs">
                How long does the refund take to reflect in my bank?
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Once approved and processed by our admin team, UPI and IMPS bank transfers are usually instantaneous. You will find the transaction UTR reference code directly recorded on your Return Details page.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-1">
              <p className="font-semibold text-gray-900 dark:text-white text-xs">
                What if an Aadhaar or PAN card was printed with errors?
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                If the error occurred due to studio printing defects, image misalignment, or incorrect card stock, we will reprint and deliver the corrected card at zero extra charge. Please contact customer support immediately.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-1">
              <p className="font-semibold text-gray-900 dark:text-white text-xs">
                Can I cancel a return request after submitting?
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Yes. If your return request is still in &quot;Pending&quot; or &quot;Approved&quot; status prior to item pickup, you may contact our support counter to cancel the return.
              </p>
            </div>
          </div>
        </section>

        {/* Need Help CTA */}
        <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">Have questions about an existing order?</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Check your order details or contact our studio counter.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/account/orders"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition"
            >
              <span>View Your Orders</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 font-medium text-xs transition"
            >
              <span>Contact Support</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
