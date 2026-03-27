import { Trend } from "./types";

type TrendMedia = {
  imageUrl: string | null;
  videoUrl: string | null;
  embedUrl: string | null;
  sourceUrl: string | null;
};

function readString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isHttpUrl(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith("http://") || value.startsWith("https://") ? value : null;
}

export function getTrendMedia(trend: Pick<Trend, "platform" | "metadata">): TrendMedia {
  const metadata = trend.metadata || {};
  const videoId = readString(metadata, "video_id");
  const imageUrl =
    isHttpUrl(readString(metadata, "thumbnail_url")) ||
    isHttpUrl(readString(metadata, "image_url")) ||
    isHttpUrl(readString(metadata, "preview_image_url")) ||
    (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);
  const videoUrl = isHttpUrl(readString(metadata, "video_url"));
  const sourceUrl =
    isHttpUrl(readString(metadata, "source_url")) ||
    (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : null;

  return {
    imageUrl,
    videoUrl,
    embedUrl,
    sourceUrl,
  };
}
