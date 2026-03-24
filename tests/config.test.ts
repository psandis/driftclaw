import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, afterEach } from "vitest";
import { loadConfig } from "../src/lib/config.js";

describe("loadConfig", () => {
  const tmpDir = join(tmpdir(), "driftclaw-test");
  const tmpFile = join(tmpDir, "test-config.yaml");

  function writeTestConfig(content: string) {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(tmpFile, content);
  }

  afterEach(() => {
    try {
      unlinkSync(tmpFile);
    } catch {}
  });

  it("parses a valid config", () => {
    writeTestConfig(`
environments:
  dev:
    url: https://dev.example.com
  prod:
    url: https://example.com

services:
  api:
    source: http
    path: /version
    field: version
`);
    const config = loadConfig(tmpFile);
    expect(config.environments).toHaveLength(2);
    expect(config.services).toHaveLength(1);
    expect(config.environments[0].name).toBe("dev");
    expect(config.services[0].source).toBe("http");
  });

  it("throws on missing environments", () => {
    writeTestConfig(`
services:
  api:
    source: http
`);
    expect(() => loadConfig(tmpFile)).toThrow("environments");
  });

  it("throws on missing services", () => {
    writeTestConfig(`
environments:
  dev:
    url: https://dev.example.com
`);
    expect(() => loadConfig(tmpFile)).toThrow("services");
  });

  it("throws on unsupported source type", () => {
    writeTestConfig(`
environments:
  dev:
    url: https://dev.example.com
services:
  api:
    source: foobar
`);
    expect(() => loadConfig(tmpFile)).toThrow("unsupported source");
  });

  it("throws on missing url in environment", () => {
    writeTestConfig(`
environments:
  dev:
    name: dev
services:
  api:
    source: http
`);
    expect(() => loadConfig(tmpFile)).toThrow("url");
  });
});
