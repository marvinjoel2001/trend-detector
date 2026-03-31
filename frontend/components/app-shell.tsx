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
    { href: "/tiktok-studio", label: t("navTikTokStudio") },
    { href: "/history", label: t("navHistory") },
    { href: "/forecast", label: t("navForecast") },
    { href: "/settings", label: t("navSettings") },
  ];
  return (
    <div className="h-screen overflow-hidden bg-transparent text-[var(--on-surface)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-12 h-[28rem] w-[28rem] rounded-full bg-cyan-400/16 blur-[120px]" />
        <div className="absolute right-[-8rem] top-[8%] h-[34rem] w-[34rem] rounded-full bg-indigo-400/14 blur-[140px]" />
        <div className="absolute bottom-[-10rem] left-[20%] h-[30rem] w-[30rem] rounded-full bg-emerald-400/10 blur-[130px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.11),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(34,211,238,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0)),linear-gradient(135deg,#04070d_0%,#07111a_36%,#08131d_62%,#04070d_100%)]" />
      </div>
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-white/5 bg-black/45 p-6 backdrop-blur-xl">
        <div className="mb-10">
          <span className="text-gradient block font-headline text-2xl font-extrabold tracking-tight">TrendPrompt</span>
          <span className="px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {language === "es" ? "Panel Creativo" : "Creative Studio"}
          </span>
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
        <h1 className="font-headline text-lg font-bold">TrendPrompt</h1>
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
