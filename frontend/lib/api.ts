import {
  ForecastExplanation,
  ForecastResponse,
  PromptFeedConfig,
  PromptFeedResponse,
  PromptEngineStatus,
  PromptGeneratorConfig,
  PromptHistoryItem,
  PromptResult,
  SourceResultsResponse,
  SourceStatusResponse,
  Trend,
  TrendDetailResponse,
  TrendsWithStatusResponse,
} from "./types";

function sanitizeEnvUrl(value: string | undefined, protocol: "http" | "ws"): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^[`'"]+|[`'"]+$/g, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    return trimmed;
  }
  return `${protocol}s://${trimmed}`;
}

function resolveApiBase(): string {
  const envApi = sanitizeEnvUrl(process.env.NEXT_PUBLIC_API_URL, "http");
  if (envApi) return envApi;
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.endsWith(".up.railway.app")) {
      return "https://trend-detector-backend-production.up.railway.app/api";
    }
  }
  return "http://localhost:8000/api";
}

function resolveWsLiveTrendsUrl(): string {
  const envWs = sanitizeEnvUrl(process.env.NEXT_PUBLIC_WS_URL, "ws");
  if (envWs) return envWs;
  const apiBase = resolveApiBase();
  const wsBase = apiBase.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  if (wsBase.endsWith("/api")) {
    return `${wsBase.slice(0, -4)}/ws/live-trends`;
  }
  return `${wsBase}/ws/live-trends`;
}

const API_BASE = resolveApiBase();

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export const api = {
  getTrends: (query = "") => apiFetch<Trend[]>(`/trends${query}`),
  getTrendsWithStatus: (query = "") =>
    apiFetch<TrendsWithStatusResponse>(`/trends${query ? `${query}&` : "?"}include_source_status=true`),
  getSourcesStatus: () => apiFetch<SourceStatusResponse>("/sources/status"),
  getTrend: (id: string) => apiFetch<TrendDetailResponse>(`/trends/${id}`),
  getForecast: (id: string) => apiFetch<ForecastResponse>(`/trends/forecast/${id}`),
  explainForecast: (payload: { trend_id: string; language?: string; generator_config?: PromptGeneratorConfig }) =>
    apiFetch<ForecastExplanation>("/trends/forecast/explain", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getYoutubeResults: () => apiFetch<SourceResultsResponse>("/youtube_results"),
  getTiktokResults: () => apiFetch<SourceResultsResponse>("/tiktok_results"),
  getRedditResults: () => apiFetch<SourceResultsResponse>("/reddit_results"),
  getGoogleResults: () => apiFetch<SourceResultsResponse>("/google_trends_results"),
  getPromptFeed: (query: {
    query?: string;
    source?: string;
    limit?: number;
    offset?: number;
    github_owner?: string;
    github_repo?: string;
    github_branch?: string;
    github_path?: string;
  }) =>
    apiFetch<PromptFeedResponse>(
      `/prompt-feed?${new URLSearchParams(
        Object.entries(query).reduce<Record<string, string>>((acc, [key, value]) => {
          if (value !== undefined && value !== null && `${value}`.trim()) {
            acc[key] = `${value}`;
          }
          return acc;
        }, {})
      ).toString()}`
    ),
  getPromptFeedConfig: () => apiFetch<PromptFeedConfig>("/prompt-feed/config"),
  generatePrompt: (payload: {
    trend_id: string;
    platform_target: string;
    output_type: string;
    user_niche?: string;
    generator_config?: PromptGeneratorConfig;
  }) =>
    apiFetch<PromptResult>("/prompt/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getPromptEngineConfig: () => apiFetch<PromptEngineStatus>("/prompt/config"),
  getPromptHistory: () => apiFetch<PromptHistoryItem[]>("/prompt/history"),
  submitFeedback: (payload: { prompt_id: string; rating: number; notes?: string }) =>
    apiFetch<{ id: string }>("/prompt/feedback", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export const wsLiveTrendsUrl = resolveWsLiveTrendsUrl();
