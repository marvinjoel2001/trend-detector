"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell } from "../../../components/app-shell";
import { SimpleLineChart } from "../../../components/simple-line-chart";
import { api } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n";
import { getTrendMedia } from "../../../lib/trend-media";
import { buildTrendPreviewGallery, TrendPreviewGalleryItem } from "../../../lib/trend-preview-gallery";
import { ForecastResponse, Trend, TrendDetailResponse } from "../../../lib/types";

export default function TrendDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [detail, setDetail] = useState<TrendDetailResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [previewGallery, setPreviewGallery] = useState<TrendPreviewGalleryItem[]>([]);
  const [previewGalleryLoading, setPreviewGalleryLoading] = useState(false);
  const [previewGalleryError, setPreviewGalleryError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      setForecastError(null);
      setForecast(null);
      setPreviewGallery([]);
      setPreviewGalleryError(null);
      setPreviewGalleryLoading(false);

      try {
        const trendData = await api.getTrend(id);
        if (!active) return;
        setDetail(trendData);
        setPreviewGalleryLoading(true);

        try {
          const platform = trendData.trend.platform.toLowerCase();
          let sourceItems: Trend[] = [];
          if (platform === "youtube") {
            sourceItems = await api.getYoutubeResults();
          } else if (platform === "tiktok") {
            sourceItems = await api.getTiktokResults();
          } else if (platform === "reddit") {
            sourceItems = await api.getRedditResults();
          } else if (platform === "google") {
            sourceItems = await api.getGoogleResults();
          }
          if (!active) return;
          setPreviewGallery(buildTrendPreviewGallery(trendData.trend as Trend, sourceItems, 12));
        } catch (galleryErr) {
          if (!active) return;
          setPreviewGalleryError(galleryErr instanceof Error ? galleryErr.message : "Failed loading related previews");
        } finally {
          if (active) {
            setPreviewGalleryLoading(false);
          }
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed loading trend detail");
        setLoading(false);
        return;
      }

      setLoading(false);

      try {
        const forecastData = await api.getForecast(id);
        if (!active) return;
        setForecast(forecastData);
      } catch (err) {
        if (!active) return;
        setForecastError(err instanceof Error ? err.message : "Failed loading forecast");
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <AppShell>
      {loading ? <div className="text-sm text-slate-300">{t("loadingTrendDetail")}</div> : null}
      {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
      {!loading && !detail ? <div className="text-sm text-slate-400">{t("trendNotFound")}</div> : null}
      {detail ? (
        <div className="space-y-6">
          {(() => {
            const media = getTrendMedia(detail.trend);
            const isTikTok = detail.trend.platform.toLowerCase() === "tiktok";
            const iframeRatio = isTikTok ? "9 / 16" : "16 / 9";
            return (
              <section className="glass-panel overflow-hidden rounded-2xl border border-white/10">
                <div className="border-b border-white/10 px-6 py-4">
                  <h3 className="font-headline text-lg font-bold">{t("preview")}</h3>
                </div>
                <div className="p-6">
                  {media.embedUrl ? (
                    <div className="w-full overflow-hidden rounded-xl border border-white/10" style={{ aspectRatio: iframeRatio }}>
                      <iframe
                        className="h-full w-full bg-slate-950/40"
                        src={media.embedUrl}
                        title={`${detail.trend.title} preview`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : media.videoUrl ? (
                    <video
                      className="w-full max-h-[38rem] rounded-xl border border-white/10 bg-slate-950/40 object-contain"
                      src={media.videoUrl}
                      controls
                      playsInline
                    />
                  ) : media.imageUrl ? (
                    <img
                      className="w-full max-h-[38rem] rounded-xl border border-white/10 bg-slate-950/40 object-contain"
                      src={media.imageUrl}
                      aria-label={t("preview")}
                      alt={detail.trend.title}
                    />
                  ) : (
                    <div className="rounded-xl border border-white/10 p-5 text-sm text-slate-300">{t("noPreviewAvailable")}</div>
                  )}
                  {media.sourceUrl ? (
                    <a
                      href={media.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-block rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:border-white/40"
                    >
                      {t("openSource")}
                    </a>
                  ) : null}
                </div>
              </section>
            );
          })()}
          <section className="glass-panel rounded-2xl border border-white/10 p-6">
            <h2 className="font-headline text-2xl font-bold">{detail.trend.title}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {detail.trend.platform} · {detail.trend.category} · {t("velocity")} {detail.trend.velocity_score.toFixed(2)}
            </p>
          </section>
          <section className="glass-panel rounded-2xl border border-white/10 p-6">
            <h3 className="font-headline text-lg font-bold">{t("previewGallery")}</h3>
            {previewGalleryLoading ? <p className="mt-3 text-sm text-slate-300">{t("loadingPreviewGallery")}</p> : null}
            {previewGalleryError ? <p className="mt-3 text-sm text-amber-300">{previewGalleryError}</p> : null}
            {!previewGalleryLoading && !previewGallery.length ? (
              <p className="mt-3 text-sm text-slate-400">{t("noPreviewGalleryItems")}</p>
            ) : null}

            {previewGallery.length ? (
              <div className="mt-4 columns-1 gap-4 sm:columns-2 lg:columns-3">
                {previewGallery.map((item) => (
                  <article key={item.id} className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-white/10 bg-slate-900/30">
                    {item.videoUrl ? (
                      <video className="w-full max-h-[28rem] bg-slate-950/50 object-contain" src={item.videoUrl} controls playsInline />
                    ) : item.embedUrl ? (
                      <div className="w-full" style={{ aspectRatio: item.platform.toLowerCase() === "tiktok" ? "9 / 16" : "16 / 9" }}>
                        <iframe
                          className="h-full w-full bg-slate-950/40"
                          src={item.embedUrl}
                          title={`${item.title} preview`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : item.imageUrl ? (
                      <img className="w-full max-h-[28rem] bg-slate-950/40 object-contain" src={item.imageUrl} aria-label={item.title} alt={item.title} />
                    ) : (
                      <div className="flex min-h-32 items-center justify-center p-4 text-xs text-slate-300">{t("noPreviewAvailable")}</div>
                    )}
                    <div className="space-y-2 p-3">
                      <p className="line-clamp-2 text-sm font-semibold text-slate-100">{item.title}</p>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400">{item.platform}</p>
                      {item.sourceUrl ? (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-slate-100 transition hover:border-white/40"
                        >
                          {t("openSource")}
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
          <section className="glass-panel rounded-2xl border border-white/10 p-6">
            <h3 className="font-headline text-lg font-bold">{t("momentumSnapshots")}</h3>
            <div className="mt-4">
              <SimpleLineChart values={detail.snapshots.map((s) => s.metric_views).reverse()} emptyLabel={t("noForecast")} />
            </div>
          </section>
          <section className="glass-panel rounded-2xl border border-white/10 p-6">
            <h3 className="font-headline text-lg font-bold">{t("sixHourForecast")}</h3>
            {forecastError ? (
              <p className="mt-2 text-sm text-amber-300">{forecastError}</p>
            ) : null}
            {!forecast || !forecast.points.length ? (
              <p className="mt-2 text-sm text-slate-400">{t("noForecast")}</p>
            ) : (
              <div className="mt-3">
                <SimpleLineChart values={forecast.points.map((p) => p.momentum)} emptyLabel={t("noForecast")} />
              </div>
            )}
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
