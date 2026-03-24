import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";
import { computeDrift } from "../lib/drift.js";
import { resolveAll } from "../lib/resolver.js";
import type { Config, DriftResult } from "../types.js";
import { Table, driftCellStyle } from "./Table.js";

interface DriftReportProps {
  config: Config;
  failOnDrift?: boolean;
}

export function DriftReport({ config, failOnDrift }: DriftReportProps) {
  const [results, setResults] = useState<DriftResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    resolveAll(config.environments, config.services)
      .then((resolved) => {
        const all = computeDrift(resolved);
        const drifted = all.filter((r) => r.status === "drift");
        setResults(drifted);

        if (failOnDrift && drifted.length > 0) {
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
    return <Text dimColor>Checking for drift...</Text>;
  }

  if (results.length === 0) {
    return (
      <Box paddingTop={1} paddingBottom={1}>
        <Text color="green">No drift detected — all services in sync.</Text>
      </Box>
    );
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
    if (result.level === "major") row.status = "⚠ major drift";
    else if (result.level === "minor") row.status = "⚠ minor drift";
    else if (result.level === "patch") row.status = "⚠ patch drift";
    else row.status = "⚠ drift";
    return row;
  });

  return (
    <Box flexDirection="column" paddingTop={1} paddingBottom={1}>
      <Text bold color="red">
        {results.length} service{results.length > 1 ? "s" : ""} with version drift:
      </Text>
      <Box paddingTop={1}>
        <Table columns={columns} rows={rows} getCellStyle={driftCellStyle} />
      </Box>
    </Box>
  );
}
