"use client";

import { useEffect, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { SimpleLineChart } from "../../components/simple-line-chart";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { ForecastResponse, Trend } from "../../lib/types";

export default function ForecastPage() {
  const { t } = useI18n();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getTrends("?limit=20")
      .then((data) => {
        setTrends(data);
        if (data[0]) setSelected(data[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.getForecast(selected).then(setForecast).catch((err) => setError(err.message));
  }, [selected]);

  return (
    <AppShell>
      <h2 className="mb-6 font-headline text-2xl font-bold">{t("forecastAnalytics")}</h2>
      {loading ? <div className="text-sm text-slate-300">{t("loadingForecastTrends")}</div> : null}
      {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="glass-panel rounded-2xl border border-white/10 p-4 xl:col-span-1">
          <h3 className="font-headline text-lg font-bold">{t("selectTrend")}</h3>
          <div className="mt-3 space-y-2">
            {trends.map((trend) => (
              <button
                key={trend.id}
                onClick={() => setSelected(trend.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${
                  selected === trend.id ? "border-indigo-300 bg-indigo-500/10" : "border-white/10 bg-slate-950/30"
                }`}
              >
                {trend.title}
              </button>
            ))}
          </div>
        </section>
        <section className="glass-panel rounded-2xl border border-white/10 p-6 xl:col-span-2">
          {!forecast ? (
            <p className="text-sm text-slate-400">{t("selectTrendForecast")}</p>
          ) : (
            <>
              <p className="text-sm text-slate-300">{t("confidence")}: {(forecast.confidence * 100).toFixed(0)}%</p>
              <div className="mt-4">
                <SimpleLineChart values={forecast.points.map((p) => p.momentum)} emptyLabel={t("noForecast")} />
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
