import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import { getDeveloperProfile } from "@/lib/settings";
import {
  Code2,
  Terminal,
  ExternalLink,
  Github,
  Linkedin,
  Mail,
  Globe,
  Award,
  CheckCircle2,
  ArrowLeft,
  Calendar,
  Layers,
  Sparkles,
  ShieldCheck,
  Server,
  Cpu,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Developer Credits & Engineering Profile | Bishnu Studio",
  description:
    "Engineering credits, software architecture, and developer profile for the Bishnu Studio digital platform.",
};

export default async function DeveloperCreditsPage() {
  const profile = await getDeveloperProfile();

  if (!profile.isPublished) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 mb-4">
            <Terminal className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Developer Credits
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
            The developer profile is currently private or being updated. Please check back later.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 py-10 sm:py-14">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Breadcrumb / Back link */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Bishnu Studio
          </Link>
        </div>

        {/* Hero Card */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-10 shadow-sm mb-8">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
            {/* Avatar / Monogram */}
            <div className="relative shrink-0">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.developerName}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-700 shadow-md"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-3xl shadow-md border-2 border-white/20">
                  {profile.developerName.charAt(0)}
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full p-1 text-white shadow-sm" title="Verified Engineer">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            {/* Title & Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                Verified Engineering Profile
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {profile.developerName}
              </h1>

              <p className="text-base font-medium text-blue-600 dark:text-blue-400 mt-1">
                {profile.professionalTitle}
              </p>

              {(profile.projectStartDate || profile.projectCompletionDate) && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-2">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Project Timeline: {profile.projectStartDate || "Ongoing"} &ndash;{" "}
                    {profile.projectCompletionDate || "Active"}
                  </span>
                </div>
              )}

              {/* Bio */}
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-4 leading-relaxed whitespace-pre-line">
                {profile.biography}
              </p>

              {/* Action Links */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-6">
                {profile.portfolioUrl && (
                  <a
                    href={profile.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Portfolio
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                )}

                {profile.githubUrl && (
                  <a
                    href={profile.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition"
                  >
                    <Github className="w-3.5 h-3.5" />
                    GitHub
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                )}

                {profile.linkedinUrl && (
                  <a
                    href={profile.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition"
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                    LinkedIn
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                )}

                {profile.contactEmail && (
                  <a
                    href={`mailto:${profile.contactEmail}`}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold transition"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Contact Developer
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Official Credits Highlight Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-md mb-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
              <Award className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <span className="text-xs font-semibold tracking-wider uppercase text-blue-300">
                Official Authorship & Credits
              </span>
              <p className="text-lg sm:text-xl font-bold text-white mt-1 leading-snug">
                {profile.creditsStatement}
              </p>
              <p className="text-xs text-blue-200/80 mt-2">
                Certified full-stack architecture, secure UPI payment state machine, high-performance database schema, and printing service integration.
              </p>
            </div>
          </div>
        </div>

        {/* Contribution Details & Tech Stack */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Contribution Highlights */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Code2 className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Platform Contributions
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {profile.projectContribution}
            </p>

            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Zero-loss SQLite & Drizzle schema with immutable audit logs</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Server className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Permanent UPI account history & verification state machine</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Cpu className="w-4 h-4 text-purple-500 shrink-0" />
                <span>Mobile-responsive UI with system dark/light mode toggle</span>
              </div>
            </div>
          </div>

          {/* Core Technologies & Skills */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Core Technologies & Skills
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Modern full-stack technologies employed across the Bishnu Studio digital platform:
            </p>

            <div className="flex flex-wrap gap-2">
              {profile.skills && profile.skills.length > 0 ? (
                profile.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200/60 dark:border-slate-700/60"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">No skills specified</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center py-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            &copy; {new Date().getFullYear()} Bishnu Studio. All rights reserved. Platform engineered for reliability and high performance.
          </p>
        </div>
      </div>
    </div>
  );
}
