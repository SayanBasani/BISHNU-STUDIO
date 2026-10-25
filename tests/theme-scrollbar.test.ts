import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Global Theme-Aware Scrollbar System", () => {
  const globalsCssPath = path.resolve(process.cwd(), "src/app/globals.css");
  const themeContextPath = path.resolve(process.cwd(), "src/context/ThemeContext.tsx");
  const layoutPath = path.resolve(process.cwd(), "src/app/layout.tsx");
  const adminLayoutPath = path.resolve(process.cwd(), "src/app/admin/layout.tsx");

  it("should define semantic CSS variables for scrollbars in both light and dark themes", () => {
    const css = fs.readFileSync(globalsCssPath, "utf-8");

    // Light mode scrollbar tokens
    expect(css).toContain("--scrollbar-track: #f1f5f9;");
    expect(css).toContain("--scrollbar-thumb: #cbd5e1;");
    expect(css).toContain("--scrollbar-thumb-hover: #94a3b8;");
    expect(css).toContain("--scrollbar-thumb-active: #64748b;");
    expect(css).toContain("--scrollbar-corner: #f1f5f9;");

    // Dark mode scrollbar tokens
    expect(css).toContain("--scrollbar-track: #0f172a;");
    expect(css).toContain("--scrollbar-thumb: #334155;");
    expect(css).toContain("--scrollbar-thumb-hover: #475569;");
    expect(css).toContain("--scrollbar-thumb-active: #64748b;");
    expect(css).toContain("--scrollbar-corner: #0f172a;");
  });

  it("should define color-scheme on root and dark selectors for browser-level scrollbar adaptation", () => {
    const css = fs.readFileSync(globalsCssPath, "utf-8");

    expect(css).toContain("color-scheme: light;");
    expect(css).toContain("color-scheme: dark;");
  });

  it("should apply standards-compliant W3C scrollbar properties globally", () => {
    const css = fs.readFileSync(globalsCssPath, "utf-8");

    expect(css).toContain("scrollbar-width: thin;");
    expect(css).toContain("scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);");
  });

  it("should implement universal WebKit/Chromium scrollbar pseudo-elements with proper border clipping", () => {
    const css = fs.readFileSync(globalsCssPath, "utf-8");

    expect(css).toContain("::-webkit-scrollbar {");
    expect(css).toContain("width: 8px;");
    expect(css).toContain("height: 8px;");

    expect(css).toContain("::-webkit-scrollbar-track {");
    expect(css).toContain("background: var(--scrollbar-track);");

    expect(css).toContain("::-webkit-scrollbar-thumb {");
    expect(css).toContain("background-color: var(--scrollbar-thumb);");
    expect(css).toContain("border: 2px solid var(--scrollbar-track);");
    expect(css).toContain("background-clip: padding-box;");

    expect(css).toContain("::-webkit-scrollbar-thumb:hover {");
    expect(css).toContain("background-color: var(--scrollbar-thumb-hover);");

    expect(css).toContain("::-webkit-scrollbar-corner {");
    expect(css).toContain("background: var(--scrollbar-corner);");

    // Arrow buttons removed for clean modern UI
    expect(css).toContain("::-webkit-scrollbar-button {");
    expect(css).toContain("display: none;");
  });

  it("should respect prefers-reduced-motion media query for scrollbar transitions", () => {
    const css = fs.readFileSync(globalsCssPath, "utf-8");

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("transition: none;");
  });

  it("should provide utilities for hiding scrollbars and compact scrollbars", () => {
    const css = fs.readFileSync(globalsCssPath, "utf-8");

    expect(css).toContain(".scrollbar-none");
    expect(css).toContain(".no-scrollbar");
    expect(css).toContain(".scrollbar-thin");
  });

  it("should set document style.colorScheme in ThemeContext on theme switch", () => {
    const contextContent = fs.readFileSync(themeContextPath, "utf-8");

    expect(contextContent).toContain('root.style.colorScheme = "dark";');
    expect(contextContent).toContain('root.style.colorScheme = "light";');
  });

  it("should initialize color-scheme in pre-hydration inline script in root layout to prevent theme flash", () => {
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");

    expect(layoutContent).toContain("document.documentElement.style.colorScheme = 'dark';");
    expect(layoutContent).toContain("document.documentElement.style.colorScheme = 'light';");
  });

  it("should configure admin sidebar with vertical scrolling and horizontal overflow guard", () => {
    const adminLayoutContent = fs.readFileSync(adminLayoutPath, "utf-8");

    // Both desktop and mobile sidebar navigation regions must have overflow-y-auto and overflow-x-hidden
    expect(adminLayoutContent).toContain("overflow-y-auto overflow-x-hidden overscroll-contain");
  });
});
