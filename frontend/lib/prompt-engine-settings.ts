"use client";

import { PromptGeneratorConfig } from "./types";

export type PromptEngineSettings = {
  mode: "system" | "custom-gemini";
  apiKey: string;
  model: string;
  trendRegionCode: string;
  trendRegionLabel: string;
  videoMode: "inherit-prompt-engine" | "custom-gemini";
  videoApiKey: string;
  videoModel: string;
};

export type TrendRegionCapabilityLevel = "exact" | "best-effort";

export type TrendRegionOption = {
  code: string;
  label: string;
  labelEs: string;
  hintEs: string;
  hintEn: string;
  group: "south-america" | "north-america" | "europe";
  mapLabel: string;
  searchTerms: string[];
  mapCoordinates?: {
    lon: number;
    lat: number;
  };
  markerOffset?: {
    x: number;
    y: number;
  };
  capabilities: {
    google: TrendRegionCapabilityLevel;
    youtube: TrendRegionCapabilityLevel;
    tiktok: TrendRegionCapabilityLevel;
  };
};

export const TREND_REGION_GROUPS: Array<{
  code: TrendRegionOption["group"];
  label: string;
  labelEs: string;
}> = [
  { code: "south-america", label: "South America", labelEs: "Sudamerica" },
  { code: "north-america", label: "North America", labelEs: "Norteamerica" },
  { code: "europe", label: "Europe", labelEs: "Europa" },
];

export const SOUTH_AMERICA_MAP_CODES = ["CO", "VE", "EC", "PE", "BR", "BO", "PY", "CL", "AR", "UY"] as const;

