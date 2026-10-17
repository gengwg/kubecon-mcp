import { describe, expect, it } from "vitest";
import fixture from "./fixture.json";
import { type Feed, formatDetail, formatLine, listFilters, normalize, search } from "../src/schedule";

const sessions = normalize(fixture as Feed);
const ids = (f: Parameters<typeof search>[1]) => search(sessions, f).map((s) => s.id);

const GKE = "1247612"; // Wed 11:50, Anthropic, Grand Ballroom H
const SCHEDULER = "1228453"; // Thu 13:50, Anthropic
const EBPF = "1244576"; // Wed 15:10, room 151
const TRACING = "1239823"; // Tue 14:50, Observability
const BREAK = "1352094";

describe("normalize", () => {
  it("joins room, track, level and speakers", () => {
    const s = sessions.find((s) => s.id === GKE)!;
    expect(s.start).toBe("2026-11-11T11:50");
    expect(s.room).toContain("Grand Ballroom H");
    expect(s.track).toBe("Operations + Performance");
    expect(s.level).toBe("Advanced");
    expect(s.speakers.map((sp) => sp.tagLine).join()).toContain("Anthropic");
  });

  it("sorts by start time", () => {
    const starts = sessions.map((s) => s.start);
    expect(starts).toEqual([...starts].sort());
  });
});

describe("search", () => {
  it("matches speaker by company", () => {
    expect(ids({ speaker: "anthropic" }).sort()).toEqual([SCHEDULER, GKE].sort());
  });

  it("requires every query term", () => {
    expect(ids({ query: "gpu ebpf" })).toEqual([EBPF]);
    expect(ids({ query: "gpu tracing" })).toEqual([]);
  });

  it("filters by weekday or date", () => {
    expect(ids({ day: "Wednesday" })).toEqual([GKE, EBPF]);
    expect(ids({ day: "2026-11-11" })).toEqual([GKE, EBPF]);
  });

  it("filters by time window on start time", () => {
    expect(ids({ day: "wed", after: "12:00" })).toEqual([EBPF]);
    expect(ids({ day: "wed", before: "15:10" })).toEqual([GKE]);
    expect(ids({ day: "wed", after: "15:10" })).toEqual([EBPF]);
  });

  it("filters by room and track", () => {
    expect(ids({ room: "grand ballroom h" })).toEqual([GKE]);
    expect(ids({ track: "observability" })).toEqual([TRACING]);
  });

  it("hides breaks unless asked", () => {
    expect(ids({})).not.toContain(BREAK);
    expect(ids({ query: "break" })).toContain(BREAK);
  });
});

describe("output", () => {
  it("formats a compact line and a detail view", () => {
    const s = sessions.find((s) => s.id === GKE)!;
    expect(formatLine(s)).toMatch(/^\[1247612\] Wed 11-11 11:50-12:20 \| .*Grand Ballroom H \| /);
    expect(formatDetail(s)).toContain("When: Wed 11-11 11:50-12:20 (Salt Lake City time)");
  });

  it("lists days with weekday names", () => {
    const { days } = listFilters(sessions);
    expect(days).toContain("2026-11-10 (tue)");
    expect(days).toEqual([...days].sort());
  });
});
