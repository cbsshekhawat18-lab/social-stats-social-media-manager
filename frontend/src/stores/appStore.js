/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 *
 * Holds *client* state that's shared across features and persists across
 * navigations. Server state (posts, leads, conversations) belongs in React
 * Query — this store is for stuff React Query can't model:
 *
 *   - currentClientId / currentClient — the active workspace. Persisted to
 *     localStorage so a refresh on /admin/posts doesn't reset the switcher.
 *   - badgeCounts — sidebar unread/pending counts. Updated by:
 *       a) the periodic /api/dashboard/counts/ poller (`setBadgeCounts`)
 *       b) WebSocket events (`bumpBadge` / `clearBadge`)
 *
 * Selectors (`useCurrentClientId`, `useBadgeCount`) live next to the store so
 * components can subscribe without re-rendering on unrelated state changes.
 */

const initial = {
  // ── Active workspace ────────────────────────────────────────────────
  currentClientId: null,
  currentClient:   null,   // {id, name, company, ...} — denormalised for the switcher

  // ── Badge counts (mirror /api/dashboard/counts/ shape) ──────────────
  badgeCounts: {
    unread_inbox:         0,
    priority_inbox:       0,
    pending_approvals:    0,
    new_leads:            0,
    unread_notifications: 0,
    scheduled_posts:      0,
  },
  badgeCountsFetchedAt: 0,  // unix ms — used by the poller for staleness checks
};

export const useAppStore = create(
  persist(
    (set, get) => ({
      ...initial,

      // ── Active client ─────────────────────────────────────────────
      setCurrentClient: (client) => set({
        currentClientId: client?.id ?? null,
        currentClient:   client ?? null,
      }),
      clearCurrentClient: () => set({ currentClientId: null, currentClient: null }),

      // ── Badges ────────────────────────────────────────────────────
      setBadgeCounts: (counts) => set({
        badgeCounts: { ...get().badgeCounts, ...counts },
        badgeCountsFetchedAt: Date.now(),
      }),

      // Bump a single counter — used by WS handlers when a new message
      // arrives between polls. Optimistic; the next poll reconciles.
      bumpBadge: (key, delta = 1) => set((state) => ({
        badgeCounts: {
          ...state.badgeCounts,
          [key]: Math.max(0, (state.badgeCounts[key] || 0) + delta),
        },
      })),

      // Reset a single counter to 0 — called when the user enters the
      // relevant feature page (e.g. opens /inbox).
      clearBadge: (key) => set((state) => ({
        badgeCounts: { ...state.badgeCounts, [key]: 0 },
      })),

      // ── Reset (used on logout) ────────────────────────────────────
      reset: () => set(initial),
    }),
    {
      name: 'socialstats.app-state',
      storage: createJSONStorage(() => localStorage),
      // Only persist the active-client choice — badge counts are ephemeral
      // and re-fetched on app boot.
      partialize: (state) => ({
        currentClientId: state.currentClientId,
        currentClient:   state.currentClient,
      }),
    },
  ),
);


// ── Selectors — subscribe to a single slice without rerendering on others ──

export const useCurrentClientId = () =>
  useAppStore((s) => s.currentClientId);

export const useCurrentClient = () =>
  useAppStore((s) => s.currentClient);

/** Badge count for a single key. Returns 0 when the key isn't tracked yet. */
export const useBadgeCount = (key) =>
  useAppStore((s) => s.badgeCounts[key] || 0);

/** Whole badge counts object — for the periodic refresher hook. */
export const useBadgeCounts = () =>
  useAppStore((s) => s.badgeCounts);
