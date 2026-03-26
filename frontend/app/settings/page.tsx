"use client";

import { AppShell } from "../../components/app-shell";
import { useI18n } from "../../lib/i18n";

export default function SettingsPage() {
  const { t } = useI18n();
  return (
    <AppShell>
      <h2 className="mb-6 font-headline text-2xl font-bold">{t("settings")}</h2>
      <div className="glass-panel rounded-2xl border border-white/10 p-6 text-sm text-slate-300">
        {t("settingsDesc")}
      </div>
    </AppShell>
  );
}
