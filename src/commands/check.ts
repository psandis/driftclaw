import { findConfigPath, loadConfig } from "../lib/config.js";

interface Options {
  config?: string;
  json?: boolean;
  plain?: boolean;
  ink?: boolean;
  failOnDrift?: boolean;
}

export async function runCheck(serviceName: string, options: Options) {
  const configPath = findConfigPath(options.config);
  const config = loadConfig(configPath);

  if (options.json) {
    const { resolveVersion } = await import("../lib/resolver.js");
    const service = config.services.find((s) => s.name === serviceName);
    if (!service) {
      console.error(`Service '${serviceName}' not found in config`);
      process.exitCode = 1;
      return;
    }
    const envs = service.environments || config.environments;
    const results = await Promise.all(
      envs.map((env) => resolveVersion(env, service)),
    );
    console.log(JSON.stringify(results, null, 2));
    const versions = results.filter((r) => r.version).map((r) => r.version);
    if (options.failOnDrift && new Set(versions).size > 1) process.exitCode = 1;
    return;
  }

  if (!options.ink) {
    const { printServiceCheck } = await import("../lib/plain.js");
    const allSame = await printServiceCheck(config, serviceName);
    if (options.failOnDrift && !allSame) process.exitCode = 1;
    return;
  }

  const { render } = await import("ink");
  const React = await import("react");
  const { ServiceCheck } = await import("../components/ServiceCheck.js");
  const { waitUntilExit } = render(
    React.createElement(ServiceCheck, { config, serviceName, failOnDrift: options.failOnDrift }),
  );
  await waitUntilExit();
}
