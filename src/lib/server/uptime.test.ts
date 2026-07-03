import { describe, expect, it } from "vitest";
import { dailyUptime, type Transition } from "./uptime";

const DAY = 86_400;
// Fixed "now": 2026-07-03T12:00:00Z
const NOW = Math.floor(Date.UTC(2026, 6, 3, 12, 0, 0) / 1000);

describe("dailyUptime", () => {
  it("returns null for every day when there are no transitions", () => {
    const days = dailyUptime([], 90, NOW);
    expect(days).toHaveLength(90);
    expect(days.every((d) => d.uptime === null)).toBe(true);
  });

  it("does not fabricate green history before the first transition", () => {
    const firstReport = NOW - 2 * DAY;
    const days = dailyUptime([{ ts: firstReport, up: 1 }], 90, NOW);
    const known = days.filter((d) => d.uptime !== null);
    expect(known.length).toBeLessThanOrEqual(3);
    expect(days[0].uptime).toBeNull();
  });

  it("reports full uptime for a component that has been up the whole window", () => {
    const days = dailyUptime([{ ts: NOW - 100 * DAY, up: 1 }], 90, NOW);
    expect(days.every((d) => d.uptime === 1)).toBe(true);
  });

  it("attributes a mid-day outage to the correct day and fraction", () => {
    const dayStart = Math.floor(NOW / DAY) * DAY - 5 * DAY;
    const transitions: Transition[] = [
      { ts: NOW - 100 * DAY, up: 1 },
      { ts: dayStart + 6 * 3600, up: 0 },
      { ts: dayStart + 12 * 3600, up: 1 },
    ];
    const days = dailyUptime(transitions, 90, NOW);
    const target = days.find(
      (d) => d.day === new Date(dayStart * 1000).toISOString().slice(0, 10),
    );
    expect(target).toBeDefined();
    expect(target!.uptime).toBeCloseTo(0.75, 5);
    const after = days[days.indexOf(target!) + 1];
    expect(after.uptime).toBe(1);
  });

  it("handles multiple transitions inside one day", () => {
    const dayStart = Math.floor(NOW / DAY) * DAY - 5 * DAY;
    const transitions: Transition[] = [
      { ts: dayStart, up: 1 },
      { ts: dayStart + 3600, up: 0 },
      { ts: dayStart + 2 * 3600, up: 1 },
      { ts: dayStart + 3 * 3600, up: 0 },
      { ts: dayStart + 4 * 3600, up: 1 },
    ];
    const days = dailyUptime(transitions, 90, NOW);
    const target = days.find(
      (d) => d.day === new Date(dayStart * 1000).toISOString().slice(0, 10),
    );
    expect(target!.uptime).toBeCloseTo(22 / 24, 5);
  });

  it("treats an ongoing outage as down through now", () => {
    const days = dailyUptime(
      [
        { ts: NOW - 10 * DAY, up: 1 },
        { ts: NOW - 3600, up: 0 },
      ],
      90,
      NOW,
    );
    const today = days[days.length - 1];
    expect(today.uptime).not.toBeNull();
    expect(today.uptime!).toBeLessThan(1);
  });
});
