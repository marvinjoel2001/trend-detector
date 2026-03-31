"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import {
  DEFAULT_PROMPT_ENGINE_SETTINGS,
  PromptEngineSettings,
  TREND_REGION_GROUPS,
  TREND_REGION_OPTIONS,
  TrendRegionCapabilityLevel,
  TrendRegionOption,
  getTrendRegionGroupLabel,
  getTrendRegionOption,
  loadPromptEngineSettings,
  matchesTrendRegionSearch,
  savePromptEngineSettings,
} from "../../lib/prompt-engine-settings";
import { PromptEngineStatus, SourceStatusResponse } from "../../lib/types";

const SOURCE_ORDER = ["google", "youtube", "tiktok", "reddit"] as const;
const MAP_MARKER_GLOBAL_OFFSET_X_PERCENT = -0.8;

function getCapabilityTone(level: TrendRegionCapabilityLevel): string {
  return level === "exact"
    ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
    : "border-amber-300/30 bg-amber-500/10 text-amber-100";
}

function getCapabilityLabel(level: TrendRegionCapabilityLevel, language: "es" | "en"): string {
  if (language === "es") {
    return level === "exact" ? "Exacto" : "Aproximado";
  }
  return level === "exact" ? "Exact" : "Best effort";
}

function describeCapability(
  source: "google" | "youtube" | "tiktok",
  level: TrendRegionCapabilityLevel,
  language: "es" | "en"
): string {
  if (language === "es") {
    if (source === "google") {
      return level === "exact"
        ? "Usa el geo oficial de Google Trends, incluyendo RSS por pais."
        : "Google entra como aproximacion.";
    }
    if (source === "youtube") {
      return level === "exact"
        ? "Usa `regionCode` en el ranking `mostPopular` de YouTube."
        : "YouTube entra como aproximacion.";
    }
    return level === "exact"
      ? "Usa TikTok via Apify con filtro por pais y metadatos reales de video, sonido y hashtags."
      : "TikTok no ofrece un feed publico estable por esta zona; se toma como referencia regional.";
  }

  if (source === "google") {
    return level === "exact"
      ? "Uses the official Google Trends geo filter, including country RSS feeds."
      : "Google is treated as best effort.";
  }
  if (source === "youtube") {
    return level === "exact"
      ? "Uses YouTube `mostPopular` with the selected `regionCode`."
      : "YouTube is treated as best effort.";
  }
  return level === "exact"
    ? "Uses TikTok via Apify with country targeting and live video, sound, and hashtag metadata."
    : "TikTok does not expose a stable public feed for this territory, so it is treated as regional guidance.";
}

function formatSourceName(source: string): string {
  if (source === "google") return "Google Trends";
  if (source === "youtube") return "YouTube";
  if (source === "tiktok") return "TikTok";
  if (source === "reddit") return "Reddit";
  return source.toUpperCase();
}

function getSourceStatusTone(status: string): string {
  if (status === "real") return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
  if (status === "unavailable") return "border-red-300/25 bg-red-500/10 text-red-100";
  if (status === "unknown") return "border-white/10 bg-white/5 text-slate-200";
  return "border-amber-300/25 bg-amber-500/10 text-amber-100";
}

function translateSourceStatus(status: string, language: "es" | "en"): string {
  const normalized = status || "unknown";
  if (language === "es") {
    if (normalized === "real") return "Real";
    if (normalized === "approximate") return "Aproximado";
    if (normalized === "fallback") return "Respaldo temporal";
    if (normalized === "cached") return "En caché";
    if (normalized === "locked") return "Bloqueado";
    if (normalized === "locked_cached") return "Bloqueado con caché";
    if (normalized === "unavailable") return "No disponible";
    return "Pendiente";
  }

  if (normalized === "real") return "Live";
  if (normalized === "approximate") return "Approximate";
  if (normalized === "fallback") return "Fallback";
  if (normalized === "cached") return "Cached";
  if (normalized === "locked") return "Locked";
  if (normalized === "locked_cached") return "Locked cached";
  if (normalized === "unavailable") return "Unavailable";
  return "Pending";
}

function getSourceStatusDetail(
  source: string,
  previewStatus: SourceStatusResponse,
  language: "es" | "en"
): { status: string; message: string; items_count: number } {
  const item = previewStatus[source];
  if (item) {
    return {
      status: item.status || "unknown",
      message: item.message || "",
      items_count: item.items_count || 0,
    };
  }
  return {
    status: "unknown",
    message: language === "es" ? "Aún sin lectura para esta zona." : "No reading yet for this territory.",
    items_count: 0,
  };
}

