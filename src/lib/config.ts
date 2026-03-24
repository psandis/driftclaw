import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { Config, Environment, Service, SourceType } from "../types.js";

const DEFAULT_CONFIG_NAMES = ["driftclaw.yaml", "driftclaw.yml"];

const VALID_SOURCES: SourceType[] = [
  "http",
  "html-meta",
  "git-tag",
  "gitlab-tag",
  "bitbucket-tag",
  "docker",
  "npm",
  "custom",
];

export function findConfigPath(explicit?: string): string {
  if (explicit) {
    return resolve(explicit);
  }

  for (const name of DEFAULT_CONFIG_NAMES) {
    const path = resolve(name);
    try {
      readFileSync(path);
      return path;
    } catch {
      continue;
    }
  }

  throw new Error("No driftclaw.yaml found. Run `driftclaw init` to create one.");
}

export function loadConfig(path: string): Config {
  const raw = readFileSync(path, "utf-8");
  const parsed = parse(raw);

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid config file: ${path}`);
  }

  if (!parsed.environments || typeof parsed.environments !== "object") {
    throw new Error("Config must have an 'environments' section");
  }

  if (!parsed.services || typeof parsed.services !== "object") {
    throw new Error("Config must have a 'services' section");
  }

  const environments: Environment[] = Object.entries(parsed.environments).map(([name, value]) => {
    const env = value as Record<string, string>;
    if (!env.url) {
      throw new Error(`Environment '${name}' must have a 'url' field`);
    }
    return { name, url: env.url };
  });

  const services: Service[] = Object.entries(parsed.services).map(([name, value]) => {
    const svc = value as Record<string, string>;
    if (!svc.source) {
      throw new Error(`Service '${name}' must have a 'source' field`);
    }
    if (!VALID_SOURCES.includes(svc.source as SourceType)) {
      throw new Error(
        `Service '${name}' has unsupported source '${svc.source}'. Valid: ${VALID_SOURCES.join(", ")}`,
      );
    }
    let serviceEnvs: Environment[] | undefined;
    if (svc.environments && typeof svc.environments === "object") {
      serviceEnvs = Object.entries(svc.environments as Record<string, Record<string, string>>).map(
        ([envName, envValue]) => ({
          name: envName,
          url: envValue.url || "",
        }),
      );
    }

    return {
      name,
      source: svc.source as SourceType,
      path: svc.path,
      field: svc.field,
      repo: svc.repo,
      image: svc.image,
      package: svc.package,
      command: svc.command,
      url: svc.url,
      token: svc.token,
      environments: serviceEnvs,
    };
  });

  return { environments, services };
}
