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

