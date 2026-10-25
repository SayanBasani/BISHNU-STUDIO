"use client";

import React, { useState } from "react";
import { Store } from "lucide-react";

interface BusinessLogoProps {
  logoUrl?: string | null;
  businessName?: string;
  className?: string;
  fallbackClassName?: string;
}

export function BusinessLogo({
  logoUrl,
  businessName = "Bishnu Studio",
  className = "w-9 h-9 object-contain rounded-lg",
  fallbackClassName = "w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xs shadow-sm",
}: BusinessLogoProps) {
  const [imgError, setImgError] = useState(false);

  const initial = (businessName || "B").trim().charAt(0).toUpperCase();

  if (!logoUrl || imgError) {
    return (
      <div className={fallbackClassName} title={businessName}>
        {initial || <Store className="w-4 h-4 text-white" />}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={businessName}
      className={className}
      onError={() => setImgError(true)}
    />
  );
}