export const TREND_REGION_OPTIONS: TrendRegionOption[] = [
  {
    code: "BO",
    label: "Bolivia",
    labelEs: "Bolivia",
    hintEs: "Google y YouTube por Bolivia; TikTok solo como aproximacion regional.",
    hintEn: "Google and YouTube for Bolivia; TikTok stays regional best effort.",
    group: "south-america",
    mapLabel: "BO",
    searchTerms: ["bolivia", "la paz", "santa cruz", "cochabamba", "sudamerica", "south america"],
    mapCoordinates: { lon: -64.7, lat: -16.3 },
    markerOffset: { x: 16, y: 0 },
    capabilities: { google: "exact", youtube: "exact", tiktok: "best-effort" },
  },
  {
    code: "AR",
    label: "Argentina",
    labelEs: "Argentina",
    hintEs: "Radar enfocado en Argentina.",
    hintEn: "Trend radar for Argentina.",
    group: "south-america",
    mapLabel: "AR",
    searchTerms: ["argentina", "buenos aires", "sudamerica", "south america"],
    mapCoordinates: { lon: -63.6, lat: -38.4 },
    markerOffset: { x: 12, y: 18 },
    capabilities: { google: "exact", youtube: "exact", tiktok: "best-effort" },
  },
  {
    code: "BR",
    label: "Brazil",
    labelEs: "Brasil",
    hintEs: "Tendencias grandes de Brasil.",
    hintEn: "Large-scale trends from Brazil.",
    group: "south-america",
    mapLabel: "BR",
    searchTerms: ["brazil", "brasil", "rio", "sao paulo", "sudamerica", "south america"],
    mapCoordinates: { lon: -51.9, lat: -14.2 },
    markerOffset: { x: 26, y: -6 },
    capabilities: { google: "exact", youtube: "exact", tiktok: "best-effort" },
  },
  {
    code: "CL",
    label: "Chile",
    labelEs: "Chile",
    hintEs: "Senales virales de Chile.",
    hintEn: "Viral signals from Chile.",
    group: "south-america",
    mapLabel: "CL",
    searchTerms: ["chile", "santiago", "sudamerica", "south america"],
    mapCoordinates: { lon: -71.5, lat: -35.7 },
    markerOffset: { x: -18, y: 10 },
    capabilities: { google: "exact", youtube: "exact", tiktok: "best-effort" },
  },
  {
    code: "CO",
    label: "Colombia",
    labelEs: "Colombia",
    hintEs: "Lo que mas empuja en Colombia.",
    hintEn: "What is moving fastest in Colombia.",
    group: "south-america",
    mapLabel: "CO",
    searchTerms: ["colombia", "bogota", "medellin", "sudamerica", "south america"],
    mapCoordinates: { lon: -74, lat: 4 },
    markerOffset: { x: 10, y: -16 },
    capabilities: { google: "exact", youtube: "exact", tiktok: "best-effort" },
  },
  {
    code: "EC",
    label: "Ecuador",
    labelEs: "Ecuador",
    hintEs: "Territorio andino con filtro exacto en Google y YouTube.",
    hintEn: "Andean territory with exact Google and YouTube filtering.",
    group: "south-america",
    mapLabel: "EC",
    searchTerms: ["ecuador", "quito", "guayaquil", "sudamerica", "south america"],
    mapCoordinates: { lon: -78.2, lat: -1.5 },
    markerOffset: { x: -4, y: -2 },
    capabilities: { google: "exact", youtube: "exact", tiktok: "best-effort" },
  },
  {
    code: "PY",
    label: "Paraguay",
    labelEs: "Paraguay",
    hintEs: "Buen filtro para senales cercanas a Bolivia y el cono sur.",
    hintEn: "Good filter for signals near Bolivia and the southern cone.",
    group: "south-america",
    mapLabel: "PY",
    searchTerms: ["paraguay", "asuncion", "sudamerica", "south america"],
    mapCoordinates: { lon: -58.4, lat: -23.4 },
    markerOffset: { x: 14, y: 16 },
    capabilities: { google: "exact", youtube: "exact", tiktok: "best-effort" },
  },
  {
    code: "PE",
    label: "Peru",
    labelEs: "Peru",
    hintEs: "Senales de Peru.",
    hintEn: "Signals from Peru.",
    group: "south-america",
    mapLabel: "PE",
    searchTerms: ["peru", "lima", "sudamerica", "south america"],
    mapCoordinates: { lon: -75, lat: -9.2 },
    markerOffset: { x: -20, y: 2 },
    capabilities: { google: "exact", youtube: "exact", tiktok: "best-effort" },
  },
  {
    code: "UY",
    label: "Uruguay",
    labelEs: "Uruguay",
    hintEs: "Seguimiento del mercado pequeno del Rio de la Plata.",
    hintEn: "Follow the smaller Rio de la Plata market.",
    group: "south-america",
    mapLabel: "UY",
    searchTerms: ["uruguay", "montevideo", "sudamerica", "south america"],
    mapCoordinates: { lon: -56, lat: -32.8 },
    markerOffset: { x: 30, y: 18 },
    capabilities: { google: "exact", youtube: "exact", tiktok: "best-effort" },
  },
  {
    code: "VE",
    label: "Venezuela",
    labelEs: "Venezuela",
    hintEs: "Cobertura del norte de Sudamerica.",
    hintEn: "Coverage for northern South America.",
    group: "south-america",
    mapLabel: "VE",
    searchTerms: ["venezuela", "caracas", "sudamerica", "south america"],
    mapCoordinates: { lon: -66, lat: 7 },
    markerOffset: { x: 28, y: -18 },
    capabilities: { google: "exact", youtube: "exact", tiktok: "best-effort" },
  },
  {
    code: "MX",
    label: "Mexico",
    labelEs: "Mexico",
    hintEs: "Panorama viral de Mexico.",
    hintEn: "Viral view of Mexico.",
    group: "north-america",
    mapLabel: "MX",
    searchTerms: ["mexico", "cdmx", "north america", "latam"],
    mapCoordinates: { lon: -102, lat: 23 },
    markerOffset: { x: -10, y: 18 },
    capabilities: { google: "exact", youtube: "exact", tiktok: "best-effort" },
  },
  {
    code: "US",
    label: "United States",
    labelEs: "Estados Unidos",
    hintEs: "Comportamiento viral de Estados Unidos.",
    hintEn: "Viral behavior from the United States.",
    group: "north-america",
    mapLabel: "US",
    searchTerms: ["united states", "usa", "us", "north america"],
    mapCoordinates: { lon: -98, lat: 39 },
    markerOffset: { x: 0, y: 0 },
    capabilities: { google: "exact", youtube: "exact", tiktok: "best-effort" },
  },
  {
    code: "ES",
    label: "Spain",
    labelEs: "Espana",
    hintEs: "Tendencias de Espana.",
    hintEn: "Trends from Spain.",
    group: "europe",
    mapLabel: "ES",
    searchTerms: ["spain", "espana", "madrid", "barcelona", "europe"],
    mapCoordinates: { lon: -3.7, lat: 40.3 },
    markerOffset: { x: 0, y: 0 },
    capabilities: { google: "exact", youtube: "exact", tiktok: "best-effort" },
  },
];

export const PROMPT_ENGINE_SETTINGS_STORAGE_KEY = "trendprompt_prompt_engine_settings";

export const DEFAULT_PROMPT_ENGINE_SETTINGS: PromptEngineSettings = {
  mode: "system",
  apiKey: "",
  model: "gemini-1.5-flash",
  trendRegionCode: "US",
  trendRegionLabel: "United States",
  videoMode: "custom-gemini",
  videoApiKey: "",
  videoModel: "gemini-3.1-pro-preview",
};

