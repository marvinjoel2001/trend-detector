"use client";

import { useEffect, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { wsLiveTrendsUrl } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

type LiveEvent = {
  event: string;
  timestamp?: string;
  items?: Array<Record<string, unknown>>;
};

export default function LiveTrendsPage() {
  const { t } = useI18n();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    const ws = new WebSocket(wsLiveTrendsUrl);
    ws.onopen = () => setStatus("connected");
    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus("disconnected");
    ws.onmessage = (message) => {
      const parsed = JSON.parse(message.data) as LiveEvent;
      setEvents((prev) => [parsed, ...prev].slice(0, 50));
    };
    return () => ws.close();
  }, []);

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-headline text-2xl font-bold">{t("liveTrendEvents")}</h2>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">WS: {status}</span>
      </div>
      {!events.length ? <div className="text-sm text-slate-400">{t("waitingLiveUpdates")}</div> : null}
      <div className="space-y-3">
        {events.map((event, index) => (
          <article key={`${event.event}-${index}`} className="glass-panel rounded-2xl border border-white/10 p-4">
            <p className="text-sm font-semibold text-indigo-300">{event.event}</p>
            <p className="mt-1 text-xs text-slate-400">{event.timestamp || "live"}</p>
            <pre className="mt-2 overflow-x-auto text-xs text-slate-200">{JSON.stringify(event.items || [], null, 2)}</pre>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
