export type Trend = {
  id: string;
  title: string;
  platform: string;
  category: string;
  velocity_score: number;
  rank_score: number;
  timestamp: string;
  metadata: Record<string, unknown>;
};

export type SourceStatusItem = {
  source: string;
  status: string;
  message: string;
  items_count: number;
  used_cache: boolean;
  used_fallback: boolean;
  updated_at: string | null;
};

export type SourceStatusResponse = Record<string, SourceStatusItem>;

export type TrendsWithStatusResponse = {
  items: Trend[];
  source_status: SourceStatusResponse;
};

export type TrendDetailResponse = {
  trend: Trend & { description?: string | null };
  snapshots: Array<{
    snapshot_ts: string;
    metric_views: number;
    velocity_score: number;
  }>;
};

export type SourceResultsResponse = Trend[];

export type ForecastResponse = {
  trend_id: string;
  generated_at: string;
  horizon_hours: number;
  confidence: number;
  points: Array<{ ts: string; momentum: number }>;
};

export type ForecastExplanation = {
  title: string;
  summary: string;
  outlook: string;
  could_go_viral: boolean;
  virality_window_hours?: number | null;
  virality_window_days?: number | null;
  based_on: string[];
  methodology: string;
  generated_with: string;
};

export type PromptResult = {
  prompt_id: string;
  prompt_text: string;
  platform_target: string;
  output_type: string;
  payload: {
    description: string;
    visual_style: string;
    tone: string;
    format: string;
    hashtags: string[];
    recommended_duration: string;
    publish_time: string;
  };
  created_at: string;
};

export type PromptGeneratorConfig = {
  provider: "system" | "gemini";
  api_key?: string;
  model?: string;
};

export type PromptEngineStatus = {
  provider: "gemini";
  default_model: string;
  api_key_configured: boolean;
};

export type PromptFeedItem = {
  source: string;
  id: string;
  title: string;
  prompt: string;
  image_url?: string | null;
  thumbnail_url?: string | null;
  video_url?: string | null;
  source_url?: string | null;
  model?: string | null;
  width?: number | null;
  height?: number | null;
  metadata: Record<string, unknown>;
};

export type PromptFeedSourceStatus = {
  source: string;
  configured: boolean;
  enabled: boolean;
  items_count: number;
  message: string;
  requires_api_key: boolean;
  repo?: {
    owner: string;
    repo: string;
    branch: string;
    path: string;
  };
};

export type PromptFeedResponse = {
  query: string;
  source: string;
  offset: number;
  limit: number;
  has_more: boolean;
  next_offset: number | null;
  github: {
    owner: string;
    repo: string;
    branch: string;
    path: string;
  };
  items: PromptFeedItem[];
  source_status: Record<string, PromptFeedSourceStatus>;
};

export type PromptFeedConfig = {
  default_query: string;
  github_defaults: {
    owner: string;
    repo: string;
    branch: string;
    path: string;
  };
  sources: Array<{
    source: string;
    configured: boolean;
    enabled: boolean;
    requires_api_key: boolean;
    base_url: string;
    note: string;
  }>;
};

export type PromptHistoryItem = {
  id: string;
  trend_id: string;
  prompt_text: string;
  platform_target: string;
  output_type: string;
  user_niche?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type MediaPromptResult = {
  prompt_text: string;
  generated_with: string;
  payload: {
    summary: string;
    hook: string;
    subject: string;
    motion: string;
    camera: string;
    visual_style: string;
    aspect_ratio: string;
    hashtags: string[];
    scene_beats: string[];
    clone_notes: string[];
    safety_notes: string[];
  };
  analyzed_inputs: Array<{
    source_type: string;
    name: string;
    mime_type?: string | null;
    origin: string;
    size_bytes?: number | null;
    source_url?: string | null;
  }>;
};
