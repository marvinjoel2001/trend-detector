import {
  ForecastResponse,
  PromptHistoryItem,
  PromptResult,
  SourceResultsResponse,
  SourceStatusResponse,
  Trend,
  TrendDetailResponse,
  TrendsWithStatusResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

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
  getYoutubeResults: () => apiFetch<SourceResultsResponse>("/youtube_results"),
  getTiktokResults: () => apiFetch<SourceResultsResponse>("/tiktok_results"),
  getRedditResults: () => apiFetch<SourceResultsResponse>("/reddit_results"),
  getGoogleResults: () => apiFetch<SourceResultsResponse>("/google_trends_results"),
  generatePrompt: (payload: {
    trend_id: string;
    platform_target: string;
    output_type: string;
    user_niche?: string;
  }) =>
    apiFetch<PromptResult>("/prompt/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getPromptHistory: () => apiFetch<PromptHistoryItem[]>("/prompt/history"),
  submitFeedback: (payload: { prompt_id: string; rating: number; notes?: string }) =>
    apiFetch<{ id: string }>("/prompt/feedback", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export const wsLiveTrendsUrl = (
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/live-trends"
);

