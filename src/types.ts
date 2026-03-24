export interface Environment {
  name: string;
  url: string;
}

export type SourceType =
  | "http"
  | "html-meta"
  | "git-tag"
  | "gitlab-tag"
  | "bitbucket-tag"
  | "docker"
  | "npm"
  | "custom";

export interface Service {
  name: string;
  source: SourceType;
  path?: string;
  field?: string;
  repo?: string;
  image?: string;
  package?: string;
  command?: string;
  url?: string;
  token?: string;
  environments?: Environment[];
}

export interface Config {
  environments: Environment[];
  services: Service[];
}

export interface ResolveResult {
  environment: string;
  service: string;
  version: string | null;
  error?: string;
}

export type DriftStatus = "sync" | "drift" | "unknown";
export type DriftLevel = "major" | "minor" | "patch" | "none" | "unknown";

export interface DriftResult {
  service: string;
  versions: Record<string, string | null>;
  status: DriftStatus;
  level: DriftLevel;
}
