"use client";

import { useEffect, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { PromptFeedConfig, PromptFeedItem, PromptFeedResponse } from "../../lib/types";

function sourceTone(source: string): string {
  switch (source) {
    case "lexica":
      return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
    case "prompthero":
      return "border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-100";
    case "krea":
      return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
    case "civitai":
      return "border-violet-300/25 bg-violet-400/10 text-violet-100";
    default:
      return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  }
}

function PromptFeedImage({ item }: { item: PromptFeedItem }) {
  const [failed, setFailed] = useState(false);
  const src = item.thumbnail_url || item.image_url || "";
  if (!src || failed) {
    return (
      <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-6 text-center text-sm text-slate-300">
        {item.source.toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={item.title}
      src={src}
      className="h-full w-full object-cover transition duration-500 hover:scale-105"
      onError={() => setFailed(true)}
    />
  );
}

export default function PromptFeedPage() {
  const { language } = useI18n();
  const [config, setConfig] = useState<PromptFeedConfig | null>(null);
  const [result, setResult] = useState<PromptFeedResponse | null>(null);
  const [lexicaQuery, setLexicaQuery] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [githubOwner, setGithubOwner] = useState("krea-ai");
  const [githubRepo, setGithubRepo] = useState("open-prompts");
  const [githubBranch, setGithubBranch] = useState("main");
  const [githubPath, setGithubPath] = useState("data/1k.csv");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string>("");

  const copy =
    language === "es"
      ? {
          title: "Feed de Prompts",
          subtitle: "Explora prompts, diseños e imágenes desde Lexica, PromptHero, Krea, Civitai y repos públicos de GitHub.",
          lexicaSearchTitle: "Buscador Lexica",
          lexicaSearchSub: "Busca imágenes en Lexica y muestra el prompt original de cada resultado.",
          lexicaSearchButton: "Buscar en Lexica",
          search: "Buscar feed",
          source: "Fuente",
          query: "Consulta",
          queryPlaceholder: "Ej: retrato cinematográfico, diseño interior, anime...",
          allSources: "Todas",
          lexica: "Lexica",
          prompthero: "PromptHero",
          krea: "Krea",
          civitai: "Civitai",
          github: "GitHub",
          githubConfig: "Configuración GitHub",
          owner: "Propietario",
          repo: "Repo",
          branch: "Rama",
          path: "Ruta",
          searchButton: "Buscar",
          loading: "Cargando feed de prompts...",
          noItems: "No se encontraron resultados para esta búsqueda.",
          copyPrompt: "Copiar prompt",
          copied: "Copiado",
          openSource: "Abrir fuente",
          prompt: "Prompt",
          model: "Modelo",
          dimensions: "Dimensiones",
          sourceStatus: "Estado de conectores",
          sourceStatusMessage: "Mensaje",
          requiresKey: "requiere key",
          configured: "configurado",
          notConfigured: "sin key",
          githubHint: "Para GitHub puedes apuntar a cualquier archivo público .csv, .json, .md o .txt.",
        }
      : {
          title: "Prompt Feed",
          subtitle: "Explore prompts, designs, and images from Lexica, PromptHero, Krea Open Prompts, and public GitHub repos.",
          lexicaSearchTitle: "Lexica Search",
          lexicaSearchSub: "Search Lexica images and display each result with its original prompt.",
          lexicaSearchButton: "Search Lexica",
          search: "Search feed",
          source: "Source",
          query: "Query",
          queryPlaceholder: "Ex: cyberpunk city, luxury interior, anime portrait...",
          allSources: "All",
          lexica: "Lexica",
          prompthero: "PromptHero",
          krea: "Krea",
          civitai: "Civitai",
          github: "GitHub",
          githubConfig: "GitHub config",
          owner: "Owner",
          repo: "Repo",
          branch: "Branch",
          path: "Path",
          searchButton: "Search",
          loading: "Loading prompt feed...",
          noItems: "No results found for this search.",
          copyPrompt: "Copy prompt",
          copied: "Copied",
          openSource: "Open source",
          prompt: "Prompt",
          model: "Model",
          dimensions: "Dimensions",
          sourceStatus: "Connector status",
          sourceStatusMessage: "Message",
          requiresKey: "requires key",
          configured: "configured",
          notConfigured: "missing key",
          githubHint: "For `GitHub`, you can point to any public `.csv`, `.json`, `.md`, or `.txt` file.",
        };

  useEffect(() => {
    let cancelled = false;

    api
      .getPromptFeedConfig()
      .then((data) => {
        if (cancelled) return;
        setConfig(data);
        setLexicaQuery(data.default_query || "");
        setQuery(data.default_query || "");
        setGithubOwner(data.github_defaults.owner);
        setGithubRepo(data.github_defaults.repo);
        setGithubBranch(data.github_defaults.branch);
        setGithubPath(data.github_defaults.path);
        return api.getPromptFeed({
          query: data.default_query || "",
          source: "all",
          limit: 12,
          github_owner: data.github_defaults.owner,
          github_repo: data.github_defaults.repo,
          github_branch: data.github_defaults.branch,
          github_path: data.github_defaults.path,
        });
      })
      .then((data) => {
        if (cancelled || !data) return;
        setResult(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed loading prompt feed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPromptFeed({
        query,
        source,
        limit: 12,
        github_owner: githubOwner,
        github_repo: githubRepo,
        github_branch: githubBranch,
        github_path: githubPath,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed loading prompt feed");
    } finally {
      setLoading(false);
    }
  }

  async function submitLexicaSearch() {
    const normalized = lexicaQuery.trim();
    if (!normalized) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPromptFeed({
        query: normalized,
        source: "lexica",
        limit: 18,
      });
      setSource("lexica");
      setQuery(normalized);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed loading prompt feed");
    } finally {
      setLoading(false);
    }
  }

  async function copyPrompt(item: PromptFeedItem) {
    if (!item.prompt) return;
    try {
      await navigator.clipboard.writeText(item.prompt);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(""), 1600);
    } catch {
      setCopiedId("");
    }
  }

  const statusItems = result?.source_status
    ? Object.values(result.source_status)
    : config?.sources.map((item) => ({
        source: item.source,
        configured: item.configured,
        enabled: item.enabled,
        items_count: 0,
        message: item.note,
        requires_api_key: item.requires_api_key,
      })) || [];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="font-headline text-3xl font-bold text-white">{copy.title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">{copy.subtitle}</p>
        </div>

        <section className="glass-panel rounded-3xl border border-cyan-300/20 p-6">
          <div className="mb-4">
            <h3 className="font-headline text-xl font-bold text-white">{copy.lexicaSearchTitle}</h3>
            <p className="mt-1 text-sm text-slate-300">{copy.lexicaSearchSub}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className="w-full rounded-2xl border border-cyan-300/20 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              value={lexicaQuery}
              onChange={(event) => setLexicaQuery(event.target.value)}
              placeholder={copy.queryPlaceholder}
            />
            <button
              className="btn-gradient rounded-full px-5 py-2.5 text-sm font-bold text-slate-950"
              onClick={submitLexicaSearch}
            >
              {copy.lexicaSearchButton}
            </button>
          </div>
        </section>

        <section className="glass-panel rounded-3xl border border-white/10 p-6">
          <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-100">{copy.query}</label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.queryPlaceholder}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-100">{copy.source}</label>
                <select
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                >
                  <option value="all">{copy.allSources}</option>
                  <option value="lexica">{copy.lexica}</option>
                  <option value="prompthero">{copy.prompthero}</option>
                  <option value="krea">{copy.krea}</option>
                  <option value="civitai">{copy.civitai}</option>
                  <option value="github">{copy.github}</option>
                </select>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-headline text-lg font-bold text-white">{copy.githubConfig}</h3>
                <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-100">
                  GitHub
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-300/40"
                  value={githubOwner}
                  onChange={(event) => setGithubOwner(event.target.value)}
                  placeholder={copy.owner}
                />
                <input
                  className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-300/40"
                  value={githubRepo}
                  onChange={(event) => setGithubRepo(event.target.value)}
                  placeholder={copy.repo}
                />
                <input
                  className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-300/40"
                  value={githubBranch}
                  onChange={(event) => setGithubBranch(event.target.value)}
                  placeholder={copy.branch}
                />
                <input
                  className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-300/40"
                  value={githubPath}
                  onChange={(event) => setGithubPath(event.target.value)}
                  placeholder={copy.path}
                />
              </div>
              <p className="mt-3 text-xs text-slate-400">{copy.githubHint}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="btn-gradient rounded-full px-5 py-2.5 text-sm font-bold text-slate-950" onClick={submit}>
              {copy.searchButton}
            </button>
            {loading ? <span className="text-sm text-slate-300">{copy.loading}</span> : null}
          </div>
        </section>

        <section className="glass-panel rounded-3xl border border-white/10 p-6">
          <h3 className="font-headline text-xl font-bold text-white">{copy.sourceStatus}</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {statusItems.map((status) => (
              <span
                key={status.source}
                className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${
                  status.enabled
                    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                    : "border-amber-300/25 bg-amber-400/10 text-amber-100"
                }`}
              >
                {status.source}: {status.enabled ? copy.configured : copy.notConfigured}
                {status.requires_api_key ? ` / ${copy.requiresKey}` : ""}
              </span>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-xs text-slate-400">
            {statusItems.map((status) => (
              <p key={`${status.source}-msg`}>
                {status.source} · {copy.sourceStatusMessage}: {status.message}
              </p>
            ))}
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
        {!loading && !result?.items.length ? <div className="text-sm text-slate-400">{copy.noItems}</div> : null}

        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {(result?.items || []).map((item) => (
            <article key={`${item.source}-${item.id}`} className="glass-panel overflow-hidden rounded-3xl border border-white/10">
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-950/50">
                <PromptFeedImage item={item} />
              </div>

              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${sourceTone(item.source)}`}>
                    {item.source}
                  </span>
                  {item.model ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                      {item.model}
                    </span>
                  ) : null}
                </div>

                <div>
                  <h4 className="font-headline text-lg font-bold text-white">{item.title}</h4>
                  <p className="mt-2 max-h-36 overflow-auto pr-1 text-sm text-slate-200">{item.prompt}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.model}</p>
                    <p className="mt-1 text-sm text-white">{item.model || "N/A"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.dimensions}</p>
                    <p className="mt-1 text-sm text-white">
                      {item.width && item.height ? `${item.width} x ${item.height}` : "N/A"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/30"
                    onClick={() => copyPrompt(item)}
                  >
                    {copiedId === item.id ? copy.copied : copy.copyPrompt}
                  </button>
                  {item.source_url ? (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/40"
                    >
                      {copy.openSource}
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
