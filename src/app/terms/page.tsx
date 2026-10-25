import React from "react";
import { FileCheck, AlertTriangle } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          Terms & Conditions of Service
        </h1>
        <p className="text-gray-500 text-sm">
          Bishnu Studio • Printing, Shopping & Document Processing Agreement
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-6 text-sm text-gray-600 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-gray-900">1. Order Placement & Price Calculation</h2>
          <p>
            All prices presented on the website are calculated on our central pricing server based on document page counts, print modes, sheet selections, and media options. Prices submitted by client browsers are re-verified on the server prior to order persistence.
          </p>
        </section>

        <section className="space-y-2 pt-4 border-t border-gray-100">
          <h2 className="text-base font-bold text-gray-900">2. Customer Document Ownership & Legality</h2>
          <p>
            Customers affirm that they possess the legal right and authorization to print any uploaded document, photograph, or identity card. Bishnu Studio reserves the right to decline printing requests that violate copyright laws, contain counterfeit materials, or display unlawful content.
          </p>
        </section>

        <section className="space-y-2 pt-4 border-t border-gray-100">
          <h2 className="text-base font-bold text-gray-900">3. Physical Print Variations & Crop Margins</h2>
          <p>
            Online previews and digital screen displays render in RGB colour space, while physical laser and inkjet printers operate with CMYK pigments. Slight variations in brightness and colour saturation are inherent to physical printing.
          </p>
        </section>

        <section className="space-y-2 pt-4 border-t border-gray-100">
          <h2 className="text-base font-bold text-gray-900">4. Order Cancellation & Refunds</h2>
          <p>
            Orders in <em>Pending</em> status may be cancelled by the customer directly through their account portal. Once an order enters <em>Processing</em> or <em>Ready for Collection</em> status, custom print media has already been expended, and cancellations cannot be accepted.
          </p>
        </section>

        <section className="space-y-2 pt-4 border-t border-gray-100">
          <h2 className="text-base font-bold text-gray-900">5. Store Collection & Unclaimed Orders</h2>
          <p>
            Store pickup orders are held safely at our shop counter for up to 30 days. Customers must present their unique Order Reference (e.g. <code>BS-2610-XXXX</code>) upon collection.
          </p>
        </section>
      </div>
    </div>
  );
}
