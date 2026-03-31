"use client";

import { ChangeEvent, useEffect, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import {
  buildVideoPromptGeneratorConfig,
  getTrendRegionOption,
  loadPromptEngineSettings,
  PromptEngineSettings,
  subscribePromptEngineSettings,
} from "../../lib/prompt-engine-settings";
import { MediaPromptResult } from "../../lib/types";

function formatBytes(value: number | null | undefined): string {
  if (!value || value <= 0) return "0 B";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${value} B`;
}

export default function TikTokStudioPage() {
  const { language } = useI18n();
  const [settings, setSettings] = useState<PromptEngineSettings>(() => loadPromptEngineSettings());
  useEffect(() => {
    return subscribePromptEngineSettings(setSettings);
  }, []);
  const region = getTrendRegionOption(settings.trendRegionCode);
  const videoConfig = buildVideoPromptGeneratorConfig(settings);

  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState(
    language === "es"
      ? "Mantener la energía viral, transiciones fluidas, morphing elegante y un resultado listo para pegar en un generador de video AI."
      : "Keep the viral energy, smooth transitions, elegant morphing, and a result ready to paste into an AI video generator."
  );
  const [niche, setNiche] = useState("creator");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MediaPromptResult | null>(null);
  const [copied, setCopied] = useState(false);

  const copy =
    language === "es"
      ? {
          title: "Estudio TikTok",
          subtitle:
            "Sube videos, imágenes o una URL y conviértelos en un prompt listo para clonar la mecánica viral, la cámara, el ritmo y la estructura visual en un modelo de video AI.",
          uploadTitle: "Fuente de referencia",
          uploadSub: "Puedes mezclar archivos locales y una URL. Si la URL tiene vista previa o video, la app intentará extraerlo para analizarlo.",
          url: "URL del video / post",
          niche: "Nicho o enfoque",
          notes: "Indicaciones creativas",
          files: "Archivos",
          pickFiles: "Seleccionar videos o imágenes",
          supported: "Acepta videos e imágenes. Si la fuente es una persona real, el prompt clona la escena y el movimiento, no la identidad exacta.",
          submit: "Analizar y generar prompt",
          generating: "Analizando con Gemini...",
          resultTitle: "Prompt generado",
          copy: "Copiar prompt",
          copied: "Copiado",
          summary: "Resumen",
          hook: "Hook",
          motion: "Movimiento",
          camera: "Cámara",
          style: "Estilo visual",
          beats: "Beats de escena",
          clone: "Notas de clonación",
          safety: "Notas de seguridad",
          analyzed: "Entradas analizadas",
          noResult: "Todavía no hay prompt. Sube una referencia y genera para verlo aquí.",
          model: "Modelo",
          region: "Zona",
        }
      : {
          title: "TikTok Studio",
          subtitle:
            "Upload videos, images, or a URL and turn them into a ready-to-use prompt that clones the viral mechanic, camera language, pacing, and visual structure for an AI video model.",
          uploadTitle: "Reference source",
          uploadSub: "You can mix local files and one URL. If the URL exposes preview media, the backend tries to extract it for analysis.",
          url: "Video / post URL",
          niche: "Niche or angle",
          notes: "Creative notes",
          files: "Files",
          pickFiles: "Choose videos or images",
          supported: "Supports videos and images. If the source is a real person, the prompt clones the scene and movement, not the exact identity.",
          submit: "Analyze and generate prompt",
          generating: "Analyzing with Gemini...",
          resultTitle: "Generated prompt",
          copy: "Copy prompt",
          copied: "Copied",
          summary: "Summary",
          hook: "Hook",
          motion: "Motion",
          camera: "Camera",
          style: "Visual style",
          beats: "Scene beats",
          clone: "Clone notes",
          safety: "Safety notes",
          analyzed: "Analyzed inputs",
          noResult: "No prompt yet. Upload a reference and generate to see it here.",
          model: "Model",
          region: "Region",
        };

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files || []);
    setFiles(picked);
  }

  async function handleSubmit() {
    if (!files.length && !sourceUrl.trim()) {
      setError(language === "es" ? "Sube un archivo o pega una URL para analizar." : "Upload a file or paste a URL to analyze.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);

    try {
      const form = new FormData();
      form.set("platform_target", "tiktok");
      form.set("desired_output", "video-remix");
      form.set("notes", notes);
      form.set("user_niche", niche);
      if (sourceUrl.trim()) form.set("source_url", sourceUrl.trim());
      if (videoConfig) form.set("generator_config_json", JSON.stringify(videoConfig));
      for (const file of files) {
        form.append("files", file);
      }
      const response = await api.analyzeVideoPrompt(form);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : language === "es" ? "No se pudo generar el prompt." : "Failed generating prompt");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result?.prompt_text) return;
    await navigator.clipboard.writeText(result.prompt_text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.35fr]">
        <section className="glass-panel rounded-3xl border border-white/10 p-6">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-100">
              {copy.region}: {region.label}
            </span>
            <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-fuchsia-100">
              {copy.model}: {videoConfig?.model || settings.videoModel}
            </span>
          </div>
          <h2 className="mt-4 font-headline text-3xl font-bold text-white">{copy.title}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">{copy.subtitle}</p>

          <div className="mt-6 space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{copy.uploadTitle}</p>
              <p className="mt-2 text-sm text-slate-300">{copy.uploadSub}</p>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white">{copy.url}</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                placeholder="https://www.tiktok.com/..."
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white">{copy.niche}</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                value={niche}
                onChange={(event) => setNiche(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white">{copy.notes}</span>
              <textarea
                className="min-h-32 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>

            <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/25 p-4">
              <p className="text-sm font-semibold text-white">{copy.files}</p>
              <label className="mt-3 inline-flex cursor-pointer rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/30">
                {copy.pickFiles}
                <input type="file" className="hidden" multiple accept="video/*,image/*" onChange={handleFiles} />
              </label>
              <p className="mt-3 text-xs leading-6 text-slate-400">{copy.supported}</p>
              {files.length ? (
                <div className="mt-4 space-y-2">
                  {files.map((file) => (
                    <div key={`${file.name}-${file.size}`} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
                      {file.name} · {formatBytes(file.size)}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              className="btn-gradient w-full rounded-full px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-60"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? copy.generating : copy.submit}
            </button>
          </div>
        </section>

        <section className="glass-panel rounded-3xl border border-white/10 p-6">
          {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
          {!result ? <p className="text-sm text-slate-400">{copy.noResult}</p> : null}

          {result ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-headline text-2xl font-bold text-white">{copy.resultTitle}</h3>
                  <p className="mt-2 text-sm text-slate-300">{result.generated_with}</p>
                </div>
                <button
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/30"
                  onClick={handleCopy}
                >
                  {copied ? copy.copied : copy.copy}
                </button>
              </div>

              <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/10 p-5">
                <p className="text-[11px] uppercase tracking-[0.25em] text-cyan-100">{copy.summary}</p>
                <p className="mt-3 text-sm leading-7 text-white">{result.payload.summary}</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{copy.hook}</p>
                    <p className="mt-2 text-sm text-white">{result.payload.hook}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{copy.style}</p>
                    <p className="mt-2 text-sm text-white">{result.payload.visual_style}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{copy.motion}</p>
                    <p className="mt-2 text-sm text-white">{result.payload.motion}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{copy.camera}</p>
                    <p className="mt-2 text-sm text-white">{result.payload.camera}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Prompt</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white">{result.prompt_text}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-5">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{copy.beats}</p>
                  <div className="mt-3 space-y-2">
                    {result.payload.scene_beats.map((beat) => (
                      <p key={beat} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100">
                        {beat}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-5">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{copy.clone}</p>
                  <div className="mt-3 space-y-2">
                    {result.payload.clone_notes.map((note) => (
                      <p key={note} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100">
                        {note}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-5">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{copy.safety}</p>
                  <div className="mt-3 space-y-2">
                    {result.payload.safety_notes.map((note) => (
                      <p key={note} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100">
                        {note}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-5">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{copy.analyzed}</p>
                  <div className="mt-3 space-y-2">
                    {result.analyzed_inputs.map((item) => (
                      <div key={`${item.name}-${item.origin}`} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100">
                        {item.name} · {item.mime_type || item.source_type} · {formatBytes(item.size_bytes ?? 0)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
