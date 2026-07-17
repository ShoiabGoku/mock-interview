import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect } from "react";
import type { InterviewSession, SessionConfig } from "@/lib/types";

interface Settings {
  userName: string;
  /** Anthropic API key — stored only in this browser's localStorage. */
  apiKey: string;
  model: string;
  /** Prefer the AI brain when a key is present. */
  preferAI: boolean;
  voiceOutput: boolean;
}

interface StoreState {
  hydrated: boolean;
  settings: Settings;
  history: InterviewSession[];
  /** Config staged by the setup wizard, consumed by the interview room. */
  pendingConfig: SessionConfig | null;

  setHydrated: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setPendingConfig: (c: SessionConfig | null) => void;
  addSession: (s: InterviewSession) => void;
  deleteSession: (id: string) => void;
  clearHistory: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      settings: {
        userName: "Shoiab",
        apiKey: "",
        model: "claude-opus-4-8",
        preferAI: true,
        voiceOutput: true,
      },
      history: [],
      pendingConfig: null,

      setHydrated: () => set({ hydrated: true }),
      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      setPendingConfig: (pendingConfig) => set({ pendingConfig }),
      addSession: (s) => set({ history: [s, ...get().history].slice(0, 100) }),
      deleteSession: (id) => set({ history: get().history.filter((h) => h.id !== id) }),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "mock-interview-store",
      onRehydrateStorage: () => (state) => state?.setHydrated(),
      partialize: (s) => {
        const { hydrated: _h, ...rest } = s;
        return rest as StoreState;
      },
    }
  )
);

/** Gate client-only UI on hydration; unblock after mount as a safety net. */
export function useHydrated(): boolean {
  const hydrated = useStore((s) => s.hydrated);
  useEffect(() => {
    if (!useStore.getState().hydrated) useStore.getState().setHydrated();
  }, []);
  return hydrated;
}
