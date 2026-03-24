import { driftLevel } from "./semver.js";
import type { DriftLevel, DriftResult, DriftStatus, ResolveResult } from "../types.js";

export function computeDrift(results: ResolveResult[]): DriftResult[] {
  const grouped = new Map<string, Record<string, string | null>>();

  for (const result of results) {
    if (!grouped.has(result.service)) {
      grouped.set(result.service, {});
    }
    const versions = grouped.get(result.service)!;
    versions[result.environment] = result.version;
  }

  const driftResults: DriftResult[] = [];

  for (const [service, versions] of grouped) {
    const status = getDriftStatus(versions);
    const level = getMaxDriftLevel(versions);
    driftResults.push({ service, versions, status, level });
  }

  return driftResults;
}

function getDriftStatus(versions: Record<string, string | null>): DriftStatus {
  const values = Object.values(versions);

  if (values.every((v) => v === null)) {
    return "unknown";
  }

  const unique = new Set(values);
  return unique.size === 1 ? "sync" : "drift";
}

function getMaxDriftLevel(versions: Record<string, string | null>): DriftLevel {
  const valid = Object.values(versions).filter((v): v is string => v !== null);

  if (valid.length < 2) return "none";

  let maxLevel: DriftLevel = "none";
  const priority: Record<DriftLevel, number> = {
    none: 0,
    patch: 1,
    minor: 2,
    major: 3,
    unknown: 4,
  };

  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const level = driftLevel(valid[i], valid[j]);
      if (priority[level] > priority[maxLevel]) {
        maxLevel = level;
      }
    }
  }

  return maxLevel;
}
