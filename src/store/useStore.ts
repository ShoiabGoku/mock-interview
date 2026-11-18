import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect } from "react";
import type { InterviewSession, SessionConfig } from "@/lib/types";
import type { GDConfig, GDSession } from "@/lib/gd/types";

interface Settings {
  userName: string;
  /** Anthropic API key — stored only in this browser's localStorage. */
  apiKey: string;
  model: string;
  /** Prefer the AI brain when a key is present. */
  preferAI: boolean;
  voiceOutput: boolean;
  /** Turn the webcam on when entering a room. */
  cameraOn: boolean;
  /** In-person room or video-call grid. */
  roomView: "room" | "grid";
  /** Live captions under the scene. */
  captions: boolean;
}

interface StoreState {
  hydrated: boolean;
  settings: Settings;
  history: InterviewSession[];
  /** Config staged by the setup wizard, consumed by the interview room. */
  pendingConfig: SessionConfig | null;
  /** Group discussions, newest first. */
  gdHistory: GDSession[];
  pendingGD: GDConfig | null;

  setHydrated: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setPendingConfig: (c: SessionConfig | null) => void;
  addSession: (s: InterviewSession) => void;
  deleteSession: (id: string) => void;
  clearHistory: () => void;
  setPendingGD: (c: GDConfig | null) => void;
  addGDSession: (s: GDSession) => void;
  deleteGDSession: (id: string) => void;
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
        cameraOn: true,
        roomView: "room",
        captions: true,
      },
      history: [],
      pendingConfig: null,
      gdHistory: [],
      pendingGD: null,

      setHydrated: () => set({ hydrated: true }),
      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      setPendingConfig: (pendingConfig) => set({ pendingConfig }),
      addSession: (s) => set({ history: [s, ...get().history].slice(0, 100) }),
      deleteSession: (id) => set({ history: get().history.filter((h) => h.id !== id) }),
      clearHistory: () => set({ history: [], gdHistory: [] }),
      setPendingGD: (pendingGD) => set({ pendingGD }),
      addGDSession: (s) => set({ gdHistory: [s, ...get().gdHistory].slice(0, 60) }),
      deleteGDSession: (id) => set({ gdHistory: get().gdHistory.filter((h) => h.id !== id) }),
    }),
    {
      name: "mock-interview-store",
      // Settings added later get their defaults when an older saved store loads.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StoreState>;
        return { ...current, ...p, settings: { ...current.settings, ...(p.settings ?? {}) }, gdHistory: p.gdHistory ?? [] };
      },
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
