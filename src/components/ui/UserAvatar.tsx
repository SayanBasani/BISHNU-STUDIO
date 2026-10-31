"use client";

import React, { useState, useEffect } from "react";

interface UserAvatarProps {
  src?: string | null;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  textClassName?: string;
  alt?: string;
}

const SIZE_MAP = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-7 h-7 text-xs",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
  xl: "w-16 h-16 text-xl",
};

export default function UserAvatar({
  src,
  name,
  size = "md",
  className = "",
  textClassName = "",
  alt,
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  // Reset image error state whenever the image source URL changes
  useEffect(() => {
    setImgError(false);
  }, [src]);

  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;
  const initial = (name || "U").trim().charAt(0).toUpperCase() || "U";

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={alt || name || "User Avatar"}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover shrink-0 border border-blue-500/40 shadow-sm ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800 shadow-sm select-none ${sizeClass} ${className} ${textClassName}`}
      aria-label={alt || name}
    >
      <span>{initial}</span>
    </div>
  );
}
