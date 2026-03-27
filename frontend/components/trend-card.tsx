"use client";

import Link from "next/link";

import { Trend } from "../lib/types";
import { useI18n } from "../lib/i18n";
import { getTrendMedia } from "../lib/trend-media";

export function TrendCard({ trend }: { trend: Trend }) {
  const { t } = useI18n();
  const velocity = Math.round(trend.velocity_score * 100) / 100;
  const media = getTrendMedia(trend);
  const hashtag = typeof trend.metadata?.hashtag === "string" ? trend.metadata.hashtag.trim() : "";
  const isTikTok = trend.platform.toLowerCase() === "tiktok";
  const mainTitle = isTikTok && hashtag ? hashtag : trend.title;
  const subtitle = isTikTok && hashtag && trend.title !== hashtag ? trend.title : null;
  return (
    <article className="glass-panel rounded-2xl border border-white/10 p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <span className="inline-block rounded bg-indigo-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300">
            {trend.platform}
          </span>
          <h3 className="mt-2 font-headline text-xl font-bold">{mainTitle}</h3>
          {subtitle ? <p className="mt-1 text-xs text-slate-300 line-clamp-1">{subtitle}</p> : null}
          {isTikTok && hashtag ? (
            <span className="mt-2 inline-block rounded-full border border-fuchsia-300/30 bg-fuchsia-500/10 px-2 py-1 text-[10px] font-semibold tracking-wide text-fuchsia-200">
              {hashtag}
            </span>
          ) : null}
        </div>
        <div className="rounded-md bg-slate-900/40 px-2 py-1 text-xs">
          {Math.round(trend.rank_score)} / 100
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-slate-900/40">
        {media.videoUrl ? (
          <video
            className="h-40 w-full bg-slate-950/40 object-cover"
            src={media.videoUrl}
            controls
            playsInline
          />
        ) : media.embedUrl ? (
          <iframe
            className="h-40 w-full bg-slate-950/40"
            src={media.embedUrl}
            title={`${trend.title} preview`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : media.imageUrl ? (
          <div
            className="h-40 w-full bg-cover bg-center"
            style={{ backgroundImage: `url('${media.imageUrl}')` }}
            aria-label={t("preview")}
            role="img"
          />
        ) : (
          <div className="flex h-40 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(159,167,255,0.35),_transparent_60%)] text-xs text-slate-300">
            {t("noPreviewAvailable")}
          </div>
        )}
      </div>
      <div className="mb-5 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-slate-400">{trend.category}</span>
        <span className="text-sm font-bold text-[var(--primary)]">{t("velocity")} {velocity >= 0 ? "+" : ""}{velocity}</span>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-300">{t("views")}: {Number(trend.metadata?.views || 0).toLocaleString()}</p>
        <div className="flex items-center gap-2">
          {media.sourceUrl ? (
            <a
              href={media.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/20 px-3 py-2 text-[11px] font-semibold text-slate-100 transition hover:border-white/40"
            >
              {t("openSource")}
            </a>
          ) : null}
          <Link
            href={`/trends/${trend.id}`}
            className="btn-gradient rounded-full px-4 py-2 text-xs font-bold text-slate-900"
          >
            {t("openTrend")}
          </Link>
        </div>
      </div>
    </article>
  );
}
