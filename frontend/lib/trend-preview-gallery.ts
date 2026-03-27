import { getTrendMedia } from "./trend-media";
import { Trend } from "./types";

export type TrendPreviewGalleryItem = {
  id: string;
  title: string;
  platform: string;
  imageUrl: string | null;
  videoUrl: string | null;
  embedUrl: string | null;
  sourceUrl: string | null;
  score: number;
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9#\s]/g, " ").replace(/\s+/g, " ").trim();
}

function toTokens(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  );
}

function readHashtag(trend: Trend): string {
  const raw = trend.metadata?.hashtag;
  if (typeof raw !== "string") return "";
  return normalize(raw);
}

function readViews(trend: Trend): number {
  const raw = trend.metadata?.views;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function buildTrendPreviewGallery(trend: Trend, sourceItems: Trend[], maxItems = 12): TrendPreviewGalleryItem[] {
  const trendTokens = toTokens(trend.title);
  const trendHashtag = readHashtag(trend);

  const scored = sourceItems
    .filter((item) => item.id !== trend.id)
    .map((item) => {
      const media = getTrendMedia(item);
      if (!media.imageUrl && !media.videoUrl && !media.embedUrl && !media.sourceUrl) return null;

      const itemTokens = toTokens(item.title);
      const shared = [...trendTokens].filter((token) => itemTokens.has(token)).length;
      const itemHashtag = readHashtag(item);
      const score =
        (item.platform === trend.platform ? 1 : 0) +
        (trendHashtag && itemHashtag && trendHashtag === itemHashtag ? 5 : 0) +
        (normalize(item.title).includes(normalize(trend.title)) || normalize(trend.title).includes(normalize(item.title)) ? 3 : 0) +
        shared * 2;

      return {
        id: item.id,
        title: item.title,
        platform: item.platform,
        imageUrl: media.imageUrl,
        videoUrl: media.videoUrl,
        embedUrl: media.embedUrl,
        sourceUrl: media.sourceUrl,
        score,
        views: readViews(item),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const sorted = scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.views - a.views;
  });

  const withSignal = sorted.filter((item) => item.score > 0).slice(0, maxItems);
  if (withSignal.length > 0) {
    return withSignal.map((item) => ({
      id: item.id,
      title: item.title,
      platform: item.platform,
      imageUrl: item.imageUrl,
      videoUrl: item.videoUrl,
      embedUrl: item.embedUrl,
      sourceUrl: item.sourceUrl,
      score: item.score,
    }));
  }

  return sorted.slice(0, maxItems).map((item) => ({
    id: item.id,
    title: item.title,
    platform: item.platform,
    imageUrl: item.imageUrl,
    videoUrl: item.videoUrl,
    embedUrl: item.embedUrl,
    sourceUrl: item.sourceUrl,
    score: item.score,
  }));
}
