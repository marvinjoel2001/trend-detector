"use client";

import { createContext, ReactNode, useContext, useMemo, useState } from "react";

type Language = "en" | "es";

const translations = {
  en: {
    navDashboard: "Dashboard",
    navLiveTrends: "Live Trends",
    navPromptFeed: "Prompt Feed",
    navPromptGenerator: "Prompt Generator",
    navHistory: "History",
    navForecast: "Forecast",
    navSettings: "Settings",
    subtitle: "Real-time trend intelligence and prompt synthesis",
    marketVelocityDashboard: "Market Velocity Dashboard",
    dashboardSub: "Real-time cross-platform cultural intelligence",
    loadingTrends: "Loading trends...",
    noTrends: "No trends found.",
    quickPromptGenerator: "Quick Prompt Generator",
    quickPromptSub: "Generate trend-aware prompts for short-form AI content.",
    quickPromptTapCard: "Tap a video or image card to open the floating generator modal.",
    quickPromptModalSub: "Choose the output format and generate your prompt from this trend.",
    quickPromptTypeVideo: "Video",
    quickPromptTypeImage: "Image",
    quickPromptCancel: "Cancel",
    quickPromptCopy: "Copy",
    quickPromptCopied: "Copied",
    quickPromptEmpty: "Select format and generate to see your prompt here.",
    trend: "Trend",
    generatePrompt: "Generate Prompt",
    generating: "Generating...",
    views: "Views",
    openTrend: "Open Trend",
    loadingTrendDetail: "Loading trend detail...",
    trendNotFound: "Trend not found.",
    momentumSnapshots: "Momentum (Recent Snapshots)",
    sixHourForecast: "6-Hour Forecast",
    noForecast: "No forecast yet.",
    promptGenerator: "Prompt Generator",
    generatedPrompt: "Generated Prompt",
    noPromptYet: "No prompt generated yet.",
    generate: "Generate",
    promptHistory: "Prompt History",
    loadingHistory: "Loading history...",
    noPromptHistory: "No generated prompts yet.",
    forecastAnalytics: "Forecast Analytics",
    selectTrend: "Select Trend",
    selectTrendForecast: "Select a trend to load forecast.",
    loadingForecastTrends: "Loading trends...",
    liveTrendEvents: "Live Trend Events",
    waitingLiveUpdates: "Waiting for live updates...",
    settings: "Settings",
    settingsDesc: "API-backed settings can be extended here for user niches, webhook integrations, and platform defaults.",
    velocity: "Velocity",
    confidence: "Confidence",
    style: "Style",
    tone: "Tone",
    format: "Format",
    publish: "Publish",
    language: "Language",
    preview: "Preview",
    openSource: "Open Source",
    noPreviewAvailable: "No preview available yet.",
    previewGallery: "Related Preview Gallery",
    loadingPreviewGallery: "Loading related previews...",
    noPreviewGalleryItems: "No related media found for this trend yet.",
  },
  es: {
    navDashboard: "Panel",
    navLiveTrends: "Tendencias en Vivo",
    navPromptFeed: "Feed de Prompts",
    navPromptGenerator: "Generador de Prompts",
    navHistory: "Historial",
    navForecast: "Pronóstico",
    navSettings: "Configuración",
    subtitle: "Inteligencia de tendencias en tiempo real y síntesis de prompts",
    marketVelocityDashboard: "Panel de Velocidad del Mercado",
    dashboardSub: "Inteligencia cultural multiplataforma en tiempo real",
    loadingTrends: "Cargando tendencias...",
    noTrends: "No se encontraron tendencias.",
    quickPromptGenerator: "Generador Rápido de Prompts",
    quickPromptSub: "Genera prompts basados en tendencias para contenido corto.",
    quickPromptTapCard: "Toca una card de video o foto para abrir el modal flotante del generador.",
    quickPromptModalSub: "Elige el formato de salida y genera el prompt desde esta tendencia.",
    quickPromptTypeVideo: "Video",
    quickPromptTypeImage: "Foto",
    quickPromptCancel: "Cancelar",
    quickPromptCopy: "Copiar",
    quickPromptCopied: "Copiado",
    quickPromptEmpty: "Elige formato y genera para ver aquí tu prompt.",
    trend: "Tendencia",
    generatePrompt: "Generar Prompt",
    generating: "Generando...",
    views: "Vistas",
    openTrend: "Ver Tendencia",
    loadingTrendDetail: "Cargando detalle de tendencia...",
    trendNotFound: "Tendencia no encontrada.",
    momentumSnapshots: "Momentum (Snapshots Recientes)",
    sixHourForecast: "Pronóstico a 6 Horas",
    noForecast: "Aún no hay pronóstico.",
    promptGenerator: "Generador de Prompts",
    generatedPrompt: "Prompt Generado",
    noPromptYet: "Aún no se generó ningún prompt.",
    generate: "Generar",
    promptHistory: "Historial de Prompts",
    loadingHistory: "Cargando historial...",
    noPromptHistory: "Aún no hay prompts generados.",
    forecastAnalytics: "Analítica de Pronóstico",
    selectTrend: "Seleccionar Tendencia",
    selectTrendForecast: "Selecciona una tendencia para cargar pronóstico.",
    loadingForecastTrends: "Cargando tendencias...",
    liveTrendEvents: "Eventos de Tendencias en Vivo",
    waitingLiveUpdates: "Esperando actualizaciones en vivo...",
    settings: "Configuración",
    settingsDesc: "Aquí se pueden ampliar ajustes conectados a API para nichos, webhooks y defaults de plataforma.",
    velocity: "Velocidad",
    confidence: "Confianza",
    style: "Estilo",
    tone: "Tono",
    format: "Formato",
    publish: "Publicación",
    language: "Idioma",
    preview: "Previsualización",
    openSource: "Abrir Fuente",
    noPreviewAvailable: "Aún no hay previsualización disponible.",
    previewGallery: "Galería de Previews Relacionados",
    loadingPreviewGallery: "Cargando previews relacionados...",
    noPreviewGalleryItems: "Aún no se encontró media relacionada para esta tendencia.",
  },
} as const;

type I18nContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof (typeof translations)["en"]) => string;
};

const I18nContext = createContext<I18nContextType | null>(null);

function resolveInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem("trendprompt_language");
  if (stored === "en" || stored === "es") return stored;
  const browser = navigator.language.toLowerCase();
  return browser.startsWith("es") ? "es" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(resolveInitialLanguage);

  const value = useMemo<I18nContextType>(
    () => ({
      language,
      setLanguage: (lang) => {
        setLanguage(lang);
        window.localStorage.setItem("trendprompt_language", lang);
      },
      t: (key) => translations[language][key],
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
