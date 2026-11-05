import { create } from "zustand";

export const TABS = ["overview", "plan", "spending", "goals", "trends"] as const;
export type Tab = (typeof TABS)[number];

export const isTab = (v: string): v is Tab => (TABS as readonly string[]).includes(v);

/** Which tab is open. Kept in the URL hash (#plan) so refresh and back work. */
export const useNav = create<{ tab: Tab; setTab: (tab: Tab) => void }>((set) => ({
  tab: "overview",
  setTab: (tab) => set({ tab }),
}));
