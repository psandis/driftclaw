import { findConfigPath, loadConfig } from "../lib/config.js";

interface Options {
  config?: string;
  json?: boolean;
  plain?: boolean;
  ink?: boolean;
  failOnDrift?: boolean;
}

export async function runDrift(options: Options) {
  const configPath = findConfigPath(options.config);
  const config = loadConfig(configPath);

  if (options.json) {
    const { resolveAll } = await import("../lib/resolver.js");
    const { computeDrift } = await import("../lib/drift.js");
    const resolved = await resolveAll(config.environments, config.services);
    const drifted = computeDrift(resolved).filter((r) => r.status === "drift");
    console.log(JSON.stringify(drifted, null, 2));
    if (options.failOnDrift && drifted.length > 0) process.exitCode = 1;
    return;
  }

  if (!options.ink) {
    const { printDriftOnly } = await import("../lib/plain.js");
    const results = await printDriftOnly(config);
    if (options.failOnDrift && results.length > 0) process.exitCode = 1;
    return;
  }

  const { render } = await import("ink");
  const React = await import("react");
  const { DriftReport } = await import("../components/DriftReport.js");
  const { waitUntilExit } = render(
    React.createElement(DriftReport, { config, failOnDrift: options.failOnDrift }),
  );
  await waitUntilExit();
}
