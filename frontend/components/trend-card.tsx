"use client";

import Link from "next/link";

import { Trend } from "../lib/types";
import { useI18n } from "../lib/i18n";

export function TrendCard({ trend }: { trend: Trend }) {
  const { t } = useI18n();
  const velocity = Math.round(trend.velocity_score * 100) / 100;
  return (
    <article className="glass-panel rounded-2xl border border-white/10 p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <span className="inline-block rounded bg-indigo-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300">
            {trend.platform}
          </span>
          <h3 className="mt-2 font-headline text-xl font-bold">{trend.title}</h3>
        </div>
        <div className="rounded-md bg-slate-900/40 px-2 py-1 text-xs">
          {Math.round(trend.rank_score)} / 100
        </div>
      </div>
      <div className="mb-5 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-slate-400">{trend.category}</span>
        <span className="text-sm font-bold text-[var(--primary)]">{t("velocity")} {velocity >= 0 ? "+" : ""}{velocity}</span>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-300">{t("views")}: {Number(trend.metadata?.views || 0).toLocaleString()}</p>
        <Link
          href={`/trends/${trend.id}`}
          className="btn-gradient rounded-full px-4 py-2 text-xs font-bold text-slate-900"
        >
          {t("openTrend")}
        </Link>
      </div>
    </article>
  );
}
