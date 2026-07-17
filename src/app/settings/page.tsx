"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore, useHydrated } from "@/store/useStore";

const MODELS = [
  { id: "claude-opus-4-8", name: "Claude Opus 4.8 (most capable)" },
  { id: "claude-sonnet-5", name: "Claude Sonnet 5 (faster, cheaper)" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5 (fastest)" },
];

export default function SettingsPage() {
  const hydrated = useHydrated();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const clearHistory = useStore((s) => s.clearHistory);
  const historyLen = useStore((s) => s.history.length);
  const [show, setShow] = useState(false);

  if (!hydrated) return <div className="p-10 text-center text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>
      <p className="mt-1 text-sm text-muted">Everything is stored only in this browser.</p>

      <Card className="mt-6">
        <CardTitle>Profile</CardTitle>
        <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-muted">Display name</label>
        <input value={settings.userName} onChange={(e) => update({ userName: e.target.value })}
          className="glass mt-1 w-full max-w-xs rounded-xl px-3 py-2 text-sm outline-none" />
      </Card>

      <Card className="mt-4">
        <CardTitle className="flex items-center gap-1.5"><KeyRound size={14} /> Claude API key</CardTitle>
        <p className="mt-2 text-sm text-muted">
          Paste an Anthropic API key to unlock the fully adaptive AI panel. It is stored only in this browser&apos;s
          localStorage and sent directly to Anthropic — never to any server of mine.
        </p>
        <div className="glass mt-3 flex items-center gap-2 rounded-xl px-3">
          <input
            type={show ? "text" : "password"}
            value={settings.apiKey}
            onChange={(e) => update({ apiKey: e.target.value.trim() })}
            placeholder="sk-ant-…"
            className="w-full bg-transparent py-2.5 text-sm outline-none"
          />
          <button onClick={() => setShow((s) => !s)} className="text-muted hover:text-foreground" aria-label="Toggle visibility">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {settings.apiKey ? <Badge tone="success">AI panel enabled</Badge> : <Badge tone="warning">Offline mode</Badge>}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
            Get a key ↗
          </a>
        </div>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-muted">Model</label>
        <select value={settings.model} onChange={(e) => update({ model: e.target.value })}
          className="glass mt-1 w-full max-w-sm rounded-xl px-3 py-2 text-sm outline-none">
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <div className="mt-4 flex flex-wrap gap-4">
          <Toggle label="Prefer AI panel when key present" checked={settings.preferAI} onChange={(v) => update({ preferAI: v })} />
          <Toggle label="Speak interviewer lines aloud" checked={settings.voiceOutput} onChange={(v) => update({ voiceOutput: v })} />
        </div>
      </Card>

      <Card className="mt-4">
        <CardTitle className="flex items-center gap-1.5"><ShieldCheck size={14} /> Privacy</CardTitle>
        <p className="mt-2 text-sm text-muted">
          This app is a static site with no backend. Your resume, answers, transcripts, scores and API key live only on
          your device. Clearing browser data erases everything.
        </p>
      </Card>

      <Card className="mt-4">
        <CardTitle>Data</CardTitle>
        <p className="mt-2 text-sm text-muted">{historyLen} saved interview{historyLen === 1 ? "" : "s"}.</p>
        <Button variant="danger" size="sm" className="mt-3" onClick={() => {
          if (confirm("Delete all saved interviews? This cannot be undone.")) clearHistory();
        }}>
          <Trash2 size={14} /> Clear interview history
        </Button>
      </Card>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2 text-sm">
      <span className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-primary" : "bg-primary-soft"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}