export function getTrendRegionOption(code: string | undefined): TrendRegionOption {
  const normalized = `${code || ""}`.trim().toUpperCase();
  return (
    TREND_REGION_OPTIONS.find((item) => item.code === normalized) || {
      code: normalized || DEFAULT_PROMPT_ENGINE_SETTINGS.trendRegionCode,
      label: normalized || DEFAULT_PROMPT_ENGINE_SETTINGS.trendRegionLabel,
      labelEs: normalized || DEFAULT_PROMPT_ENGINE_SETTINGS.trendRegionLabel,
      hintEs: "Zona personalizada.",
      hintEn: "Custom territory.",
      group: "north-america",
      mapLabel: normalized || DEFAULT_PROMPT_ENGINE_SETTINGS.trendRegionCode,
      searchTerms: [normalized || DEFAULT_PROMPT_ENGINE_SETTINGS.trendRegionCode],
      capabilities: { google: "exact", youtube: "exact", tiktok: "best-effort" },
    }
  );
}

export function getTrendRegionGroupLabel(groupCode: TrendRegionOption["group"], language: "es" | "en"): string {
  const group = TREND_REGION_GROUPS.find((item) => item.code === groupCode);
  if (!group) return language === "es" ? "Region" : "Region";
  return language === "es" ? group.labelEs : group.label;
}

export function matchesTrendRegionSearch(option: TrendRegionOption, term: string): boolean {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return true;
  return [option.code, option.label, option.labelEs, option.hintEs, option.hintEn, ...option.searchTerms].some((value) =>
    value.toLowerCase().includes(normalized)
  );
}

export function loadPromptEngineSettings(): PromptEngineSettings {
  if (typeof window === "undefined") {
    return DEFAULT_PROMPT_ENGINE_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(PROMPT_ENGINE_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_PROMPT_ENGINE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PromptEngineSettings>;
    const region = getTrendRegionOption(parsed.trendRegionCode || DEFAULT_PROMPT_ENGINE_SETTINGS.trendRegionCode);
    return {
      mode: parsed.mode === "custom-gemini" ? "custom-gemini" : "system",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: typeof parsed.model === "string" && parsed.model.trim() ? parsed.model : DEFAULT_PROMPT_ENGINE_SETTINGS.model,
      trendRegionCode: region.code,
      trendRegionLabel:
        typeof parsed.trendRegionLabel === "string" && parsed.trendRegionLabel.trim() ? parsed.trendRegionLabel : region.label,
      videoMode: parsed.videoMode === "inherit-prompt-engine" ? "inherit-prompt-engine" : "custom-gemini",
      videoApiKey: typeof parsed.videoApiKey === "string" ? parsed.videoApiKey : "",
      videoModel:
        typeof parsed.videoModel === "string" && parsed.videoModel.trim()
          ? parsed.videoModel
          : DEFAULT_PROMPT_ENGINE_SETTINGS.videoModel,
    };
  } catch {
    return DEFAULT_PROMPT_ENGINE_SETTINGS;
  }
}

export function savePromptEngineSettings(settings: PromptEngineSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROMPT_ENGINE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function buildPromptGeneratorConfig(settings: PromptEngineSettings): PromptGeneratorConfig | undefined {
  if (settings.mode !== "custom-gemini") return undefined;

  const apiKey = settings.apiKey.trim();
  const model = settings.model.trim();
  if (!apiKey && !model) return undefined;

  return {
    provider: "gemini",
    api_key: apiKey || undefined,
    model: model || undefined,
  };
}

export function buildVideoPromptGeneratorConfig(settings: PromptEngineSettings): PromptGeneratorConfig | undefined {
  if (settings.videoMode === "inherit-prompt-engine") {
    return buildPromptGeneratorConfig(settings);
  }

  const apiKey = settings.videoApiKey.trim();
  const model = settings.videoModel.trim();
  if (!apiKey && !model) return undefined;

  return {
    provider: "gemini",
    api_key: apiKey || undefined,
    model: model || undefined,
  };
}

export function buildGeoQuery(params: Record<string, string | number | boolean | undefined>, settings?: PromptEngineSettings): string {
  const resolvedSettings = settings || loadPromptEngineSettings();
  const query = new URLSearchParams();
  const regionCode = getTrendRegionOption(resolvedSettings.trendRegionCode).code;
  if (regionCode) {
    query.set("geo", regionCode);
  }
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || `${value}`.trim() === "") continue;
    query.set(key, `${value}`);
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}
