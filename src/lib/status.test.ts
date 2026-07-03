import { describe, expect, it } from "vitest";
import { overallStatus } from "./status";

describe("overallStatus", () => {
  it("is operational when empty or all operational", () => {
    expect(overallStatus([])).toBe("operational");
    expect(overallStatus(["operational", "operational"])).toBe("operational");
  });

  it("picks the worst status present", () => {
    expect(overallStatus(["operational", "degraded"])).toBe("degraded");
    expect(overallStatus(["degraded", "major_outage", "partial_outage"])).toBe(
      "major_outage",
    );
    expect(overallStatus(["maintenance", "operational"])).toBe("maintenance");
    expect(overallStatus(["maintenance", "degraded"])).toBe("degraded");
  });
});
