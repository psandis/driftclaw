import { execSync } from "node:child_process";
import type { Environment, ResolveResult, Service } from "../types.js";

// --- HTTP ---

async function resolveHttp(env: Environment, service: Service): Promise<ResolveResult> {
  const url = `${env.url.replace(/\/$/, "")}${service.path || "/version"}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return result(env.name, service.name, null, `HTTP ${response.status}`);
    }

    const body = await response.json();
    const field = service.field || "version";
    const version = getNestedField(body, field);

    if (!version) {
      return result(env.name, service.name, null, `Field '${field}' not found in response`);
    }

    return result(env.name, service.name, String(version));
  } catch (err) {
    return result(env.name, service.name, null, errorMessage(err));
  }
}

// --- HTML meta tag ---

async function resolveHtmlMeta(env: Environment, service: Service): Promise<ResolveResult> {
  const url = `${env.url.replace(/\/$/, "")}${service.path || "/"}`;
  const pattern = service.field || "generator";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return result(env.name, service.name, null, `HTTP ${response.status}`);
    }

    const html = await response.text();
    const regex = new RegExp(`<meta[^>]*name=["']${pattern}["'][^>]*content=["']([^"']+)["']`, "i");
    const altRegex = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${pattern}["']`, "i");

    const match = html.match(regex) || html.match(altRegex);
    if (!match) {
      return result(env.name, service.name, null, `No <meta name="${pattern}"> found`);
    }

    return result(env.name, service.name, match[1]);
  } catch (err) {
    return result(env.name, service.name, null, errorMessage(err));
  }
}

// --- GitHub tags ---

async function resolveGitTag(_env: Environment, service: Service): Promise<ResolveResult> {
  if (!service.repo) {
    return result("latest", service.name, null, "git-tag source requires 'repo' field (owner/name)");
  }

  const url = `https://api.github.com/repos/${service.repo}/tags?per_page=10`;
  return fetchTags(url, service, "GITHUB_TOKEN", "GH_TOKEN");
}

// --- GitLab tags ---

async function resolveGitlabTag(_env: Environment, service: Service): Promise<ResolveResult> {
  if (!service.repo) {
    return result(
      "latest",
      service.name,
      null,
      "gitlab-tag source requires 'repo' field (project ID or URL-encoded path)",
    );
  }

  const baseUrl = service.url || "https://gitlab.com";
  const encoded = encodeURIComponent(service.repo);
  const url = `${baseUrl}/api/v4/projects/${encoded}/repository/tags?per_page=10`;
  return fetchTags(url, service, "GITLAB_TOKEN");
}

// --- Bitbucket tags ---

async function resolveBitbucketTag(_env: Environment, service: Service): Promise<ResolveResult> {
  if (!service.repo) {
    return result(
      "latest",
      service.name,
      null,
      "bitbucket-tag source requires 'repo' field (workspace/repo)",
    );
  }

  const url = `https://api.bitbucket.org/2.0/repositories/${service.repo}/refs/tags?sort=-name&pagelen=10`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "driftclaw",
  };

  const token = service.token || process.env.BITBUCKET_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      return result("latest", service.name, null, `Bitbucket API ${response.status}`);
    }

    const body = (await response.json()) as { values: Array<{ name: string }> };
    if (!body.values?.length) {
      return result("latest", service.name, null, "No tags found");
    }

    return result("latest", service.name, body.values[0].name);
  } catch (err) {
    return result("latest", service.name, null, errorMessage(err));
  }
}

// --- Docker registry ---

async function resolveDocker(_env: Environment, service: Service): Promise<ResolveResult> {
  if (!service.image) {
    return result("latest", service.name, null, "docker source requires 'image' field");
  }

  const image = service.image;
  const registryUrl = service.url || "https://registry.hub.docker.com";
  const imagePath = image.includes("/") ? image : `library/${image}`;
  const url = `${registryUrl}/v2/repositories/${imagePath}/tags/?page_size=10&ordering=last_updated`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return result("latest", service.name, null, `Docker registry ${response.status}`);
    }

    const body = (await response.json()) as { results: Array<{ name: string }> };
    if (!body.results?.length) {
      return result("latest", service.name, null, "No tags found");
    }

    // Skip 'latest' tag, find first semver-looking tag
    const semverTag = body.results.find((t) => /^v?\d/.test(t.name));
    const tag = semverTag?.name || body.results[0].name;

    return result("latest", service.name, tag);
  } catch (err) {
    return result("latest", service.name, null, errorMessage(err));
  }
}

