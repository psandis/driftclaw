import semver from "semver";

export function isValid(version: string): boolean {
  return semver.valid(cleanVersion(version)) !== null;
}

export function compare(a: string, b: string): number {
  const cleanA = cleanVersion(a);
  const cleanB = cleanVersion(b);

  const validA = semver.valid(cleanA);
  const validB = semver.valid(cleanB);

  if (!validA || !validB) {
    return a.localeCompare(b);
  }

  return semver.compare(validA, validB);
}

export function driftLevel(a: string, b: string): "major" | "minor" | "patch" | "none" | "unknown" {
  const cleanA = cleanVersion(a);
  const cleanB = cleanVersion(b);

  const validA = semver.valid(cleanA);
  const validB = semver.valid(cleanB);

  if (!validA || !validB) {
    return a === b ? "none" : "unknown";
  }

  const diff = semver.diff(validA, validB);
  if (!diff) return "none";

  if (diff.startsWith("major") || diff === "premajor") return "major";
  if (diff.startsWith("minor") || diff === "preminor") return "minor";
  if (diff.startsWith("patch") || diff === "prepatch" || diff === "prerelease") return "patch";

  return "unknown";
}

function cleanVersion(version: string): string {
  return version.replace(/^v/i, "");
}
