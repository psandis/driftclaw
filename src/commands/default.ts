import { findConfigPath, loadConfig } from "../lib/config.js";

interface Options {
  config?: string;
  json?: boolean;
  plain?: boolean;
  ink?: boolean;
  failOnDrift?: boolean;
}

export async function runDefault(options: Options) {
  const configPath = findConfigPath(options.config);
  const config = loadConfig(configPath);

  if (options.json) {
    const { resolveAll } = await import("../lib/resolver.js");
    const { computeDrift } = await import("../lib/drift.js");
    const resolved = await resolveAll(config.environments, config.services);
    const results = computeDrift(resolved);
    console.log(JSON.stringify(results, null, 2));
    if (options.failOnDrift && results.some((r) => r.status === "drift")) process.exitCode = 1;
    return;
  }

  if (!options.ink) {
    const { printMatrix } = await import("../lib/plain.js");
    const results = await printMatrix(config);
    if (options.failOnDrift && results.some((r) => r.status === "drift")) process.exitCode = 1;
    return;
  }

  const { render } = await import("ink");
  const React = await import("react");
  const { VersionMatrix } = await import("../components/VersionMatrix.js");
  const { waitUntilExit } = render(
    React.createElement(VersionMatrix, { config, failOnDrift: options.failOnDrift }),
  );
  await waitUntilExit();
}
