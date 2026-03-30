"use client";

import { useEffect, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { LoadingSkeleton } from "../../components/loading-skeleton";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { buildGeoQuery, buildPromptGeneratorConfig, getTrendRegionOption, loadPromptEngineSettings } from "../../lib/prompt-engine-settings";
import { PromptResult, Trend } from "../../lib/types";

export default function PromptGeneratorPage() {
  const { t } = useI18n();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [trendId, setTrendId] = useState("");
  const [platformTarget, setPlatformTarget] = useState("tiktok");
  const [outputType, setOutputType] = useState("video");
  const [niche, setNiche] = useState("technology");
  const [result, setResult] = useState<PromptResult | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const region = getTrendRegionOption(loadPromptEngineSettings().trendRegionCode);

  useEffect(() => {
    api
      .getTrends(buildGeoQuery({ limit: 30 }))
      .then((data) => {
        setTrends(data);
        if (data[0]) setTrendId(data[0].id);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed loading trends");
      })
      .finally(() => setLoadingTrends(false));
  }, []);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.generatePrompt({
        trend_id: trendId,
        platform_target: platformTarget,
        output_type: outputType,
        user_niche: niche,
        generator_config: buildPromptGeneratorConfig(loadPromptEngineSettings()),
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prompt generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="glass-panel rounded-2xl border border-white/10 p-6 xl:col-span-1">
          <h2 className="font-headline text-xl font-bold">{t("promptGenerator")}</h2>
          <p className="mt-1 text-xs text-slate-400">{t("quickPromptSub")}</p>
          <div className="mt-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-100">
            Region: {region.label}
          </div>
          <div className="mt-4 space-y-3">
            {loadingTrends ? (
              <>
                <LoadingSkeleton className="h-11 w-full rounded-xl" />
                <LoadingSkeleton className="h-11 w-full rounded-xl" />
                <LoadingSkeleton className="h-11 w-full rounded-xl" />
                <LoadingSkeleton className="h-11 w-full rounded-xl" />
                <LoadingSkeleton className="h-11 w-full rounded-full" />
              </>
            ) : (
              <>
                <select className="w-full rounded-xl border border-white/10 bg-slate-950/40 p-2 text-sm" value={trendId} onChange={(e) => setTrendId(e.target.value)}>
                  {trends.map((trend) => (
                    <option key={trend.id} value={trend.id}>
                      {trend.title}
                    </option>
                  ))}
                </select>
                <select className="w-full rounded-xl border border-white/10 bg-slate-950/40 p-2 text-sm" value={platformTarget} onChange={(e) => setPlatformTarget(e.target.value)}>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube Shorts</option>
                  <option value="instagram">Instagram Reels</option>
                </select>
                <select className="w-full rounded-xl border border-white/10 bg-slate-950/40 p-2 text-sm" value={outputType} onChange={(e) => setOutputType(e.target.value)}>
                  <option value="video">Video</option>
                  <option value="image">Image</option>
                  <option value="audio">Audio</option>
                </select>
                <input className="w-full rounded-xl border border-white/10 bg-slate-950/40 p-2 text-sm" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="User niche" />
                <button className="btn-gradient w-full rounded-full px-4 py-2 text-sm font-bold text-slate-900" onClick={submit} disabled={loading || !trendId}>
                  {loading ? t("generating") : t("generate")}
                </button>
              </>
            )}
          </div>
        </section>
        <section className="glass-panel rounded-2xl border border-white/10 p-6 xl:col-span-2">
          {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
          {loading && !result ? (
            <div className="space-y-4">
              <LoadingSkeleton className="h-7 w-48" />
              <LoadingSkeleton className="h-40 w-full" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <LoadingSkeleton key={`prompt-result-skeleton-${index}`} className="h-20 w-full" />
                ))}
              </div>
            </div>
          ) : null}
          {!loading && !result ? <p className="text-sm text-slate-400">{t("noPromptYet")}</p> : null}
          {result ? (
            <div className="space-y-4">
              <h3 className="font-headline text-lg font-bold">{t("generatedPrompt")}</h3>
              <p className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm">{result.prompt_text}</p>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="rounded-xl border border-white/10 p-3">{t("style")}: {result.payload.visual_style}</div>
                <div className="rounded-xl border border-white/10 p-3">{t("tone")}: {result.payload.tone}</div>
                <div className="rounded-xl border border-white/10 p-3">{t("format")}: {result.payload.format}</div>
                <div className="rounded-xl border border-white/10 p-3">{t("publish")}: {result.payload.publish_time}</div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
