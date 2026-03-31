"use client";

import { useEffect, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { LoadingSkeleton } from "../../components/loading-skeleton";
import { SimpleLineChart } from "../../components/simple-line-chart";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import {
  buildGeoQuery,
  buildPromptGeneratorConfig,
  getTrendRegionOption,
  loadPromptEngineSettings,
  PromptEngineSettings,
  subscribePromptEngineSettings,
} from "../../lib/prompt-engine-settings";
import { ForecastExplanation, ForecastResponse, Trend, TrendDetailResponse } from "../../lib/types";

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

export default function ForecastPage() {
  const { t, language } = useI18n();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [detail, setDetail] = useState<TrendDetailResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [explanation, setExplanation] = useState<ForecastExplanation | null>(null);
  const [loading, setLoading] = useState(true);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptSettings, setPromptSettings] = useState<PromptEngineSettings>(() => loadPromptEngineSettings());
  const region = getTrendRegionOption(promptSettings.trendRegionCode);

  useEffect(() => {
    return subscribePromptEngineSettings(setPromptSettings);
  }, []);

  const copy =
    language === "es"
      ? {
          subtitle: "Ahora el pronóstico muestra qué parte ya pasó, qué parte es proyección y qué tan probable es que la tendencia siga creciendo.",
          chartTitle: "Lectura del pronóstico",
          chartSub: "Línea sólida = snapshots reales recientes. Línea punteada = proyección de las próximas horas.",
          currentBaseline: "Base actual",
          projectedClose: "Cierre proyectado",
          projectedChange: "Cambio proyectado",
          confidence: "Confianza",
          explanationTitle: "Resumen del pronóstico",
          factorsTitle: "Basado en",
          methodologyTitle: "Cómo leerlo",
          projectionStart: "Ahora",
          recentSnapshots: "Snapshots recientes",
          nextProjection: "Proyección siguiente",
          noExplanation: "No se pudo generar la explicación del pronóstico.",
          generatedWith: "Generado con",
          viralYes: "Posible ventana viral",
          viralNo: "Sin señal viral fuerte",
          daysLabel: "Tiempo estimado",
          detailsLabel: "Tendencias disponibles",
          noWindowYet: "Todavía no hay una ventana clara",
          daysUnit: "día(s)",
          hoursUnit: "h",
        }
      : {
          subtitle: "The forecast now shows what already happened, what is projected next, and how likely the trend is to keep climbing.",
          chartTitle: "Forecast reading",
          chartSub: "Solid line = recent real snapshots. Dashed line = projected next hours.",
          currentBaseline: "Current baseline",
          projectedClose: "Projected close",
          projectedChange: "Projected change",
          confidence: "Confidence",
          explanationTitle: "Forecast summary",
          factorsTitle: "Based on",
          methodologyTitle: "How to read it",
          projectionStart: "Now",
          recentSnapshots: "Recent snapshots",
          nextProjection: "Next projection",
          noExplanation: "The forecast explanation could not be generated.",
          generatedWith: "Generated with",
          viralYes: "Possible viral window",
          viralNo: "No strong viral signal",
          daysLabel: "Estimated timing",
          detailsLabel: "Available trends",
          noWindowYet: "No clear window yet",
          daysUnit: "day(s)",
          hoursUnit: "h",
        };

  useEffect(() => {
    api
      .getTrends(buildGeoQuery({ limit: 20 }, promptSettings))
      .then((data) => {
        setTrends(data);
        if (data[0]) setSelected(data[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [promptSettings]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setForecastLoading(true);
      setError(null);
      setDetail(null);
      setForecast(null);
      setExplanation(null);
    });

    Promise.allSettled([
      api.getTrend(selected),
      api.getForecast(selected),
      api.explainForecast({
        trend_id: selected,
        language,
        generator_config: buildPromptGeneratorConfig(promptSettings),
      }),
    ])
      .then(([detailResult, forecastResult, explanationResult]) => {
        if (!active) return;

        if (detailResult.status !== "fulfilled") {
          throw detailResult.reason;
        }
        if (forecastResult.status !== "fulfilled") {
          throw forecastResult.reason;
        }

        setDetail(detailResult.value);
        setForecast(forecastResult.value);
        if (explanationResult.status === "fulfilled") {
          setExplanation(explanationResult.value);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed loading forecast");
      })
      .finally(() => {
        if (active) setForecastLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selected, language, promptSettings]);

  const historicalSnapshots = detail?.snapshots.slice(-12).reverse() || [];
  const historicalValues = historicalSnapshots.map((snapshot) => snapshot.metric_views);
  const forecastValues = forecast?.points.map((point) => point.momentum) || [];
  const combinedValues = historicalValues.length ? [...historicalValues, ...forecastValues] : forecastValues;
  const combinedLabels = historicalSnapshots.length
    ? [
        ...historicalSnapshots.map((snapshot) =>
          new Date(snapshot.snapshot_ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        ),
        ...(forecast?.points.map((point, index) =>
          index === 0
            ? copy.projectionStart
            : new Date(point.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        ) || []),
      ]
    : forecast?.points.map((point) => new Date(point.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) || [];
  const forecastStartIndex = historicalValues.length ? historicalValues.length - 1 : undefined;
  const currentBaseline = historicalValues[historicalValues.length - 1] || 0;
  const projectedClose = forecastValues[forecastValues.length - 1] || currentBaseline;
  const projectedChange = currentBaseline > 0 ? ((projectedClose - currentBaseline) / currentBaseline) * 100 : 0;
  const showTrendListSkeleton = loading && !trends.length;
  const showForecastSkeleton = (loading || forecastLoading) && !error;

  return (
    <AppShell>
      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-16 top-0 h-72 w-72 rounded-full bg-cyan-400/14 blur-3xl" />
          <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-indigo-400/12 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" />
        </div>

        <div className="mb-6">
          <h2 className="font-headline text-3xl font-bold">{t("forecastAnalytics")}</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">{copy.subtitle}</p>
          <div className="mt-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-100">
            Region: {region.label}
          </div>
        </div>

        {loading ? <div className="text-sm text-slate-300">{t("loadingForecastTrends")}</div> : null}
        {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[0.95fr,1.35fr]">
          <section className="glass-panel rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <h3 className="font-headline text-lg font-bold">{copy.detailsLabel}</h3>
            <div className="mt-4 space-y-2">
              {showTrendListSkeleton
                ? Array.from({ length: 6 }).map((_, index) => (
                    <LoadingSkeleton key={`forecast-list-skeleton-${index}`} className="h-20 w-full" />
                  ))
                : null}
              {trends.map((trend) => (
                <button
                  key={trend.id}
                  onClick={() => setSelected(trend.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    selected === trend.id
                      ? "border-cyan-300/35 bg-cyan-400/10 text-white"
                      : "border-white/10 bg-slate-950/25 text-slate-300 hover:border-white/20"
                  }`}
                >
                  <p className="text-sm font-semibold">{trend.title}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    {trend.platform} · {trend.category}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="glass-panel rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className="mb-5">
                <h3 className="font-headline text-xl font-bold text-white">{copy.chartTitle}</h3>
                <p className="mt-2 text-sm text-slate-300">{copy.chartSub}</p>
              </div>

              {showForecastSkeleton ? (
                <>
                  <div className="grid gap-3 md:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <LoadingSkeleton key={`forecast-metric-skeleton-${index}`} className="h-24 w-full" />
                    ))}
                  </div>
                  <LoadingSkeleton className="mt-5 h-72 w-full" />
                </>
              ) : !detail || !forecast ? (
                <p className="text-sm text-slate-400">{t("selectTrendForecast")}</p>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.currentBaseline}</p>
                      <p className="mt-2 text-xl font-bold text-white">{compactNumber(currentBaseline)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.projectedClose}</p>
                      <p className="mt-2 text-xl font-bold text-cyan-200">{compactNumber(projectedClose)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.projectedChange}</p>
                      <p className={`mt-2 text-xl font-bold ${projectedChange >= 0 ? "text-emerald-200" : "text-amber-200"}`}>
                        {projectedChange >= 0 ? "+" : ""}
                        {projectedChange.toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.confidence}</p>
                      <p className="mt-2 text-xl font-bold text-white">{(forecast.confidence * 100).toFixed(0)}%</p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <SimpleLineChart
                      values={combinedValues}
                      xLabels={combinedLabels}
                      forecastStartIndex={forecastStartIndex}
                      emptyLabel={t("noForecast")}
                      valueFormatter={compactNumber}
                      ariaLabel={`${detail.trend.title} forecast chart`}
                      baseLabel={copy.recentSnapshots}
                      forecastLabel={copy.nextProjection}
                    />
                  </div>
                </>
              )}
            </section>

            <section className="glass-panel rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-cyan-400/[0.06] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-headline text-xl font-bold text-white">{copy.explanationTitle}</h3>
                {explanation ? (
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${
                        explanation.could_go_viral
                          ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                          : "border-amber-300/30 bg-amber-400/10 text-amber-100"
                      }`}
                    >
                      {explanation.could_go_viral ? copy.viralYes : copy.viralNo}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-200">
                      {copy.generatedWith}: {explanation.generated_with}
                    </span>
                  </div>
                ) : null}
              </div>

              {showForecastSkeleton ? (
                <div className="space-y-4">
                  <LoadingSkeleton className="h-28 w-full" />
                  <div className="grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
                    <LoadingSkeleton className="h-40 w-full" />
                    <LoadingSkeleton className="h-40 w-full" />
                  </div>
                </div>
              ) : null}
              {!showForecastSkeleton && !explanation ? <p className="text-sm text-slate-400">{copy.noExplanation}</p> : null}

              {!showForecastSkeleton && explanation ? (
                <div className="space-y-5">
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                    <p className="text-[11px] uppercase tracking-[0.25em] text-cyan-200">{explanation.outlook}</p>
                    <h4 className="mt-2 font-headline text-2xl font-bold text-white">{explanation.title}</h4>
                    <p className="mt-3 text-sm leading-7 text-slate-100">{explanation.summary}</p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
                    <div className="rounded-3xl border border-white/10 bg-slate-950/25 p-5">
                      <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{copy.daysLabel}</p>
                      <p className="mt-3 text-lg font-semibold text-white">
                        {explanation.virality_window_days
                          ? `${explanation.virality_window_days.toFixed(1)} ${copy.daysUnit}`
                          : explanation.virality_window_hours
                            ? `${explanation.virality_window_hours.toFixed(1)} ${copy.hoursUnit}`
                            : copy.noWindowYet}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-slate-300">{explanation.methodology}</p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-slate-950/25 p-5">
                      <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{copy.factorsTitle}</p>
                      <div className="mt-4 space-y-3">
                        {explanation.based_on.map((item, index) => (
                          <div key={`${item}-${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-slate-200">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
