"use client";

import { useEffect, useRef, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { LoadingSkeleton } from "../../components/loading-skeleton";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { PromptFeedConfig, PromptFeedItem, PromptFeedResponse } from "../../lib/types";

const PAGE_SIZE = 24;

function sourceTone(source: string): string {
  switch (source) {
    case "lexica":
      return "border-sky-300/25 bg-sky-400/10 text-sky-100";
    case "prompthero":
      return "border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-100";
    case "krea":
      return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
    case "civitai":
      return "border-violet-300/25 bg-violet-400/10 text-violet-100";
    case "youtube":
      return "border-red-300/25 bg-red-400/10 text-red-100";
    case "reddit":
      return "border-orange-300/25 bg-orange-400/10 text-orange-100";
    case "tiktok":
      return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
    default:
      return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  }
}

function readPromptOrigin(item: PromptFeedItem): string {
  const value = item.metadata?.prompt_origin;
  return typeof value === "string" ? value : "source";
}

function mergePromptFeedItems(current: PromptFeedItem[], incoming: PromptFeedItem[]): PromptFeedItem[] {
  const merged = [...current];
  const seen = new Set(current.map((item) => `${item.source}:${item.id}`));

  for (const item of incoming) {
    const key = `${item.source}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

function PromptFeedImage({ item }: { item: PromptFeedItem }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const videoSrc = item.video_url || "";
  const imageSrc = item.thumbnail_url || item.image_url || "";

  if (videoSrc && !videoFailed) {
    return (
      <video
        className="h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        poster={imageSrc || undefined}
        onError={() => setVideoFailed(true)}
      >
        <source src={videoSrc} />
      </video>
    );
  }

  if (imageSrc && !imageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={item.title}
        src={imageSrc}
        className="h-full w-full object-cover transition duration-500 hover:scale-105"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-6 text-center text-sm text-slate-300">
      {item.source.toUpperCase()}
    </div>
  );
}

export default function PromptFeedPage() {
  const { language } = useI18n();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const emptyRetryRef = useRef(false);

  const [config, setConfig] = useState<PromptFeedConfig | null>(null);
  const [result, setResult] = useState<PromptFeedResponse | null>(null);
  const [items, setItems] = useState<PromptFeedItem[]>([]);
  const [source, setSource] = useState("all");
  const [githubOwner, setGithubOwner] = useState("krea-ai");
  const [githubRepo, setGithubRepo] = useState("open-prompts");
  const [githubBranch, setGithubBranch] = useState("main");
  const [githubPath, setGithubPath] = useState("data/1k.csv");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string>("");
  const [hasMore, setHasMore] = useState(true);
  const [nextOffset, setNextOffset] = useState(0);

  const copy =
    language === "es"
      ? {
          title: "Prompt Feed",
          subtitle: "Feed visual infinito con imagenes, videos y prompts base tomados de datasets creativos y fuentes sociales.",
          feedTitle: "Feed infinito",
          feedSub:
            "Aqui mezclamos lo que encontremos en PromptHero, Krea, Civitai, GitHub, YouTube, Reddit y TikTok. Cuando una fuente social no trae prompt original, generamos un prompt de referencia util basado en el contenido visible.",
          source: "Fuente",
          allSources: "Todas",
          lexica: "Lexica",
          prompthero: "PromptHero",
          krea: "Krea",
          civitai: "Civitai",
          github: "GitHub",
          youtube: "YouTube",
          reddit: "Reddit",
          tiktok: "TikTok",
          githubConfig: "Configuracion GitHub",
          owner: "Propietario",
          repo: "Repo",
          branch: "Rama",
          path: "Ruta",
          refreshButton: "Recargar feed",
          loadMore: "Cargar mas",
          loading: "Cargando feed visual...",
          loadingMore: "Trayendo mas referencias...",
          noItems: "No encontramos referencias en las fuentes activas.",
          copyPrompt: "Copiar prompt",
          copied: "Copiado",
          openSource: "Abrir fuente",
          prompt: "Prompt",
          promptUnavailable: "Esta referencia no trae un prompt utilizable.",
          referencePrompt: "Prompt de referencia",
          originalPrompt: "Prompt fuente",
          model: "Modelo",
          dimensions: "Dimensiones",
          sourceStatus: "Estado de conectores",
          sourceStatusMessage: "Mensaje",
          requiresKey: "requiere key",
          configured: "configurado",
          notConfigured: "sin key",
          githubHint: "Para GitHub puedes apuntar a cualquier archivo publico .csv, .json, .md o .txt con prompts.",
          feedHint: "El feed prioriza tarjetas con media real. Si una URL no responde al chequeo, igual intentamos mandarla al frontend para no perder previews validos.",
          video: "Video",
          loadedCount: "Referencias cargadas",
          endReached: "Llegaste al final del feed disponible para esta fuente.",
        }
      : {
          title: "Prompt Feed",
          subtitle: "Infinite visual feed with images, videos, and base prompts pulled from creative datasets and social sources.",
          feedTitle: "Infinite feed",
          feedSub:
            "This view mixes whatever we can pull from PromptHero, Krea, Civitai, GitHub, YouTube, Reddit, and TikTok. When a social source does not expose an original prompt, the app builds a useful reference prompt from the visible content.",
          source: "Source",
          allSources: "All",
          lexica: "Lexica",
          prompthero: "PromptHero",
          krea: "Krea",
          civitai: "Civitai",
          github: "GitHub",
          youtube: "YouTube",
          reddit: "Reddit",
          tiktok: "TikTok",
          githubConfig: "GitHub config",
          owner: "Owner",
          repo: "Repo",
          branch: "Branch",
          path: "Path",
          refreshButton: "Reload feed",
          loadMore: "Load more",
          loading: "Loading visual feed...",
          loadingMore: "Loading more references...",
          noItems: "No references were found in the active sources.",
          copyPrompt: "Copy prompt",
          copied: "Copied",
          openSource: "Open source",
          prompt: "Prompt",
          promptUnavailable: "This reference does not include a usable prompt.",
          referencePrompt: "Reference prompt",
          originalPrompt: "Source prompt",
          model: "Model",
          dimensions: "Dimensions",
          sourceStatus: "Connector status",
          sourceStatusMessage: "Message",
          requiresKey: "requires key",
          configured: "configured",
          notConfigured: "missing key",
          githubHint: "For GitHub, you can point to any public .csv, .json, .md, or .txt file with prompts.",
          feedHint: "The feed prioritizes cards with real media. If a media check fails, we still send the URL to the frontend so valid previews are not lost.",
          video: "Video",
          loadedCount: "Loaded references",
          endReached: "You reached the end of the currently available feed for this source.",
        };

  async function loadFeed(options?: {
    reset?: boolean;
    sourceOverride?: string;
    githubOverride?: { owner: string; repo: string; branch: string; path: string };
  }) {
    const reset = options?.reset ?? false;
    const activeSource = options?.sourceOverride ?? source;
    const activeGithub = options?.githubOverride ?? {
      owner: githubOwner,
      repo: githubRepo,
      branch: githubBranch,
      path: githubPath,
    };

    if (reset) {
      setLoading(true);
      setError(null);
      setItems([]);
      setHasMore(true);
      setNextOffset(0);
    } else {
      if (loading || loadingMore || !hasMore) return;
      setLoadingMore(true);
    }

    try {
      const requestedOffset = reset ? 0 : nextOffset;
      const data = await api.getPromptFeed({
        source: activeSource,
        limit: PAGE_SIZE,
        offset: requestedOffset,
        github_owner: activeGithub.owner,
        github_repo: activeGithub.repo,
        github_branch: activeGithub.branch,
        github_path: activeGithub.path,
      });

      setResult(data);
      const inferredHasMore = data.has_more || data.items.length >= PAGE_SIZE;
      setHasMore(inferredHasMore);
      setNextOffset(data.next_offset ?? (requestedOffset + data.items.length));
      setItems((current) => (reset ? data.items : mergePromptFeedItems(current, data.items)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed loading prompt feed");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialFeed() {
      try {
        const data = await api.getPromptFeedConfig();
        if (cancelled) return;

        const githubDefaults = {
          owner: data.github_defaults.owner,
          repo: data.github_defaults.repo,
          branch: data.github_defaults.branch,
          path: data.github_defaults.path,
        };

        setConfig(data);
        setGithubOwner(githubDefaults.owner);
        setGithubRepo(githubDefaults.repo);
        setGithubBranch(githubDefaults.branch);
        setGithubPath(githubDefaults.path);

        await loadFeed({
          reset: true,
          sourceOverride: "all",
          githubOverride: githubDefaults,
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed loading prompt feed");
        setLoading(false);
      }
    }

    void loadInitialFeed();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || loading || loadingMore || !hasMore || !items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        void loadFeed();
      },
      { rootMargin: "900px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, items.length, loading, loadingMore, nextOffset, source, githubOwner, githubRepo, githubBranch, githubPath]);

  useEffect(() => {
    if (loading || loadingMore || error || items.length || emptyRetryRef.current) return;
    emptyRetryRef.current = true;
    const timer = window.setTimeout(() => {
      void loadFeed({
        reset: true,
        sourceOverride: source,
        githubOverride: {
          owner: githubOwner,
          repo: githubRepo,
          branch: githubBranch,
          path: githubPath,
        },
      });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [error, githubBranch, githubOwner, githubPath, githubRepo, items.length, loading, loadingMore, source]);

  async function copyPrompt(item: PromptFeedItem) {
    const prompt = item.prompt?.trim();
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(""), 1600);
    } catch {
      setCopiedId("");
    }
  }

  const statusItems =
    result?.source_status
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
          <p className="mt-2 max-w-4xl text-sm text-slate-300">{copy.subtitle}</p>
        </div>

        <section className="glass-panel rounded-3xl border border-white/10 p-6">
          <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-4">
              <div>
                <h3 className="font-headline text-xl font-bold text-white">{copy.feedTitle}</h3>
                <p className="mt-1 text-sm text-slate-300">{copy.feedSub}</p>
              </div>

              <div className="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                {copy.feedHint}
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr,auto]">
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
                    <option value="youtube">{copy.youtube}</option>
                    <option value="reddit">{copy.reddit}</option>
                    <option value="tiktok">{copy.tiktok}</option>
                  </select>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.loadedCount}</p>
                  <p className="mt-1 text-2xl font-bold text-white">{items.length}</p>
                </div>
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
            <button
              className="btn-gradient rounded-full px-5 py-2.5 text-sm font-bold text-slate-950"
              onClick={() =>
                void loadFeed({
                  reset: true,
                  sourceOverride: source,
                  githubOverride: {
                    owner: githubOwner,
                    repo: githubRepo,
                    branch: githubBranch,
                    path: githubPath,
                  },
                })
              }
            >
              {copy.refreshButton}
            </button>
            {loading ? <span className="text-sm text-slate-300">{copy.loading}</span> : null}
            {loadingMore ? <span className="text-sm text-cyan-100">{copy.loadingMore}</span> : null}
          </div>
        </section>

        <section className="glass-panel rounded-3xl border border-white/10 p-6">
          <h3 className="font-headline text-xl font-bold text-white">{copy.sourceStatus}</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {statusItems.map((status) => (
              <span
                key={status.source}
                className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${
                  status.configured
                    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                    : "border-amber-300/25 bg-amber-400/10 text-amber-100"
                }`}
              >
                {status.source}: {status.configured ? copy.configured : copy.notConfigured}
                {status.requires_api_key ? ` / ${copy.requiresKey}` : ""}
              </span>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-xs text-slate-400">
            {statusItems.map((status) => (
              <p key={`${status.source}-msg`}>
                {status.source} - {copy.sourceStatusMessage}: {status.message}
              </p>
            ))}
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
        {!loading && !items.length ? <div className="text-sm text-slate-400">{copy.noItems}</div> : null}

        {loading && !items.length ? (
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <article
                key={`prompt-feed-skeleton-${index}`}
                className="glass-panel overflow-hidden rounded-3xl border border-white/10"
              >
                <LoadingSkeleton className="aspect-[4/3] w-full rounded-none border-x-0 border-t-0" />
                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <LoadingSkeleton className="h-6 w-24 rounded-full" />
                    <LoadingSkeleton className="h-6 w-24 rounded-full" />
                  </div>
                  <LoadingSkeleton className="h-7 w-3/4" />
                  <LoadingSkeleton className="h-32 w-full" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <LoadingSkeleton className="h-20 w-full" />
                    <LoadingSkeleton className="h-20 w-full" />
                  </div>
                  <div className="flex gap-3">
                    <LoadingSkeleton className="h-10 w-28 rounded-full" />
                    <LoadingSkeleton className="h-10 w-28 rounded-full" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {items.map((item) => {
            const promptText = item.prompt?.trim() || copy.promptUnavailable;
            const promptOrigin = readPromptOrigin(item);

            return (
              <article
                key={`${item.source}-${item.id}`}
                className="glass-panel overflow-hidden rounded-3xl border border-white/10"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-950/50">
                  <PromptFeedImage item={item} />
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${sourceTone(item.source)}`}>
                      {item.source}
                    </span>
                    {item.video_url ? (
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-100">
                        {copy.video}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                      {promptOrigin === "synthesized" ? copy.referencePrompt : copy.originalPrompt}
                    </span>
                    {item.model ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                        {item.model}
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <h4 className="font-headline text-lg font-bold text-white">{item.title}</h4>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.prompt}</p>
                    <p className="mt-2 max-h-40 overflow-auto pr-1 text-sm leading-6 text-slate-200">{promptText}</p>
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
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        item.prompt?.trim()
                          ? "border border-white/15 bg-white/5 text-slate-100 hover:border-white/30"
                          : "cursor-not-allowed border border-white/10 bg-white/5 text-slate-500"
                      }`}
                      onClick={() => void copyPrompt(item)}
                      disabled={!item.prompt?.trim()}
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
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-3 pb-10 pt-2">
          {hasMore && !loading ? (
            <button
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/30"
              onClick={() => void loadFeed()}
              disabled={loadingMore}
            >
              {loadingMore ? copy.loadingMore : copy.loadMore}
            </button>
          ) : null}
          {!hasMore && items.length ? <p className="text-sm text-slate-400">{copy.endReached}</p> : null}
          <div ref={loadMoreRef} className="h-4 w-full" />
        </div>
      </div>
    </AppShell>
  );
}
