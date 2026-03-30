"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { api, wsLiveTrendsUrl } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { SourceStatusResponse, Trend } from "../../lib/types";

type LiveEvent = {
  id: string;
  event: string;
  timestamp: string;
  items: Array<Record<string, unknown>>;
  source: "snapshot" | "ws";
};

function formatMetric(value: unknown): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  if (typeof value === "string" && value.trim()) return value;
  return "N/A";
}

function formatTimestamp(value: string): string {
  if (!value) return "Live";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function buildSnapshotEvents(trends: Trend[], sourceStatus: SourceStatusResponse): LiveEvent[] {
  const now = new Date().toISOString();
  const events: LiveEvent[] = [];

  if (trends.length) {
    events.push({
      id: "snapshot-ranking",
      event: "current_trend_snapshot",
      timestamp: now,
      source: "snapshot",
      items: trends.slice(0, 5).map((trend, index) => ({
        rank: index + 1,
        title: trend.title,
        platform: trend.platform,
        category: trend.category,
        velocity_score: trend.velocity_score,
        rank_score: trend.rank_score,
      })),
    });
  }

  const statusItems = Object.values(sourceStatus)
    .filter((item) => item.updated_at || item.items_count > 0 || item.status !== "unknown")
    .map((item) => ({
      source: item.source,
      status: item.status,
      items_count: item.items_count,
      updated_at: item.updated_at || "pending",
    }));

  if (statusItems.length) {
    events.push({
      id: "snapshot-sources",
      event: "source_status_snapshot",
      timestamp: now,
      source: "snapshot",
      items: statusItems,
    });
  }

  return events;
}

export default function LiveTrendsPage() {
  const { t, language } = useI18n();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [sourceStatus, setSourceStatus] = useState<SourceStatusResponse>({});
  const [status, setStatus] = useState("connecting");
  const [lastHeartbeat, setLastHeartbeat] = useState<string>("");
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const copy =
    language === "es"
      ? {
          subtitle:
            "Esta pantalla mezcla dos cosas: un snapshot actual de las tendencias guardadas y eventos nuevos que van entrando cuando el sistema detecta cambios.",
          statusTitle: "Que estas viendo",
          statusSnapshot: "Snapshot actual",
          statusSnapshotDesc: "Es la foto mas reciente de lo que ya esta guardado en base de datos.",
          statusWs: "Feed en vivo",
          statusWsDesc: "Son eventos nuevos enviados por WebSocket cuando una tendencia cambia o aparece una nueva.",
          statusHeartbeat: "Heartbeat",
          statusHeartbeatDesc: "Solo confirma que la conexion en vivo sigue abierta.",
          liveTitle: "Estado de la conexion",
          liveStatus: "Conexion",
          lastHeartbeat: "Ultimo heartbeat",
          sources: "Fuentes",
          loading: "Cargando tendencias en vivo...",
          snapshotTitle: "Snapshot actual",
          snapshotSub: "Top tendencias guardadas en este momento. Aqui ves ranking, velocidad y plataforma.",
          noTrends: "Todavia no hay tendencias guardadas.",
          rankScore: "Rank score",
          velocity: "Velocidad",
          platform: "Plataforma",
          timestamp: "Actualizado",
          eventFeed: "Eventos en vivo",
          eventFeedSub: "Cada tarjeta explica un cambio detectado por el sistema.",
          noEvents: "Aun no llegaron eventos nuevos. El snapshot inicial ya esta cargado.",
          snapshot: "Snapshot",
          websocket: "WebSocket",
          eventMeaning: "Que significa",
          sourceStateTitle: "Estado de fuentes",
          itemsCount: "Items",
          updatedAt: "Actualizado",
          eventDescriptions: {
            current_trend_snapshot: "Resumen del ranking actual guardado en la base.",
            source_status_snapshot: "Estado actual de cada conector de ingesta.",
            new_trend_detected: "Se detecto una tendencia nueva y fue guardada.",
            velocity_score_changed: "Cambio en la velocidad de crecimiento de una tendencia.",
            trend_ranking_changed: "Se actualizo la posicion de las tendencias en el ranking.",
            live_update: "Actualizacion en vivo recibida desde el backend.",
          } as Record<string, string>,
        }
      : {
          subtitle:
            "This screen blends two things: a current snapshot of stored trends and newly arriving events whenever the system detects changes.",
          statusTitle: "What you are seeing",
          statusSnapshot: "Current snapshot",
          statusSnapshotDesc: "This is the latest picture of what is already stored in the database.",
          statusWs: "Live feed",
          statusWsDesc: "These are new WebSocket events sent when a trend changes or a new one appears.",
          statusHeartbeat: "Heartbeat",
          statusHeartbeatDesc: "This only confirms the live connection is still open.",
          liveTitle: "Connection status",
          liveStatus: "Connection",
          lastHeartbeat: "Last heartbeat",
          sources: "Sources",
          loading: "Loading live trends...",
          snapshotTitle: "Current snapshot",
          snapshotSub: "Top stored trends right now. You can read ranking, velocity, and platform here.",
          noTrends: "No stored trends yet.",
          rankScore: "Rank score",
          velocity: "Velocity",
          platform: "Platform",
          timestamp: "Updated",
          eventFeed: "Live events",
          eventFeedSub: "Each card explains a change detected by the system.",
          noEvents: "No new events yet. The initial snapshot is already loaded.",
          snapshot: "Snapshot",
          websocket: "WebSocket",
          eventMeaning: "Meaning",
          sourceStateTitle: "Source status",
          itemsCount: "Items",
          updatedAt: "Updated",
          eventDescriptions: {
            current_trend_snapshot: "Summary of the current ranking stored in the database.",
            source_status_snapshot: "Current state of each ingestion connector.",
            new_trend_detected: "A new trend was detected and stored.",
            velocity_score_changed: "A trend changed its growth speed.",
            trend_ranking_changed: "The ranking order of trends was updated.",
            live_update: "Live update received from the backend.",
          } as Record<string, string>,
        };

  const describedEvents = useMemo(
    () =>
      events.map((event) => ({
        ...event,
        description: copy.eventDescriptions[event.event] || copy.eventDescriptions.live_update,
      })),
    [events, copy.eventDescriptions]
  );

  useEffect(() => {
    let cancelled = false;

    api
      .getTrendsWithStatus("?limit=12")
      .then((data) => {
        if (cancelled) return;
        setTrends(data.items || []);
        setSourceStatus(data.source_status || {});
        setEvents(buildSnapshotEvents(data.items || [], data.source_status || {}));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed loading live trends");
      })
      .finally(() => {
        if (!cancelled) setLoadingSnapshot(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!active) return;
      setStatus((current) => (current === "connected" ? "reconnecting" : "connecting"));
      socket = new WebSocket(wsLiveTrendsUrl);

      socket.onopen = () => {
        if (!active) return;
        setStatus("connected");
      };

      socket.onerror = () => {
        if (!active) return;
        setStatus("error");
      };

      socket.onclose = () => {
        if (!active) return;
        setStatus("disconnected");
        reconnectTimer = setTimeout(connect, 3000);
      };

      socket.onmessage = (message) => {
        if (!active) return;
        const parsed = JSON.parse(message.data) as {
          event?: string;
          timestamp?: string;
          items?: Array<Record<string, unknown>>;
        };

        if (parsed.event === "heartbeat") {
          setLastHeartbeat(new Date().toISOString());
          return;
        }

        const nextEvent: LiveEvent = {
          id: `${parsed.event || "event"}-${Date.now()}`,
          event: parsed.event || "live_update",
          timestamp: parsed.timestamp || new Date().toISOString(),
          items: parsed.items || [],
          source: "ws",
        };

        setEvents((prev) => [nextEvent, ...prev].slice(0, 30));
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="font-headline text-3xl font-bold">{t("liveTrendEvents")}</h2>
            <p className="mt-2 max-w-4xl text-sm text-slate-300">{copy.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/10 px-3 py-1 text-slate-200">
              {copy.liveStatus}: {status}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1 text-slate-200">
              {copy.lastHeartbeat}: {lastHeartbeat ? formatTimestamp(lastHeartbeat) : "waiting"}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1 text-slate-200">
              {copy.sources}: {Object.keys(sourceStatus).length}
            </span>
          </div>
        </div>

        <section className="glass-panel rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h3 className="font-headline text-xl font-bold text-white">{copy.statusTitle}</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-4">
              <p className="text-sm font-semibold text-white">{copy.statusSnapshot}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{copy.statusSnapshotDesc}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-4">
              <p className="text-sm font-semibold text-white">{copy.statusWs}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{copy.statusWsDesc}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-4">
              <p className="text-sm font-semibold text-white">{copy.statusHeartbeat}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{copy.statusHeartbeatDesc}</p>
            </div>
          </div>
        </section>

        {loadingSnapshot ? <div className="text-sm text-slate-300">{copy.loading}</div> : null}
        {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
          <section className="glass-panel rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-headline text-xl font-bold text-white">{copy.snapshotTitle}</h3>
                <p className="mt-1 text-xs text-slate-400">{copy.snapshotSub}</p>
              </div>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-100">
                {copy.snapshot}
              </span>
            </div>

            {!loadingSnapshot && !trends.length ? <p className="text-sm text-slate-400">{copy.noTrends}</p> : null}

            <div className="space-y-3">
              {trends.map((trend, index) => (
                <article key={trend.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        <span>#{index + 1}</span>
                        <span>{trend.platform}</span>
                        <span>{trend.category}</span>
                      </div>
                      <h4 className="text-base font-semibold text-white">{trend.title}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.rankScore}</p>
                      <p className="text-lg font-bold text-cyan-200">{formatMetric(trend.rank_score)}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.velocity}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{formatMetric(trend.velocity_score)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.platform}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{trend.platform}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.timestamp}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{formatTimestamp(trend.timestamp)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="glass-panel rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-headline text-xl font-bold text-white">{copy.eventFeed}</h3>
                <p className="mt-1 text-xs text-slate-400">{copy.eventFeedSub}</p>
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-100">
                {copy.websocket}
              </span>
            </div>

            {!describedEvents.length ? <p className="text-sm text-slate-400">{copy.noEvents}</p> : null}

            <div className="space-y-3">
              {describedEvents.map((event) => (
                <article key={event.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{event.event.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatTimestamp(event.timestamp)}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${
                        event.source === "ws"
                          ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                          : "border border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      {event.source}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.eventMeaning}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{event.description}</p>
                  </div>

                  <div className="mt-4 space-y-2">
                    {event.items.length ? (
                      event.items.map((item, index) => (
                        <div key={`${event.id}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {Object.entries(item).map(([key, value]) => (
                              <div key={key}>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{key.replaceAll("_", " ")}</p>
                                <p className="mt-1 break-words text-sm text-slate-100">{formatMetric(value)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">{copy.noEvents}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="glass-panel rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h3 className="font-headline text-xl font-bold text-white">{copy.sourceStateTitle}</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Object.values(sourceStatus).map((item) => (
              <article key={item.source} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{item.source}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] ${
                      item.status === "real"
                        ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                        : item.status === "unavailable"
                          ? "border border-red-300/20 bg-red-400/10 text-red-100"
                          : "border border-amber-300/20 bg-amber-400/10 text-amber-100"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.message}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.itemsCount}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{item.items_count}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{copy.updatedAt}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{item.updated_at ? formatTimestamp(item.updated_at) : "N/A"}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
