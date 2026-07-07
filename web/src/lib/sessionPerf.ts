/** User Timing marks for session-switch hydration (dev, benches, Playwright). */

const MARK_PREFIX = "omnigent:";

export const SessionPerfMark = {
  switchStart: `${MARK_PREFIX}switch:start`,
  historyHydrated: `${MARK_PREFIX}history:hydrated`,
  snapshotHydrated: `${MARK_PREFIX}snapshot:hydrated`,
  chatPainted: `${MARK_PREFIX}chat:painted`,
} as const;

export interface SessionPerfSnapshot {
  sessionId: string | null;
  historyHydratedMs: number | null;
  snapshotHydratedMs: number | null;
  chatPaintedMs: number | null;
}

declare global {
  interface Window {
    __OMNIGENT_SESSION_PERF__?: SessionPerfSnapshot;
  }
}

function relativeMs(markName: string, origin: number): number | null {
  if (typeof performance === "undefined" || origin <= 0) return null;
  const entry = performance.getEntriesByName(markName).at(-1);
  return entry ? entry.startTime - origin : null;
}

export function publishSessionPerf(sessionId: string | null): void {
  if (typeof window === "undefined" || typeof performance === "undefined") return;
  const origin = performance.getEntriesByName(SessionPerfMark.switchStart).at(-1)?.startTime ?? 0;
  window.__OMNIGENT_SESSION_PERF__ = {
    sessionId,
    historyHydratedMs: relativeMs(SessionPerfMark.historyHydrated, origin),
    snapshotHydratedMs: relativeMs(SessionPerfMark.snapshotHydrated, origin),
    chatPaintedMs: relativeMs(SessionPerfMark.chatPainted, origin),
  };
}

/** Reset marks at the start of a sidebar / route session switch. */
export function beginSessionSwitch(sessionId: string): void {
  if (typeof performance === "undefined") return;
  performance.clearMarks(MARK_PREFIX);
  performance.clearMeasures(MARK_PREFIX);
  performance.mark(SessionPerfMark.switchStart, { detail: { sessionId } });
  publishSessionPerf(sessionId);
}

export function markHistoryHydrated(sessionId: string, blockCount: number): void {
  if (typeof performance === "undefined") return;
  performance.mark(SessionPerfMark.historyHydrated, { detail: { sessionId, blockCount } });
  publishSessionPerf(sessionId);
  if (typeof requestAnimationFrame === "undefined") return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      performance.mark(SessionPerfMark.chatPainted, { detail: { sessionId } });
      publishSessionPerf(sessionId);
    });
  });
}

export function markSnapshotHydrated(sessionId: string): void {
  if (typeof performance === "undefined") return;
  performance.mark(SessionPerfMark.snapshotHydrated, { detail: { sessionId } });
  publishSessionPerf(sessionId);
}

/** Read the latest perf snapshot (Playwright / benches). */
export function readSessionPerf(): SessionPerfSnapshot {
  if (typeof window !== "undefined" && window.__OMNIGENT_SESSION_PERF__) {
    return window.__OMNIGENT_SESSION_PERF__;
  }
  const origin = performance.getEntriesByName(SessionPerfMark.switchStart).at(-1)?.startTime ?? 0;
  const startDetail = performance.getEntriesByName(SessionPerfMark.switchStart).at(-1) as
    | (PerformanceEntry & { detail?: { sessionId?: string } })
    | undefined;
  return {
    sessionId: startDetail?.detail?.sessionId ?? null,
    historyHydratedMs: relativeMs(SessionPerfMark.historyHydrated, origin),
    snapshotHydratedMs: relativeMs(SessionPerfMark.snapshotHydrated, origin),
    chatPaintedMs: relativeMs(SessionPerfMark.chatPainted, origin),
  };
}
