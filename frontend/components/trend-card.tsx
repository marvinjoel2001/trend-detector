"use client";

import Link from "next/link";

import { Trend } from "../lib/types";
import { useI18n } from "../lib/i18n";
import { getTrendMedia } from "../lib/trend-media";

type TrendCardProps = {
  trend: Trend;
  onSelectForPrompt?: (trend: Trend, outputType: "video" | "image") => void;
};

export function TrendCard({ trend, onSelectForPrompt }: TrendCardProps) {
  const { t } = useI18n();
  const velocity = Math.round(trend.velocity_score * 100) / 100;
  const media = getTrendMedia(trend);
  const hashtag =
    typeof trend.metadata?.hashtag === "string"
      ? trend.metadata.hashtag.trim()
      : "";
  const isTikTok = trend.platform.toLowerCase() === "tiktok";
  const mainTitle = isTikTok && hashtag ? hashtag : trend.title;
  const subtitle =
    isTikTok && hashtag && trend.title !== hashtag ? trend.title : null;
  const iframeRatio = isTikTok ? "9 / 16" : "16 / 9";
  const suggestedOutputType: "video" | "image" =
    media.videoUrl || media.embedUrl ? "video" : "image";
  const canOpenPromptModal = Boolean(
    onSelectForPrompt && (media.videoUrl || media.embedUrl || media.imageUrl),
  );

  function handleOpenPromptModal() {
    if (!onSelectForPrompt || !canOpenPromptModal) return;
    onSelectForPrompt(trend, suggestedOutputType);
  }

  return (
    <article className="glass-panel mb-5 break-inside-avoid overflow-hidden rounded-2xl border border-white/5 p-4">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <span className="inline-block rounded bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-100">
            {trend.platform}
          </span>
          <h3 className="mt-2 font-headline text-lg font-bold text-slate-100">
            {mainTitle}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-xs text-slate-300 line-clamp-1">
              {subtitle}
            </p>
          ) : null}
          {isTikTok && hashtag ? (
            <span className="mt-2 inline-block rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-semibold tracking-wide text-slate-200">
              {hashtag}
            </span>
          ) : null}
        </div>
        <div className="rounded-md bg-black/35 px-2 py-1 text-xs text-slate-200">
          {Math.round(trend.rank_score)} / 100
        </div>
      </div>

      <div
        className={`mb-4 overflow-hidden rounded-xl bg-black/35 ${canOpenPromptModal ? "cursor-pointer ring-1 ring-white/0 transition hover:ring-white/25" : ""}`}
        role={canOpenPromptModal ? "button" : undefined}
        tabIndex={canOpenPromptModal ? 0 : undefined}
        onClick={canOpenPromptModal ? handleOpenPromptModal : undefined}
        onKeyDown={
          canOpenPromptModal
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleOpenPromptModal();
                }
              }
            : undefined
        }
      >
        {media.videoUrl ? (
          <video
            className="h-auto w-full bg-black/40 object-contain"
            src={media.videoUrl}
            controls
            playsInline
          />
        ) : media.embedUrl ? (
          <div className="w-full" style={{ aspectRatio: iframeRatio }}>
            <iframe
              className="h-full w-full bg-black/40"
              src={media.embedUrl}
              title={`${trend.title} preview`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : media.imageUrl ? (
          <img
            className="h-auto w-full bg-black/40 object-contain"
            src={media.imageUrl}
            aria-label={t("preview")}
            alt={trend.title}
          />
        ) : (
          <div className="flex min-h-40 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.15),_transparent_60%)] p-6 text-xs text-slate-300">
            {t("noPreviewAvailable")}
          </div>
        )}
      </div>
      <div className="mb-5 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-slate-400">
          {trend.category}
        </span>
        <span className="text-sm font-bold text-slate-100">
          {t("velocity")} {velocity >= 0 ? "+" : ""}
          {velocity}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-300">
          {t("views")}: {Number(trend.metadata?.views || 0).toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          {media.sourceUrl ? (
            <a
              href={media.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/15 px-3 py-2 text-[11px] font-semibold text-slate-100 transition hover:border-white/35"
            >
              {t("openSource")}
            </a>
          ) : null}
          <Link
            href={`/trends/${trend.id}`}
            className="btn-gradient rounded-full px-4 py-2 text-xs font-bold text-white"
          >
            {t("openTrend")}
          </Link>
        </div>
      </div>
    </article>
  );
}
