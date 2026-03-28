"use client";

import { useEffect, useState } from "react";

import { AppShell } from "../components/app-shell";
import { TrendCard } from "../components/trend-card";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { getTrendMedia } from "../lib/trend-media";
import { PromptResult, SourceStatusResponse, Trend } from "../lib/types";

function previewScore(trend: Trend): number {
  const media = getTrendMedia(trend);
  if (media.videoUrl) return 4;
  if (media.embedUrl) return 3;
  if (media.imageUrl) return 2;
  if (media.sourceUrl) return 1;
  return 0;
}

export default function DashboardPage() {
  const { t } = useI18n();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [sourceStatus, setSourceStatus] = useState<SourceStatusResponse>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrendId, setSelectedTrendId] = useState<string>("");
  const [selectedOutputType, setSelectedOutputType] = useState<
    "video" | "image"
  >("video");
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [prompt, setPrompt] = useState<PromptResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toasts, setToasts] = useState<
    Array<{ id: string; type: "warn" | "error"; text: string }>
  >([]);

  useEffect(() => {
    api
      .getTrendsWithStatus("?limit=50")
      .then((data) => {
        const sortedItems = [...data.items].sort((a, b) => {
          const rankDiff = b.rank_score - a.rank_score;
          if (rankDiff !== 0) return rankDiff;
          return previewScore(b) - previewScore(a);
        });
        setTrends(sortedItems);
        setSourceStatus(data.source_status || {});
        if (sortedItems[0]) setSelectedTrendId(sortedItems[0].id);

        const alerts = Object.values(data.source_status || {})
          .filter((s) =>
            [
              "unavailable",
              "fallback",
              "cached",
              "locked",
              "locked_cached",
            ].includes(s.status),
          )
          .map((s) => ({
            id: `${s.source}-${s.updated_at || "na"}`,
            type:
              s.status === "unavailable"
                ? ("error" as const)
                : ("warn" as const),
            text: `${s.source.toUpperCase()}: ${s.message}`,
          }));
        if (alerts.length) {
          setToasts(alerts);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toasts.length) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4500);
    return () => clearTimeout(timer);
  }, [toasts]);

  useEffect(() => {
    if (!isPromptModalOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsPromptModalOpen(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isPromptModalOpen]);

  function handleSelectCardForPrompt(
    trend: Trend,
    outputType: "video" | "image",
  ) {
    setSelectedTrendId(trend.id);
    setSelectedOutputType(outputType);
    setPrompt(null);
    setCopied(false);
    setIsPromptModalOpen(true);
  }

  function closePromptModal() {
    if (generating) return;
    setIsPromptModalOpen(false);
  }

  async function handleGenerate() {
    if (!selectedTrendId) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await api.generatePrompt({
        trend_id: selectedTrendId,
        platform_target: "tiktok",
        output_type: selectedOutputType,
        user_niche: "technology",
      });
      setPrompt(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed generating prompt");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopyPrompt() {
    if (!prompt?.prompt_text) return;
    try {
      await navigator.clipboard.writeText(prompt.prompt_text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const selectedTrend =
    trends.find((trend) => trend.id === selectedTrendId) || null;

  return (
    <AppShell>
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`max-w-sm rounded-xl border px-4 py-3 text-xs shadow-lg backdrop-blur ${
              toast.type === "error"
                ? "border-red-300/40 bg-red-500/20 text-red-100"
                : "border-amber-300/40 bg-amber-500/20 text-amber-100"
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="font-headline text-3xl font-extrabold">
            {t("marketVelocityDashboard")}
          </h2>
          <p className="mt-1 text-sm text-slate-300">{t("dashboardSub")}</p>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.values(sourceStatus).map((status) => (
          <span
            key={status.source}
            className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide ${
              status.status === "real"
                ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
                : status.status === "unavailable"
                  ? "border-red-300/40 bg-red-500/15 text-red-100"
                  : "border-amber-300/40 bg-amber-500/15 text-amber-100"
            }`}
          >
            {status.source}: {status.status}
          </span>
        ))}
      </div>
      {loading ? (
        <div className="text-sm text-slate-300">{t("loadingTrends")}</div>
      ) : null}
      {error ? (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {!loading && !trends.length ? (
        <div className="text-sm text-slate-400">{t("noTrends")}</div>
      ) : null}

      <div className="columns-1 gap-5 sm:columns-2 xl:columns-3">
        {trends.map((trend) => (
          <TrendCard
            key={trend.id}
            trend={trend}
            onSelectForPrompt={handleSelectCardForPrompt}
          />
        ))}
      </div>
      {isPromptModalOpen && selectedTrend ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-[#020204]/75 px-4 backdrop-blur-xl"
          onClick={closePromptModal}
        >
          <div className="pointer-events-none absolute -left-24 top-8 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-fuchsia-400/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0))]" />
          <div
            className="relative w-full max-w-xl rounded-3xl border border-white/25 bg-gradient-to-br from-white/25 via-white/[0.14] to-white/[0.08] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.65)] backdrop-blur-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">
              {t("quickPromptGenerator")}
            </p>
            <h4 className="mt-2 font-headline text-xl font-bold text-white">
              {selectedTrend.title}
            </h4>
            <p className="mt-1 text-xs text-slate-300">
              {t("quickPromptModalSub")}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  selectedOutputType === "video"
                    ? "border-white/60 bg-white/20 text-white"
                    : "border-white/20 bg-black/20 text-slate-200 hover:border-white/40"
                }`}
                onClick={() => setSelectedOutputType("video")}
              >
                {t("quickPromptTypeVideo")}
              </button>
              <button
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  selectedOutputType === "image"
                    ? "border-white/60 bg-white/20 text-white"
                    : "border-white/20 bg-black/20 text-slate-200 hover:border-white/40"
                }`}
                onClick={() => setSelectedOutputType("image")}
              >
                {t("quickPromptTypeImage")}
              </button>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                className="w-full rounded-full border border-white/20 bg-black/20 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/40"
                onClick={closePromptModal}
                disabled={generating}
              >
                {t("quickPromptCancel")}
              </button>
              <button
                className="btn-gradient w-full rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? t("generating") : t("generatePrompt")}
              </button>
            </div>
            {prompt ? (
              <div className="mt-5 rounded-2xl border border-white/20 bg-black/30 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                    {t("generatedPrompt")}
                  </p>
                  <button
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:border-white/50"
                    onClick={handleCopyPrompt}
                  >
                    {copied ? t("quickPromptCopied") : t("quickPromptCopy")}
                  </button>
                </div>
                <p className="text-xs font-semibold text-slate-100">
                  {prompt.payload.visual_style}
                </p>
                <p className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap pr-1 text-sm text-slate-100">
                  {prompt.prompt_text}
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-white/15 bg-black/25 p-4 text-xs text-slate-300">
                {t("quickPromptEmpty")}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
