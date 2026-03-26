"use client";

import { useEffect, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { PromptHistoryItem } from "../../lib/types";

export default function HistoryPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<PromptHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPromptHistory()
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <h2 className="mb-6 font-headline text-2xl font-bold">{t("promptHistory")}</h2>
      {loading ? <div className="text-sm text-slate-300">{t("loadingHistory")}</div> : null}
      {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
      {!loading && !items.length ? <div className="text-sm text-slate-400">{t("noPromptHistory")}</div> : null}
      <div className="space-y-4">
        {items.map((item) => (
          <article key={item.id} className="glass-panel rounded-2xl border border-white/10 p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>{item.platform_target} / {item.output_type}</span>
              <span>{new Date(item.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm">{item.prompt_text}</p>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
