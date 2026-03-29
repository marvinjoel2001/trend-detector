"use client";

import { PromptGeneratorConfig } from "./types";

export type PromptEngineSettings = {
  mode: "system" | "custom-gemini";
  apiKey: string;
  model: string;
};

export const PROMPT_ENGINE_SETTINGS_STORAGE_KEY = "trendprompt_prompt_engine_settings";

export const DEFAULT_PROMPT_ENGINE_SETTINGS: PromptEngineSettings = {
  mode: "system",
  apiKey: "",
  model: "gemini-1.5-flash",
};

export function loadPromptEngineSettings(): PromptEngineSettings {
  if (typeof window === "undefined") {
    return DEFAULT_PROMPT_ENGINE_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(PROMPT_ENGINE_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_PROMPT_ENGINE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PromptEngineSettings>;
    return {
      mode: parsed.mode === "custom-gemini" ? "custom-gemini" : "system",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: typeof parsed.model === "string" && parsed.model.trim() ? parsed.model : DEFAULT_PROMPT_ENGINE_SETTINGS.model,
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
