import { describe, it, expect } from "vitest";
import { computeDrift } from "../src/lib/drift.js";
import type { ResolveResult } from "../src/types.js";

describe("computeDrift", () => {
  it("detects sync when all versions match", () => {
    const results: ResolveResult[] = [
      { environment: "dev", service: "api", version: "v1.0.0" },
      { environment: "prod", service: "api", version: "v1.0.0" },
    ];
    const drift = computeDrift(results);
    expect(drift).toHaveLength(1);
    expect(drift[0].status).toBe("sync");
    expect(drift[0].level).toBe("none");
  });

  it("detects drift when versions differ", () => {
    const results: ResolveResult[] = [
      { environment: "dev", service: "api", version: "v2.0.0" },
      { environment: "prod", service: "api", version: "v1.0.0" },
    ];
    const drift = computeDrift(results);
    expect(drift).toHaveLength(1);
    expect(drift[0].status).toBe("drift");
    expect(drift[0].level).toBe("major");
  });

  it("detects minor drift level", () => {
    const results: ResolveResult[] = [
      { environment: "dev", service: "api", version: "v1.2.0" },
      { environment: "prod", service: "api", version: "v1.0.0" },
    ];
    const drift = computeDrift(results);
    expect(drift[0].status).toBe("drift");
    expect(drift[0].level).toBe("minor");
  });

  it("detects patch drift level", () => {
    const results: ResolveResult[] = [
      { environment: "dev", service: "api", version: "v1.0.1" },
      { environment: "prod", service: "api", version: "v1.0.0" },
    ];
    const drift = computeDrift(results);
    expect(drift[0].status).toBe("drift");
    expect(drift[0].level).toBe("patch");
  });

  it("returns unknown when all versions are null", () => {
    const results: ResolveResult[] = [
      { environment: "dev", service: "api", version: null, error: "timeout" },
      { environment: "prod", service: "api", version: null, error: "timeout" },
    ];
    const drift = computeDrift(results);
    expect(drift[0].status).toBe("unknown");
    expect(drift[0].level).toBe("none");
  });

  it("groups by service", () => {
    const results: ResolveResult[] = [
      { environment: "dev", service: "api", version: "v1.0.0" },
      { environment: "prod", service: "api", version: "v1.0.0" },
      { environment: "dev", service: "web", version: "v2.0.0" },
      { environment: "prod", service: "web", version: "v1.0.0" },
    ];
    const drift = computeDrift(results);
    expect(drift).toHaveLength(2);
    expect(drift.find((d) => d.service === "api")?.status).toBe("sync");
    expect(drift.find((d) => d.service === "web")?.status).toBe("drift");
    expect(drift.find((d) => d.service === "web")?.level).toBe("major");
  });

  it("treats null + version as drift", () => {
    const results: ResolveResult[] = [
      { environment: "dev", service: "api", version: "v1.0.0" },
      { environment: "prod", service: "api", version: null },
    ];
    const drift = computeDrift(results);
    expect(drift[0].status).toBe("drift");
  });
});