function RegionChip({
  option,
  active,
  language,
  onSelect,
}: {
  option: TrendRegionOption;
  active: boolean;
  language: "es" | "en";
  onSelect: (code: string) => void;
}) {
  const label = language === "es" ? option.labelEs : option.label;
  const hint = language === "es" ? option.hintEs : option.hintEn;

  return (
    <button
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-cyan-300/35 bg-cyan-400/10 text-white"
          : "border-white/10 bg-slate-950/35 text-slate-300 hover:border-white/20"
      }`}
      onClick={() => onSelect(option.code)}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${getCapabilityTone(option.capabilities.tiktok)}`}>
          TikTok {getCapabilityLabel(option.capabilities.tiktok, language)}
        </span>
      </div>
      <p className="mt-2 text-xs leading-6 text-slate-400">{hint}</p>
    </button>
  );
}

function projectEqualEarthToPercent(lon: number, lat: number): { left: string; top: string } {
  const A1 = 1.340264;
  const A2 = -0.081106;
  const A3 = 0.000893;
  const A4 = 0.003796;
  const sqrt3 = Math.sqrt(3);
  const theta = Math.asin((sqrt3 * Math.sin((lat * Math.PI) / 180)) / 2);
  const theta2 = theta * theta;
  const theta6 = theta2 * theta2 * theta2;
  const lambda = (lon * Math.PI) / 180;
  const denominator = sqrt3 * (A1 + 3 * A2 * theta2 + theta6 * (7 * A3 + 9 * A4 * theta2));
  const x = (2 * lambda * Math.cos(theta)) / denominator;
  const y = theta * (A1 + A2 * theta2 + theta6 * (A3 + A4 * theta2));
  const maxX = (2 * Math.PI) / (sqrt3 * A1);
  const scale = 180 / maxX;
  const projectedX = x * scale;
  const projectedY = -y * scale;
  const left = ((projectedX + 180) / 360) * 100;
  const top = ((projectedY + 87.6091) / 175.2182) * 100;
  return {
    left: `${left + MAP_MARKER_GLOBAL_OFFSET_X_PERCENT}%`,
    top: `${top}%`,
  };
}

