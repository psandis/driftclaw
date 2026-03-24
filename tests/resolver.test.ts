import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveVersion } from "../src/lib/resolver.js";
import type { Environment, Service } from "../src/types.js";

describe("resolveVersion", () => {
  const env: Environment = { name: "dev", url: "https://dev.example.com" };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // --- HTTP ---

  it("resolves HTTP version from JSON endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: "v1.2.3" }),
      }),
    );

    const service: Service = { name: "api", source: "http", path: "/version", field: "version" };
    const result = await resolveVersion(env, service);
    expect(result.version).toBe("v1.2.3");
    expect(result.error).toBeUndefined();
  });

  it("handles HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const service: Service = { name: "api", source: "http", path: "/version" };
    const result = await resolveVersion(env, service);
    expect(result.version).toBeNull();
    expect(result.error).toContain("404");
  });

  it("handles network errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const service: Service = { name: "api", source: "http", path: "/version" };
    const result = await resolveVersion(env, service);
    expect(result.version).toBeNull();
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("extracts nested fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ app: { info: { version: "v3.0.0" } } }),
      }),
    );

    const service: Service = { name: "api", source: "http", path: "/health", field: "app.info.version" };
    const result = await resolveVersion(env, service);
    expect(result.version).toBe("v3.0.0");
  });

  // --- GitHub git-tag ---

  it("resolves git-tag from GitHub API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ name: "v2.1.0" }, { name: "v2.0.0" }]),
      }),
    );

    const service: Service = { name: "web", source: "git-tag", repo: "psandis/web" };
    const result = await resolveVersion(env, service);
    expect(result.version).toBe("v2.1.0");
  });

  it("handles git-tag with no tags", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }));

    const service: Service = { name: "web", source: "git-tag", repo: "psandis/web" };
    const result = await resolveVersion(env, service);
    expect(result.version).toBeNull();
    expect(result.error).toContain("No tags");
  });

  it("handles git-tag without repo field", async () => {
    const service: Service = { name: "web", source: "git-tag" };
    const result = await resolveVersion(env, service);
    expect(result.version).toBeNull();
    expect(result.error).toContain("repo");
  });

  it("handles git-tag API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const service: Service = { name: "web", source: "git-tag", repo: "psandis/nonexistent" };
    const result = await resolveVersion(env, service);
    expect(result.version).toBeNull();
    expect(result.error).toContain("404");
  });

  // --- GitLab ---

  it("resolves gitlab-tag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ name: "v1.5.0" }]),
      }),
    );

    const service: Service = { name: "svc", source: "gitlab-tag", repo: "group/project" };
    const result = await resolveVersion(env, service);
    expect(result.version).toBe("v1.5.0");
  });

  it("handles gitlab-tag without repo", async () => {
    const service: Service = { name: "svc", source: "gitlab-tag" };
    const result = await resolveVersion(env, service);
    expect(result.error).toContain("repo");
  });

  // --- Bitbucket ---

  it("resolves bitbucket-tag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ values: [{ name: "v3.0.0" }] }),
      }),
    );

    const service: Service = { name: "svc", source: "bitbucket-tag", repo: "team/repo" };
    const result = await resolveVersion(env, service);
    expect(result.version).toBe("v3.0.0");
  });

  it("handles bitbucket-tag without repo", async () => {
    const service: Service = { name: "svc", source: "bitbucket-tag" };
    const result = await resolveVersion(env, service);
    expect(result.error).toContain("repo");
  });

  // --- Docker ---

  it("resolves docker tag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [{ name: "v1.0.0" }, { name: "latest" }] }),
      }),
    );

    const service: Service = { name: "svc", source: "docker", image: "myorg/myapp" };
    const result = await resolveVersion(env, service);
    expect(result.version).toBe("v1.0.0");
  });

  it("handles docker without image", async () => {
    const service: Service = { name: "svc", source: "docker" };
    const result = await resolveVersion(env, service);
    expect(result.error).toContain("image");
  });

  // --- npm ---

  it("resolves npm package version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: "4.2.1" }),
      }),
    );

    const service: Service = { name: "svc", source: "npm", package: "driftclaw" };
    const result = await resolveVersion(env, service);
    expect(result.version).toBe("4.2.1");
  });

  it("handles npm without package", async () => {
    const service: Service = { name: "svc", source: "npm" };
    const result = await resolveVersion(env, service);
    expect(result.error).toContain("package");
  });

  // --- Custom ---

  it("resolves custom command", async () => {
    const service: Service = { name: "svc", source: "custom", command: "echo v5.0.0" };
    const result = await resolveVersion(env, service);
    expect(result.version).toBe("v5.0.0");
  });

  it("handles custom without command", async () => {
    const service: Service = { name: "svc", source: "custom" };
    const result = await resolveVersion(env, service);
    expect(result.error).toContain("command");
  });

  it("handles custom command failure", async () => {
    const service: Service = { name: "svc", source: "custom", command: "exit 1" };
    const result = await resolveVersion(env, service);
    expect(result.version).toBeNull();
    expect(result.error).toBeDefined();
  });
});
