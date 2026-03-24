import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";
import { computeDrift } from "../lib/drift.js";
import { resolveAll } from "../lib/resolver.js";
import type { Config, DriftResult } from "../types.js";
import { Table, driftCellStyle } from "./Table.js";

interface VersionMatrixProps {
  config: Config;
  failOnDrift?: boolean;
}

export function VersionMatrix({ config, failOnDrift }: VersionMatrixProps) {
  const [results, setResults] = useState<DriftResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    resolveAll(config.environments, config.services)
      .then((resolved) => {
        const drift = computeDrift(resolved);
        setResults(drift);

        if (failOnDrift && drift.some((r) => r.status === "drift")) {
          process.exitCode = 1;
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unknown error");
      });
  }, [config]);

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (!results) {
    return <Text dimColor>Resolving versions...</Text>;
  }

  if (results.length === 0) {
    return <Text dimColor>No services configured.</Text>;
  }

  const envSet = new Set(config.environments.map((e) => e.name));
  for (const service of config.services) {
    if (service.environments) {
      for (const env of service.environments) {
        envSet.add(env.name);
      }
    }
  }
  const envNames = [...envSet];
  const synced = results.filter((r) => r.status === "sync").length;
  const drifted = results.filter((r) => r.status === "drift").length;
  const unknown = results.filter((r) => r.status === "unknown").length;

  const columns = [
    { key: "service", label: "Service", width: 20 },
    ...envNames.map((name) => ({ key: name, label: name })),
    { key: "status", label: "Status", width: 16 },
  ];

  const rows = results.map((result) => {
    const row: Record<string, string> = { service: result.service };
    for (const env of envNames) {
      row[env] = result.versions[env] || "—";
    }
    row.status = formatStatus(result);
    return row;
  });

  return (
    <Box flexDirection="column" paddingTop={1} paddingBottom={1}>
      <Table columns={columns} rows={rows} getCellStyle={driftCellStyle} />
      <Box paddingTop={1}>
        <Text>
          <Text color="green">{synced} in sync</Text>
          {drifted > 0 && <Text color="red"> · {drifted} drifting</Text>}
          {unknown > 0 && <Text color="yellow"> · {unknown} unknown</Text>}
        </Text>
      </Box>
    </Box>
  );
}

function formatStatus(result: DriftResult): string {
  if (result.status === "sync") return "✓ sync";
  if (result.status === "unknown") return "? unknown";
  if (result.level === "major") return "⚠ major drift";
  if (result.level === "minor") return "⚠ minor drift";
  if (result.level === "patch") return "⚠ patch drift";
  return "⚠ drift";
}
