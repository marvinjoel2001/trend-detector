"use client";

import { useEffect, useState } from "react";

import { AppShell } from "../components/app-shell";
import { TrendCard } from "../components/trend-card";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { PromptResult, SourceStatusResponse, Trend } from "../lib/types";

export default function DashboardPage() {
  const { t } = useI18n();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [sourceStatus, setSourceStatus] = useState<SourceStatusResponse>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrendId, setSelectedTrendId] = useState<string>("");
  const [prompt, setPrompt] = useState<PromptResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; type: "warn" | "error"; text: string }>>([]);

  useEffect(() => {
    api
      .getTrendsWithStatus("?limit=12")
      .then((data) => {
        setTrends(data.items);
        setSourceStatus(data.source_status || {});
        if (data.items[0]) setSelectedTrendId(data.items[0].id);

        const alerts = Object.values(data.source_status || {})
          .filter((s) => ["unavailable", "fallback", "cached", "locked", "locked_cached"].includes(s.status))
          .map((s) => ({
            id: `${s.source}-${s.updated_at || "na"}`,
            type: s.status === "unavailable" ? "error" as const : "warn" as const,
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

  async function handleGenerate() {
    if (!selectedTrendId) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await api.generatePrompt({
        trend_id: selectedTrendId,
        platform_target: "tiktok",
        output_type: "video",
        user_niche: "technology",
      });
      setPrompt(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed generating prompt");
    } finally {
      setGenerating(false);
    }
  }

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
          <h2 className="font-headline text-3xl font-extrabold">{t("marketVelocityDashboard")}</h2>
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
      {loading ? <div className="text-sm text-slate-300">{t("loadingTrends")}</div> : null}
      {error ? <div className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
      {!loading && !trends.length ? <div className="text-sm text-slate-400">{t("noTrends")}</div> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="grid grid-cols-1 gap-6 xl:col-span-2 xl:grid-cols-2">
          {trends.map((trend) => (
            <TrendCard key={trend.id} trend={trend} />
          ))}
        </div>
        <aside className="glass-panel rounded-2xl border border-white/10 p-6">
          <h3 className="font-headline text-xl font-bold">{t("quickPromptGenerator")}</h3>
          <p className="mt-1 text-xs text-slate-400">{t("quickPromptSub")}</p>
          <label className="mt-4 block text-xs uppercase tracking-widest text-slate-400">{t("trend")}</label>
          <select
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 p-2 text-sm"
            value={selectedTrendId}
            onChange={(e) => setSelectedTrendId(e.target.value)}
          >
            {trends.map((trend) => (
              <option key={trend.id} value={trend.id}>
                {trend.title}
              </option>
            ))}
          </select>
          <button
            className="btn-gradient mt-4 w-full rounded-full px-4 py-2 text-sm font-bold text-slate-900"
            onClick={handleGenerate}
            disabled={generating || !selectedTrendId}
          >
            {generating ? t("generating") : t("generatePrompt")}
          </button>
          {prompt ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-200">
              <p className="font-semibold text-indigo-300">{prompt.payload.visual_style}</p>
              <p className="mt-2 whitespace-pre-wrap">{prompt.prompt_text}</p>
            </div>
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}
