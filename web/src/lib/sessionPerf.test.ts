import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  SessionPerfMark,
  beginSessionSwitch,
  markHistoryHydrated,
  markSnapshotHydrated,
  readSessionPerf,
} from "./sessionPerf";

type PerfMark = { name: string; startTime: number; detail?: unknown };

function createPerfStub() {
  const marks: PerfMark[] = [];
  return {
    marks,
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    mark(name: string, opts?: { detail?: unknown }) {
      marks.push({ name, startTime: marks.length * 10 + 1, detail: opts?.detail });
    },
    getEntriesByName(name: string) {
      return marks.filter((m) => m.name === name);
    },
  };
}

describe("sessionPerf", () => {
  beforeEach(() => {
    vi.stubGlobal("performance", createPerfStub());
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    window.__OMNIGENT_SESSION_PERF__ = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("publishes relative hydration milestones", () => {
    beginSessionSwitch("conv_a");
    markHistoryHydrated("conv_a", 3);
    markSnapshotHydrated("conv_a");

    const snap = readSessionPerf();
    expect(snap.sessionId).toBe("conv_a");
    expect(snap.historyHydratedMs).toBeGreaterThan(0);
    expect(snap.snapshotHydratedMs).toBeGreaterThan(snap.historyHydratedMs!);
    expect(snap.chatPaintedMs).not.toBeNull();
    expect(performance.getEntriesByName(SessionPerfMark.switchStart)).toHaveLength(1);
  });
});
