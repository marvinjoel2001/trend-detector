"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

type Language = "en" | "es";

const translations = {
  en: {
    navDashboard: "Dashboard",
    navLiveTrends: "Live Trends",
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
  },
  es: {
    navDashboard: "Panel",
    navLiveTrends: "Tendencias en Vivo",
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
  },
} as const;

type I18nContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof (typeof translations)["en"]) => string;
};

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("trendprompt_language");
    if (stored === "en" || stored === "es") {
      setLanguage(stored);
      return;
    }
    const browser = navigator.language.toLowerCase();
    if (browser.startsWith("es")) setLanguage("es");
  }, []);

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

