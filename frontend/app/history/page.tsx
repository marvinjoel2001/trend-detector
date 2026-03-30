"use client";

import { useEffect, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { LoadingSkeleton } from "../../components/loading-skeleton";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { PromptHistoryItem } from "../../lib/types";

export default function HistoryPage() {
  const { t, language } = useI18n();
  const [items, setItems] = useState<PromptHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const copy =
    language === "es"
      ? {
          subtitle:
            "Aqui ves los prompts que el backend fue guardando cada vez que generaste uno desde el dashboard o desde la pagina de prompts.",
          refresh: "Actualizar",
          total: "Total guardados",
          niche: "Nicho",
          trendId: "Trend ID",
        }
      : {
          subtitle:
            "This shows the prompts the backend saved each time you generated one from the dashboard or from the prompt page.",
          refresh: "Refresh",
          total: "Total saved",
          niche: "Niche",
          trendId: "Trend ID",
        };

  async function loadHistory() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPromptHistory();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed loading history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-headline text-3xl font-bold">{t("promptHistory")}</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">{copy.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-slate-200">
              {copy.total}: {items.length}
            </span>
            <button
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:border-white/30"
              onClick={() => void loadHistory()}
            >
              {copy.refresh}
            </button>
          </div>
        </div>

        {loading ? <div className="text-sm text-slate-300">{t("loadingHistory")}</div> : null}
        {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
        {!loading && !items.length ? <div className="text-sm text-slate-400">{t("noPromptHistory")}</div> : null}

        {loading && !items.length ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <article
                key={`history-skeleton-${index}`}
                className="glass-panel rounded-3xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <LoadingSkeleton className="h-7 w-24 rounded-full" />
                    <LoadingSkeleton className="h-7 w-24 rounded-full" />
                  </div>
                  <LoadingSkeleton className="h-4 w-40" />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <LoadingSkeleton className="h-24 w-full" />
                  <LoadingSkeleton className="h-24 w-full" />
                </div>
                <LoadingSkeleton className="mt-4 h-32 w-full" />
              </article>
            ))}
          </div>
        ) : null}

        <div className="space-y-4">
          {items.map((item) => (
            <article key={item.id} className="glass-panel rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 uppercase tracking-[0.2em] text-cyan-100">
                    {item.platform_target}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-[0.2em] text-slate-200">
                    {item.output_type}
                  </span>
                </div>
                <span>{new Date(item.created_at).toLocaleString()}</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.niche}</p>
                  <p className="mt-1 text-sm text-white">{item.user_niche || "N/A"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.trendId}</p>
                  <p className="mt-1 break-all text-sm text-white">{item.trend_id}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm leading-7 text-slate-100">{item.prompt_text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
