import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";
import { driftLevel } from "../lib/semver.js";
import { resolveVersion } from "../lib/resolver.js";
import type { Config, ResolveResult } from "../types.js";

interface ServiceCheckProps {
  config: Config;
  serviceName: string;
  failOnDrift?: boolean;
}

export function ServiceCheck({ config, serviceName, failOnDrift }: ServiceCheckProps) {
  const [results, setResults] = useState<ResolveResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const service = config.services.find((s) => s.name === serviceName);

  useEffect(() => {
    if (!service) {
      setError(`Service '${serviceName}' not found in config`);
      return;
    }

    const envs = service.environments || config.environments;
    Promise.all(envs.map((env) => resolveVersion(env, service)))
      .then((res) => {
        setResults(res);

        const versions = res.filter((r) => r.version).map((r) => r.version!);
        const allSame = new Set(versions).size <= 1;
        if (failOnDrift && !allSame) {
          process.exitCode = 1;
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unknown error");
      });
  }, [config, service, serviceName, failOnDrift]);

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (!results) {
    return <Text dimColor>Checking {serviceName}...</Text>;
  }

  const versions = results.filter((r) => r.version).map((r) => r.version!);
  const allSame = new Set(versions).size <= 1;

  // Find max drift level
  let maxLevel = "none";
  if (versions.length >= 2) {
    for (let i = 0; i < versions.length; i++) {
      for (let j = i + 1; j < versions.length; j++) {
        const level = driftLevel(versions[i], versions[j]);
        if (level === "major") maxLevel = "major";
        else if (level === "minor" && maxLevel !== "major") maxLevel = "minor";
        else if (level === "patch" && maxLevel === "none") maxLevel = "patch";
      }
    }
  }

  const driftColor = maxLevel === "major" ? "red" : maxLevel === "minor" ? "yellow" : "cyan";

  return (
    <Box flexDirection="column" paddingTop={1} paddingBottom={1}>
      <Text bold>{serviceName}</Text>
      <Box flexDirection="column" paddingTop={1}>
        {results.map((result) => (
          <Box key={result.environment} gap={2}>
            <Box width={15}>
              <Text dimColor>{result.environment}</Text>
            </Box>
            <Text color={result.error ? "red" : allSame ? "green" : driftColor}>
              {result.version || result.error || "—"}
            </Text>
          </Box>
        ))}
      </Box>
      <Box paddingTop={1}>
        {allSame ? (
          <Text color="green">✓ All environments in sync</Text>
        ) : (
          <Text color={driftColor}>
            ⚠ {maxLevel !== "none" ? `${maxLevel} ` : ""}version drift detected
          </Text>
        )}
      </Box>
    </Box>
  );
}
