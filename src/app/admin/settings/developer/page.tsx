"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Code2,
  Terminal,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowLeft,
  User,
  Briefcase,
  Mail,
  Globe,
  Github,
  Linkedin,
  Calendar,
  Layers,
  Sparkles,
  Eye,
  Award,
} from "lucide-react";

interface DeveloperProfileData {
  developerName: string;
  professionalTitle: string;
  biography: string;
  skills: string[];
  projectContribution: string;
  projectStartDate: string | null;
  projectCompletionDate: string | null;
  portfolioUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  contactEmail: string | null;
  avatarUrl: string | null;
  creditsStatement: string;
  isPublished: boolean;
  updatedAt?: number;
}

export default function AdminDeveloperSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [formData, setFormData] = useState<DeveloperProfileData>({
    developerName: "",
    professionalTitle: "",
    biography: "",
    skills: [],
    projectContribution: "",
    projectStartDate: "",
    projectCompletionDate: "",
    portfolioUrl: "",
    githubUrl: "",
    linkedinUrl: "",
    contactEmail: "",
    avatarUrl: "",
    creditsStatement: "",
    isPublished: true,
  });

  const [skillsInput, setSkillsInput] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/admin/developer");
        if (!res.ok) {
          throw new Error("Failed to load developer profile");
        }
        const data = await res.json();
        if (data.profile) {
          setFormData({
            developerName: data.profile.developerName || "",
            professionalTitle: data.profile.professionalTitle || "",
            biography: data.profile.biography || "",
            skills: data.profile.skills || [],
            projectContribution: data.profile.projectContribution || "",
            projectStartDate: data.profile.projectStartDate || "",
            projectCompletionDate: data.profile.projectCompletionDate || "",
            portfolioUrl: data.profile.portfolioUrl || "",
            githubUrl: data.profile.githubUrl || "",
            linkedinUrl: data.profile.linkedinUrl || "",
            contactEmail: data.profile.contactEmail || "",
            avatarUrl: data.profile.avatarUrl || "",
            creditsStatement: data.profile.creditsStatement || "",
            isPublished: Boolean(data.profile.isPublished),
          });
          setSkillsInput((data.profile.skills || []).join(", "));
        }
      } catch (err: any) {
        setMessage({ type: "error", text: err.message || "Failed to load profile" });
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSkillsChange = (val: string) => {
    setSkillsInput(val);
    const parsed = val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setFormData((prev) => ({ ...prev, skills: parsed }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/developer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save developer profile");
      }

      setMessage({ type: "success", text: "Developer credits & profile saved successfully!" });
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save profile" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/settings"
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Settings
            </Link>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Code2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Developer Profile &amp; Authorship Credits
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure the public credits, developer portfolio links, technologies, and platform authorship displayed at /developer.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/developer"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
          >
            <Eye className="w-3.5 h-3.5" />
            View Public Page
            <ExternalLink className="w-3 h-3 opacity-60" />
          </Link>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Grid: Form & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Column */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
          {/* Card: Basic Identity */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" />
              Developer Identity
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Developer Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.developerName}
                  onChange={(e) => setFormData({ ...formData, developerName: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Sayan"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Professional Title / Role *
                </label>
                <input
                  type="text"
                  required
                  value={formData.professionalTitle}
                  onChange={(e) => setFormData({ ...formData, professionalTitle: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Antigravity Engineer & Full-Stack Architect"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Avatar Image URL (Optional)
              </label>
              <input
                type="text"
                value={formData.avatarUrl || ""}
                onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://... or leave empty to use avatar initials"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Biography &amp; Background *
              </label>
              <textarea
                required
                rows={3}
                value={formData.biography}
                onChange={(e) => setFormData({ ...formData, biography: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Professional background and development philosophy..."
              />
            </div>
          </div>

          {/* Card: Official Credits Statement */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Official Authorship &amp; Credits Statement
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Credits Statement *
              </label>
              <textarea
                required
                rows={2}
                value={formData.creditsStatement}
                onChange={(e) => setFormData({ ...formData, creditsStatement: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Website developed and maintained by Sayan (Antigravity Engineer) for Bishnu Studio."
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                This exact statement is displayed on the credits page highlight banner and authenticated in site documentation.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Bishnu Studio Specific Contributions
              </label>
              <textarea
                rows={3}
                value={formData.projectContribution}
                onChange={(e) => setFormData({ ...formData, projectContribution: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Engineered the full e-commerce store, PVC card printing workflow, UPI reconciliation..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Project Start Date
                </label>
                <input
                  type="text"
                  value={formData.projectStartDate || ""}
                  onChange={(e) => setFormData({ ...formData, projectStartDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. October 2024"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Project Completion / Phase Date
                </label>
                <input
                  type="text"
                  value={formData.projectCompletionDate || ""}
                  onChange={(e) => setFormData({ ...formData, projectCompletionDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Active Maintenance (2026)"
                />
              </div>
            </div>
          </div>

          {/* Card: Skills & Social Links */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              Technologies &amp; Verified Links
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Technologies / Skills (Comma-separated)
              </label>
              <input
                type="text"
                value={skillsInput}
                onChange={(e) => handleSkillsChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Next.js 15, TypeScript, SQLite, Drizzle ORM, Tailwind CSS"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {formData.skills.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Portfolio Website URL
                </label>
                <input
                  type="text"
                  value={formData.portfolioUrl || ""}
                  onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://yourportfolio.dev"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  GitHub Profile URL
                </label>
                <input
                  type="text"
                  value={formData.githubUrl || ""}
                  onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://github.com/username"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  LinkedIn Profile URL
                </label>
                <input
                  type="text"
                  value={formData.linkedinUrl || ""}
                  onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://linkedin.com/in/username"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Developer Contact Email
                </label>
                <input
                  type="email"
                  value={formData.contactEmail || ""}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="developer@example.com"
                />
              </div>
            </div>
          </div>

          {/* Visibility Toggle */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Publish Developer Credits
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  When enabled, the /developer route and footer links will display the engineering profile publicly.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isPublished}
                  onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm shadow-sm transition"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving Changes..." : "Save Developer Profile"}
            </button>
          </div>
        </form>

        {/* Live Preview Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Live Card Preview
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  formData.isPublished
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {formData.isPublished ? "Published" : "Draft / Private"}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-4">
                {formData.avatarUrl ? (
                  <img
                    src={formData.avatarUrl}
                    alt={formData.developerName}
                    className="w-16 h-16 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-sm">
                    {formData.developerName ? formData.developerName.charAt(0) : "S"}
                  </div>
                )}
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {formData.developerName || "Developer Name"}
                  </h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    {formData.professionalTitle || "Professional Title"}
                  </p>
                  {(formData.projectStartDate || formData.projectCompletionDate) && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formData.projectStartDate || "Start"} &ndash;{" "}
                      {formData.projectCompletionDate || "End"}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Credits Statement
                </span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                  {formData.creditsStatement || "No credits statement entered"}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Skills &amp; Technologies
                </span>
                <div className="flex flex-wrap gap-1">
                  {formData.skills.length > 0 ? (
                    formData.skills.map((s, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No skills added</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
