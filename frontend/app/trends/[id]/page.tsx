"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell } from "../../../components/app-shell";
import { SimpleLineChart } from "../../../components/simple-line-chart";
import { api } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n";
import { ForecastResponse, TrendDetailResponse } from "../../../lib/types";

export default function TrendDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [detail, setDetail] = useState<TrendDetailResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getTrend(id), api.getForecast(id)])
      .then(([trendData, forecastData]) => {
        setDetail(trendData);
        setForecast(forecastData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <AppShell>
      {loading ? <div className="text-sm text-slate-300">{t("loadingTrendDetail")}</div> : null}
      {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
      {!loading && !detail ? <div className="text-sm text-slate-400">{t("trendNotFound")}</div> : null}
      {detail ? (
        <div className="space-y-6">
          <section className="glass-panel rounded-2xl border border-white/10 p-6">
            <h2 className="font-headline text-2xl font-bold">{detail.trend.title}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {detail.trend.platform} · {detail.trend.category} · {t("velocity")} {detail.trend.velocity_score.toFixed(2)}
            </p>
          </section>
          <section className="glass-panel rounded-2xl border border-white/10 p-6">
            <h3 className="font-headline text-lg font-bold">{t("momentumSnapshots")}</h3>
            <div className="mt-4">
              <SimpleLineChart values={detail.snapshots.map((s) => s.metric_views).reverse()} emptyLabel={t("noForecast")} />
            </div>
          </section>
          <section className="glass-panel rounded-2xl border border-white/10 p-6">
            <h3 className="font-headline text-lg font-bold">{t("sixHourForecast")}</h3>
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