export default function SettingsPage() {
  const { language } = useI18n();
  const locale = language === "es" ? "es" : "en";
  const [settings, setSettings] = useState<PromptEngineSettings>(() => loadPromptEngineSettings());
  const [systemStatus, setSystemStatus] = useState<PromptEngineStatus | null>(null);
  const [previewStatus, setPreviewStatus] = useState<SourceStatusResponse>({});
  const [previewLoading, setPreviewLoading] = useState(true);
  const [regionSearch, setRegionSearch] = useState("");
  const [isRegionListOpen, setIsRegionListOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    api.getPromptEngineConfig().then(setSystemStatus).catch(() => null);
  }, []);

  const selectedRegion = getTrendRegionOption(settings.trendRegionCode);
  const previewGeoQuery = `?geo=${encodeURIComponent(selectedRegion.code)}`;

  useEffect(() => {
    let cancelled = false;
    api
      .getSourcesStatus(previewGeoQuery)
      .then((payload) => {
        if (!cancelled) setPreviewStatus(payload || {});
      })
      .catch(() => {
        if (!cancelled) setPreviewStatus({});
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [previewGeoQuery]);

  const filteredRegions = useMemo(
    () => TREND_REGION_OPTIONS.filter((option) => matchesTrendRegionSearch(option, regionSearch)),
    [regionSearch]
  );

  const groupedFilteredRegions = useMemo(
    () =>
      TREND_REGION_GROUPS.map((group) => ({
        ...group,
        items: filteredRegions.filter((option) => option.group === group.code),
      })).filter((group) => group.items.length > 0),
    [filteredRegions]
  );

  const mapRegions = useMemo(
    () =>
      TREND_REGION_OPTIONS.filter((option) => option.mapCoordinates).map((option) => ({
        ...option,
        projectedPosition: projectEqualEarthToPercent(option.mapCoordinates!.lon, option.mapCoordinates!.lat),
      })),
    []
  );

  const capabilityCards = [
    {
      source: "google" as const,
      level: selectedRegion.capabilities.google,
      detail: describeCapability("google", selectedRegion.capabilities.google, locale),
    },
    {
      source: "youtube" as const,
      level: selectedRegion.capabilities.youtube,
      detail: describeCapability("youtube", selectedRegion.capabilities.youtube, locale),
    },
    {
      source: "tiktok" as const,
      level: selectedRegion.capabilities.tiktok,
      detail: describeCapability("tiktok", selectedRegion.capabilities.tiktok, locale),
    },
  ];

  const copy =
    locale === "es"
      ? {
          title: "Configuración",
          subtitle:
            "Aquí controlas dos cosas clave: con qué modelo generar prompts y desde qué zona quieres leer lo viral. La zona ahora se elige con un selector visual para que sea más claro cuando quieres Bolivia, Sudamérica o un mercado puntual.",
          promptTitle: "Motor general de prompts",
          promptSubtitle: "Configura el único motor que usan el panel principal, Estudio TikTok, pronóstico y el generador clásico.",
          systemMode: "Usar configuración automática",
          customMode: "Usar Gemini personalizado",
          apiKey: "API key de Gemini",
          apiKeyHint: "Si quieres mejor calidad, conecta tu API key. Si la dejas vacía, se usa la del sistema.",
          model: "Modelo de Gemini",
          modelHint: "Recomendado: Gemini 3.1 Pro para mejores resultados en generación y análisis.",
          regionTitle: "Zona de tendencias virales",
          regionSubtitle:
            "La app consulta por país cuando la fuente lo permite y te marca cuando una fuente solo puede trabajar como aproximación regional.",
          mapTitle: "Mapa mundial de zonas",
          mapSubtitle: "El mapa muestra los mercados disponibles y te deja saltar directo al país que quieres analizar.",
          openList: "Abrir lista completa",
          closeList: "Cerrar lista",
          allRegions: "Todas las zonas",
          allRegionsSubtitle: "Buscador rápido y listado agrupado por continente.",
          searchPlaceholder: "Buscar Bolivia, Brasil, Peru...",
          selectedZone: "Zona seleccionada",
          selectedZoneSubtitle: "Esta es la referencia que usarán panel principal, tendencias en vivo, pronóstico y el generador de prompts.",
          sourcePrecision: "Precisión por fuente",
          sourcePrecisionSubtitle: "Revisado para no mezclar país exacto con ranking global.",
          liveStatusTitle: "Estado actual de las fuentes",
          liveStatusSubtitle: "Lectura mas reciente de las fuentes para esta zona.",
          statusLoading: "Consultando estado real de las fuentes...",
          localNotice:
            "Todo esto se guarda en este navegador. Al cambiar la zona, las pantallas vuelven a pedir tendencias con ese país.",
          systemCard: "Estado del sistema",
          backendKey: "Clave API del sistema",
          configured: "Configurada",
          missing: "No configurada",
          defaultModel: "Modelo por defecto",
          provider: "Proveedor",
          activeRegion: "Zona activa",
          activeModel: "Modelo activo (toda la app)",
          regionGroup: "Bloque",
          itemsCount: "Items",
          status: "Estado",
          reset: "Restablecer",
          save: "Guardar cambios",
          saved: "Configuración guardada.",
          resetDone: "Configuración restablecida.",
        }
      : {
          title: "Settings",
          subtitle:
            "This is where you control two core things: which model generates prompts and which territory should drive viral discovery. The territory picker is now visual so it is clearer when you want Bolivia, South America, or another specific market.",
          promptTitle: "General prompt engine",
          promptSubtitle: "Configure the single generator used by dashboard, TikTok Studio, forecast, and classic prompt generation.",
          systemMode: "Use automatic configuration",
          customMode: "Use custom Gemini",
          apiKey: "Gemini API key",
          apiKeyHint: "For better quality, connect your API key. If empty, the system key is used.",
          model: "Gemini model",
          modelHint: "Recommended: Gemini 3.1 Pro for stronger generation and analysis quality.",
          regionTitle: "Viral trend territory",
          regionSubtitle:
            "The app queries by country when a source allows it and clearly marks when a source can only work as regional guidance.",
          mapTitle: "World territory map",
          mapSubtitle: "The map shows available markets and lets you jump straight to the country you want to analyze.",
          openList: "Open full list",
          closeList: "Hide list",
          allRegions: "All territories",
          allRegionsSubtitle: "Fast search plus grouped country list.",
          searchPlaceholder: "Search Bolivia, Brazil, Peru...",
          selectedZone: "Selected territory",
          selectedZoneSubtitle: "This is the reference used by dashboard, live trends, forecast, and prompt generation.",
          sourcePrecision: "Source precision",
          sourcePrecisionSubtitle: "Investigated so exact country signals are not mixed with global ranking noise.",
          liveStatusTitle: "Current source status",
          liveStatusSubtitle: "Most recent source reading for this territory.",
          statusLoading: "Loading live source status...",
          localNotice: "Everything is stored in this browser. When the territory changes, trend pages request that country.",
          systemCard: "System status",
          backendKey: "System API key",
          configured: "Configured",
          missing: "Not configured",
          defaultModel: "Default model",
          provider: "Provider",
          activeRegion: "Active territory",
          activeModel: "Active model (app-wide)",
          regionGroup: "Block",
          itemsCount: "Items",
          status: "Status",
          reset: "Reset",
          save: "Save changes",
          saved: "Configuration saved.",
          resetDone: "Configuration reset.",
        };

  function updateSetting<K extends keyof PromptEngineSettings>(key: K, value: PromptEngineSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleRegionChange(code: string) {
    const option = getTrendRegionOption(code);
    setPreviewLoading(true);
    setSettings((prev) => {
      const next = {
        ...prev,
        trendRegionCode: option.code,
        trendRegionLabel: option.label,
      };
      savePromptEngineSettings(next);
      return next;
    });
    setStatusMessage("");
  }

  function handleSave() {
    savePromptEngineSettings(settings);
    setStatusMessage(copy.saved);
  }

  function handleReset() {
    const resetSettings = {
      ...DEFAULT_PROMPT_ENGINE_SETTINGS,
      model: systemStatus?.default_model || DEFAULT_PROMPT_ENGINE_SETTINGS.model,
    };
    setPreviewLoading(true);
    setSettings(resetSettings);
    savePromptEngineSettings(resetSettings);
    setStatusMessage(copy.resetDone);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-headline text-3xl font-bold text-white">{copy.title}</h2>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-300">{copy.subtitle}</p>
          </div>
          {statusMessage ? (
            <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
              {statusMessage}
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.55fr,1fr]">
          <div className="space-y-6">
            <section className="glass-panel rounded-3xl border border-white/10 p-6">
              <h3 className="mt-2 font-headline text-2xl font-bold text-white">{copy.promptTitle}</h3>
              <p className="mt-2 text-sm text-slate-300">{copy.promptSubtitle}</p>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <button
                  className={`rounded-2xl border p-4 text-left transition ${
                    settings.mode === "system"
                      ? "border-white/35 bg-white/10 text-white"
                      : "border-white/10 bg-slate-950/35 text-slate-300 hover:border-white/20"
                  }`}
                  onClick={() => updateSetting("mode", "system")}
                >
                  <p className="text-sm font-semibold">{copy.systemMode}</p>
                  <p className="mt-2 text-xs text-slate-400">{copy.promptSubtitle}</p>
                </button>
                <button
                  className={`rounded-2xl border p-4 text-left transition ${
                    settings.mode === "custom-gemini"
                      ? "border-cyan-300/35 bg-cyan-400/10 text-white"
                      : "border-white/10 bg-slate-950/35 text-slate-300 hover:border-white/20"
                  }`}
                  onClick={() => updateSetting("mode", "custom-gemini")}
                >
                  <p className="text-sm font-semibold">{copy.customMode}</p>
                  <p className="mt-2 text-xs text-slate-400">{copy.localNotice}</p>
                </button>
              </div>

              <div className="mt-6 grid gap-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-100">{copy.apiKey}</span>
                  <input
                    type="password"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    value={settings.apiKey}
                    onChange={(event) => updateSetting("apiKey", event.target.value)}
                    placeholder="AIza..."
                  />
                  <span className="mt-2 block text-xs text-slate-400">{copy.apiKeyHint}</span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-100">{copy.model}</span>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    value={settings.model}
                    onChange={(event) => updateSetting("model", event.target.value)}
                    placeholder={systemStatus?.default_model || DEFAULT_PROMPT_ENGINE_SETTINGS.model}
                  />
                  <span className="mt-2 block text-xs text-slate-400">{copy.modelHint}</span>
                </label>
              </div>
            </section>

            <section className="glass-panel rounded-3xl border border-white/10 p-6">
              <h3 className="mt-2 font-headline text-2xl font-bold text-white">
                {locale === "es" ? "Modelo compartido" : "Shared model"}
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                {locale === "es"
                  ? "Estudio TikTok y el generador de prompts usan exactamente el mismo modelo y la misma API key configurados arriba."
                  : "TikTok Studio and prompt generation now use the exact same model and API key configured above."}
              </p>
            </section>

            <section className="glass-panel rounded-3xl border border-white/10 p-6">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{copy.regionTitle}</p>
              <h3 className="mt-2 font-headline text-2xl font-bold text-white">{copy.regionTitle}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-300">{copy.regionSubtitle}</p>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
                <div className="rounded-[28px] border border-cyan-300/15 bg-slate-950/35 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{copy.mapTitle}</p>
                      <p className="mt-1 text-xs leading-6 text-slate-400">{copy.mapSubtitle}</p>
                    </div>
                    <button
                      className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-white/30"
                      onClick={() => setIsRegionListOpen((prev) => !prev)}
                    >
                      {isRegionListOpen ? copy.closeList : copy.openList}
                    </button>
                  </div>

                  <div className="relative mt-5 overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_30%_20%,_rgba(45,212,191,0.12),_transparent_30%),radial-gradient(circle_at_78%_30%,_rgba(56,189,248,0.1),_transparent_24%),linear-gradient(160deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.98))] p-4 md:p-6">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:42px_42px]" />
                    <div className="pointer-events-none absolute inset-x-6 top-5 flex justify-between text-[10px] uppercase tracking-[0.3em] text-slate-500">
                      <span>Pacific</span>
                      <span>Atlantic</span>
                      <span>Indian</span>
                    </div>
                    <div className="pointer-events-none absolute left-1/2 top-1/2 h-[90%] w-[96%] -translate-x-1/2 -translate-y-1/2 rounded-[999px] border border-cyan-200/8" />
                    <div className="relative z-10 mx-auto aspect-[2048/997] w-full max-w-[1240px]">
                      <Image
                        src="/world-map-equal-earth.svg"
                        alt=""
                        fill
                        priority={false}
                        unoptimized
                        className="pointer-events-none select-none object-contain opacity-95 [filter:drop-shadow(0_18px_60px_rgba(34,211,238,0.12))]"
                      />

                      {mapRegions.map((option) => {
                        const active = option.code === selectedRegion.code;
                        const offsetX = option.markerOffset?.x || 0;
                        const offsetY = option.markerOffset?.y || 0;
                        return (
                          <button
                            key={option.code}
                            aria-label={locale === "es" ? option.labelEs : option.label}
                            className="absolute z-20 h-0 w-0"
                            style={{ left: option.projectedPosition.left, top: option.projectedPosition.top }}
                            onClick={() => handleRegionChange(option.code)}
                          >
                            <span
                              className={`absolute left-0 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-[0_0_0_6px_rgba(8,15,32,0.24)] ${
                                active
                                  ? "border-cyan-100 bg-cyan-300"
                                  : "border-cyan-300/60 bg-slate-900"
                              }`}
                            />
                            <span
                              className="pointer-events-none absolute left-0 top-0 h-px w-px"
                              style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}
                            >
                              <span
                                className={`absolute left-0 top-0 h-px origin-left bg-cyan-200/30 ${
                                  offsetX || offsetY ? "block" : "hidden"
                                }`}
                                style={{
                                  width: `${Math.hypot(offsetX, offsetY)}px`,
                                  transform: `rotate(${Math.atan2(offsetY, offsetX) * (180 / Math.PI)}deg)`,
                                }}
                              />
                            </span>
                              <span
                              className={`absolute left-0 top-0 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-[0_12px_32px_rgba(2,6,23,0.45)] transition ${
                                active
                                  ? "border-cyan-200/80 bg-cyan-300 text-slate-950"
                                  : "border-white/20 bg-slate-950/90 text-white hover:border-cyan-200/45 hover:bg-slate-900"
                              }`}
                              style={{ transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))` }}
                            >
                              {option.mapLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Americas</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Europe</span>
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                        {locale === "es" ? "Puntos activos por pais" : "Active country markers"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-6 text-slate-300">
                    {locale === "es"
                      ? "Ahora el mapa usa una base cartografica real. Si quieres encontrar un pais mas rapido o prefieres texto en vez de mapa, abre la lista completa."
                      : "The map now uses a real cartographic base. If you want a faster text-first picker, open the full list below."}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border border-white/10 bg-slate-950/35 p-5">
                    <p className="text-sm font-semibold text-white">{copy.selectedZone}</p>
                    <p className="mt-1 text-xs leading-6 text-slate-400">{copy.selectedZoneSubtitle}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-cyan-100">{copy.activeRegion}</p>
                        <p className="mt-1 text-lg font-semibold text-white">{locale === "es" ? selectedRegion.labelEs : selectedRegion.label}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{copy.regionGroup}</p>
                        <p className="mt-1 text-sm font-semibold text-white">{getTrendRegionGroupLabel(selectedRegion.group, locale)}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-300">{locale === "es" ? selectedRegion.hintEs : selectedRegion.hintEn}</p>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-slate-950/35 p-5">
                    <p className="text-sm font-semibold text-white">{copy.sourcePrecision}</p>
                    <p className="mt-1 text-xs leading-6 text-slate-400">{copy.sourcePrecisionSubtitle}</p>
                    <div className="mt-4 grid gap-3">
                      {capabilityCards.map((item) => (
                        <div key={item.source} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-white">{formatSourceName(item.source)}</p>
                            <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${getCapabilityTone(item.level)}`}>
                              {getCapabilityLabel(item.level, locale)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-6 text-slate-400">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-slate-950/35 p-5">
                    <p className="text-sm font-semibold text-white">{copy.liveStatusTitle}</p>
                    <p className="mt-1 text-xs leading-6 text-slate-400">{copy.liveStatusSubtitle}</p>
                    {previewLoading ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                        {copy.statusLoading}
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {SOURCE_ORDER.map((source) => {
                          if (source === "reddit" && selectedRegion.code !== "US") return null;
                          const detail = getSourceStatusDetail(source, previewStatus, locale);
                          return (
                            <div key={source} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">{formatSourceName(source)}</p>
                                  <p className="mt-1 text-xs leading-6 text-slate-400">{detail.message}</p>
                                </div>
                                <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${getSourceStatusTone(detail.status)}`}>
                                  {translateSourceStatus(detail.status, locale)}
                                </span>
                              </div>
                              <div className="mt-3 flex items-center gap-4 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                                <span>
                                  {copy.itemsCount}: {detail.items_count}
                                </span>
                                <span>
                                  {copy.status}: {translateSourceStatus(detail.status, locale)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isRegionListOpen ? (
                <div className="mt-6 rounded-[28px] border border-white/10 bg-slate-950/30 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{copy.allRegions}</p>
                      <p className="mt-1 text-xs leading-6 text-slate-400">{copy.allRegionsSubtitle}</p>
                    </div>
                    <input
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 lg:max-w-sm"
                      value={regionSearch}
                      onChange={(event) => setRegionSearch(event.target.value)}
                      placeholder={copy.searchPlaceholder}
                    />
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-3">
                    {groupedFilteredRegions.map((group) => (
                      <div key={group.code} className="space-y-3">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                          {locale === "es" ? group.labelEs : group.label}
                        </p>
                        <div className="space-y-3">
                          {group.items.map((option) => (
                            <RegionChip
                              key={option.code}
                              option={option}
                              active={settings.trendRegionCode === option.code}
                              language={locale}
                              onSelect={handleRegionChange}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-xs leading-6 text-slate-300">
                {copy.localNotice}
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30"
                onClick={handleReset}
              >
                {copy.reset}
              </button>
              <button className="btn-gradient rounded-full px-5 py-2 text-sm font-bold text-slate-950" onClick={handleSave}>
                {copy.save}
              </button>
            </div>
          </div>

          <aside className="glass-panel rounded-3xl border border-white/10 p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{copy.systemCard}</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                <p className="text-xs text-slate-400">{copy.provider}</p>
                <p className="mt-1 text-lg font-semibold text-white">{systemStatus?.provider || "gemini"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                <p className="text-xs text-slate-400">{copy.defaultModel}</p>
                <p className="mt-1 break-all text-lg font-semibold text-white">
                  {systemStatus?.default_model || DEFAULT_PROMPT_ENGINE_SETTINGS.model}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                <p className="text-xs text-slate-400">{copy.backendKey}</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {systemStatus?.api_key_configured ? copy.configured : copy.missing}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/10 p-4">
                <p className="text-xs text-emerald-100">{copy.activeRegion}</p>
                <p className="mt-1 text-lg font-semibold text-white">{locale === "es" ? selectedRegion.labelEs : selectedRegion.label}</p>
              </div>
              <div className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-400/10 p-4">
                <p className="text-xs text-fuchsia-100">{copy.activeModel}</p>
                <p className="mt-1 break-all text-lg font-semibold text-white">
                  {settings.model || systemStatus?.default_model}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
