"use client";

import { useEffect, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import {
  DEFAULT_PROMPT_ENGINE_SETTINGS,
  PromptEngineSettings,
  loadPromptEngineSettings,
  savePromptEngineSettings,
} from "../../lib/prompt-engine-settings";
import { PromptEngineStatus } from "../../lib/types";

export default function SettingsPage() {
  const { t, language } = useI18n();
  const [settings, setSettings] = useState<PromptEngineSettings>(DEFAULT_PROMPT_ENGINE_SETTINGS);
  const [systemStatus, setSystemStatus] = useState<PromptEngineStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    setSettings(loadPromptEngineSettings());
    api.getPromptEngineConfig().then(setSystemStatus).catch(() => null);
  }, []);

  const copy =
    language === "es"
      ? {
          title: "Motor de prompts",
          subtitle: "Configura una API key y un modelo de Gemini personalizados sin romper el fallback actual del sistema.",
          systemMode: "Usar configuración actual del sistema",
          customMode: "Usar Gemini personalizado",
          apiKey: "API key de Gemini",
          apiKeyHint: "Si la dejas vacía en modo personalizado, se seguirá usando la key del backend y solo cambiará el modelo.",
          model: "Modelo de Gemini",
          modelHint: "Ejemplo: gemini-1.5-flash, gemini-1.5-pro o el modelo que quieras probar.",
          localNotice: "La configuración se guarda en este navegador y se aplica al generar prompts desde el dashboard y el generador.",
          systemCard: "Estado actual del backend",
          backendKey: "API key del backend",
          configured: "Configurada",
          missing: "No configurada",
          defaultModel: "Modelo por defecto",
          provider: "Proveedor",
          reset: "Restablecer",
          save: "Guardar cambios",
          saved: "Configuración guardada.",
          resetDone: "Configuración restablecida.",
        }
      : {
          title: "Prompt engine",
          subtitle: "Set a custom Gemini API key and model without breaking the current system fallback.",
          systemMode: "Use current system configuration",
          customMode: "Use custom Gemini",
          apiKey: "Gemini API key",
          apiKeyHint: "If you leave it empty in custom mode, the backend key is still used and only the model changes.",
          model: "Gemini model",
          modelHint: "Example: gemini-1.5-flash, gemini-1.5-pro, or any model you want to test.",
          localNotice: "This configuration is stored in this browser and applied when generating prompts from the dashboard and prompt generator.",
          systemCard: "Current backend status",
          backendKey: "Backend API key",
          configured: "Configured",
          missing: "Not configured",
          defaultModel: "Default model",
          provider: "Provider",
          reset: "Reset",
          save: "Save changes",
          saved: "Configuration saved.",
          resetDone: "Configuration reset.",
        };

  function updateSetting<K extends keyof PromptEngineSettings>(key: K, value: PromptEngineSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
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
    setSettings(resetSettings);
    savePromptEngineSettings(resetSettings);
    setStatusMessage(copy.resetDone);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-headline text-3xl font-bold">{t("settings")}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">{copy.subtitle}</p>
          </div>
          {statusMessage ? (
            <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
              {statusMessage}
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.5fr,1fr]">
          <section className="glass-panel rounded-3xl border border-white/10 p-6">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{copy.title}</p>
              <h3 className="mt-2 font-headline text-2xl font-bold text-white">{copy.title}</h3>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                className={`rounded-2xl border p-4 text-left transition ${
                  settings.mode === "system"
                    ? "border-white/35 bg-white/10 text-white"
                    : "border-white/10 bg-slate-950/35 text-slate-300 hover:border-white/20"
                }`}
                onClick={() => updateSetting("mode", "system")}
              >
                <p className="text-sm font-semibold">{copy.systemMode}</p>
                <p className="mt-2 text-xs text-slate-400">{t("settingsDesc")}</p>
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

            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-xs text-slate-300">
              {copy.localNotice}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30"
                onClick={handleReset}
              >
                {copy.reset}
              </button>
              <button
                className="btn-gradient rounded-full px-5 py-2 text-sm font-bold text-slate-950"
                onClick={handleSave}
              >
                {copy.save}
              </button>
            </div>
          </section>

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
              <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4 text-sm text-cyan-100">
                {settings.mode === "custom-gemini"
                  ? `${copy.customMode}. ${copy.defaultModel}: ${settings.model || systemStatus?.default_model || DEFAULT_PROMPT_ENGINE_SETTINGS.model}`
                  : copy.systemMode}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
