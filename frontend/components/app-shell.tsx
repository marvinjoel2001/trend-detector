"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

import { useI18n } from "../lib/i18n";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t, language, setLanguage } = useI18n();
  const links = [
    { href: "/", label: t("navDashboard") },
    { href: "/live-trends", label: t("navLiveTrends") },
    { href: "/prompt-feed", label: t("navPromptFeed") },
    { href: "/prompt-generator", label: t("navPromptGenerator") },
    { href: "/history", label: t("navHistory") },
    { href: "/forecast", label: t("navForecast") },
    { href: "/settings", label: t("navSettings") },
  ];
  return (
    <div className="h-screen overflow-hidden bg-transparent text-[var(--on-surface)]">
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-white/5 bg-black/45 p-6 backdrop-blur-xl">
        <div className="mb-10">
          <span className="text-gradient block font-headline text-2xl font-extrabold tracking-tight">TrendPrompt</span>
          <span className="px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">AI Engine</span>
        </div>
        <nav className="space-y-2">
          {links.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  active ? "bg-white/10 text-white shadow-[0_0_14px_rgba(255,255,255,0.14)]" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <header className="fixed right-0 top-0 flex h-16 w-[calc(100%-16rem)] items-center justify-between border-b border-white/5 bg-black/30 px-8 backdrop-blur-md">
        <h1 className="font-headline text-lg font-bold">TrendPrompt Engine</h1>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-400">{t("subtitle")}</p>
          <label className="text-xs text-slate-400">{t("language")}</label>
          <select
            className="rounded border border-white/20 bg-black/55 px-2 py-1 text-xs"
            value={language}
            onChange={(e) => setLanguage(e.target.value as "en" | "es")}
          >
            <option value="en">EN</option>
            <option value="es">ES</option>
          </select>
        </div>
      </header>
      <main className="ml-64 mt-16 h-[calc(100vh-4rem)] overflow-auto p-8 app-scrollbar">{children}</main>
    </div>
  );
}