// --- npm registry ---

async function resolveNpm(_env: Environment, service: Service): Promise<ResolveResult> {
  const pkg = service.package;
  if (!pkg) {
    return result("latest", service.name, null, "npm source requires 'package' field");
  }

  const url = `https://registry.npmjs.org/${pkg}/latest`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return result("latest", service.name, null, `npm registry ${response.status}`);
    }

    const body = (await response.json()) as { version: string };
    if (!body.version) {
      return result("latest", service.name, null, "No version field in npm response");
    }

    return result("latest", service.name, body.version);
  } catch (err) {
    return result("latest", service.name, null, errorMessage(err));
  }
}

// --- Custom command ---

async function resolveCustom(env: Environment, service: Service): Promise<ResolveResult> {
  if (!service.command) {
    return result(env.name, service.name, null, "custom source requires 'command' field");
  }

  try {
    const output = execSync(service.command, {
      encoding: "utf-8",
      timeout: 10000,
      env: { ...process.env, DRIFTCLAW_ENV: env.name, DRIFTCLAW_SERVICE: service.name },
    }).trim();

    if (!output) {
      return result(env.name, service.name, null, "Command returned empty output");
    }

    return result(env.name, service.name, output);
  } catch (err) {
    return result(env.name, service.name, null, errorMessage(err));
  }
}

// --- Shared helpers ---

async function fetchTags(
  url: string,
  service: Service,
  ...envTokenKeys: string[]
): Promise<ResolveResult> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "driftclaw",
  };

  const token = service.token || envTokenKeys.reduce<string | undefined>(
    (found, key) => found || process.env[key],
    undefined,
  );
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      return result("latest", service.name, null, `API ${response.status}`);
    }

    const tags = (await response.json()) as Array<{ name: string }>;
    if (!Array.isArray(tags) || !tags.length) {
      return result("latest", service.name, null, "No tags found");
    }

    return result("latest", service.name, tags[0].name);
  } catch (err) {
    return result("latest", service.name, null, errorMessage(err));
  }
}

function result(
  environment: string,
  service: string,
  version: string | null,
  error?: string,
): ResolveResult {
  return error ? { environment, service, version, error } : { environment, service, version };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

function getNestedField(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export async function resolveVersion(env: Environment, service: Service): Promise<ResolveResult> {
  switch (service.source) {
    case "http":
      return resolveHttp(env, service);
    case "html-meta":
      return resolveHtmlMeta(env, service);
    case "git-tag":
      return resolveGitTag(env, service);
    case "gitlab-tag":
      return resolveGitlabTag(env, service);
    case "bitbucket-tag":
      return resolveBitbucketTag(env, service);
    case "docker":
      return resolveDocker(env, service);
    case "npm":
      return resolveNpm(env, service);
    case "custom":
      return resolveCustom(env, service);
    default:
      return result(env.name, service.name, null, `Unknown source: ${service.source}`);
  }
}

export async function resolveAll(
  environments: Environment[],
  services: Service[],
): Promise<ResolveResult[]> {
  const promises: Promise<ResolveResult>[] = [];

  for (const service of services) {
    const isEnvIndependent = ["git-tag", "gitlab-tag", "bitbucket-tag", "docker", "npm"].includes(
      service.source,
    );

    if (isEnvIndependent) {
      promises.push(resolveVersion({ name: "latest", url: "" }, service));
    } else {
      const envs = service.environments || environments;
      for (const env of envs) {
        promises.push(resolveVersion(env, service));
      }
    }
  }

  return Promise.all(promises);
}
