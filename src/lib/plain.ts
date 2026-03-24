import chalk from "chalk";
import { computeDrift } from "./drift.js";
import { resolveAll } from "./resolver.js";
import type { Config, DriftResult } from "../types.js";

const ANSI_REGEX = /\u001B\[[0-9;]*m/g;

function getAllEnvNames(config: Config): string[] {
  const envSet = new Set(config.environments.map((e) => e.name));
  for (const service of config.services) {
    if (service.environments) {
      for (const env of service.environments) {
        envSet.add(env.name);
      }
    }
  }
  return [...envSet];
}

export async function printMatrix(config: Config): Promise<DriftResult[]> {
  const resolved = await resolveAll(config.environments, config.services);
  const results = computeDrift(resolved);
  const envNames = getAllEnvNames(config);
  console.log(renderDriftTable(results, envNames));

  const synced = results.filter((r) => r.status === "sync").length;
  const drifted = results.filter((r) => r.status === "drift").length;
  const unknown = results.filter((r) => r.status === "unknown").length;
  const parts = [`${results.length} service${results.length === 1 ? "" : "s"}`];
  if (synced > 0) parts.push(chalk.green(`${synced} sync`));
  if (drifted > 0) parts.push(chalk.red(`${drifted} drift`));
  if (unknown > 0) parts.push(chalk.yellow(`${unknown} unknown`));

  console.log(`\n${chalk.dim("Summary:")} ${parts.join(chalk.dim(" · "))}`);

  return results;
}

export async function printDriftOnly(config: Config): Promise<DriftResult[]> {
  const resolved = await resolveAll(config.environments, config.services);
  const all = computeDrift(resolved);
  const drifted = all.filter((r) => r.status === "drift");

  if (drifted.length === 0) {
    console.log(chalk.green("No drift detected — all services in sync."));
    return drifted;
  }

  const envNames = getAllEnvNames(config);

  console.log(
    chalk.bold.red(
      `${drifted.length} service${drifted.length > 1 ? "s" : ""} with version drift:\n`,
    ),
  );
  console.log(renderDriftTable(drifted, envNames));

  return drifted;
}

export async function printServiceCheck(config: Config, serviceName: string): Promise<boolean> {
  const service = config.services.find((s) => s.name === serviceName);
  if (!service) {
    console.log(chalk.red(`Service '${serviceName}' not found in config`));
    return false;
  }

  const { resolveVersion } = await import("./resolver.js");
  const envs = service.environments || config.environments;
  const results = await Promise.all(envs.map((env) => resolveVersion(env, service)));

  console.log(chalk.bold(`\n${serviceName}\n`));

  const rows = results.map((result) => [
    chalk.dim(result.environment),
    result.error ? chalk.red(result.error) : chalk.green(result.version || "—"),
  ]);
  console.log(renderTable([chalk.dim("Environment"), chalk.dim("Version")], rows));

  const versions = results.filter((r) => r.version).map((r) => r.version!);
  const allSame = new Set(versions).size <= 1;

  if (allSame) {
    console.log(chalk.green("\n✓ All environments in sync"));
  } else {
    console.log(chalk.red("\n⚠ Version drift detected"));
  }

  return allSame;
}

function colorVersion(version: string, result: DriftResult): string {
  if (version === "—") return chalk.gray(version);
  if (result.status === "sync") return chalk.green(version);
  if (result.level === "major") return chalk.red(version);
  if (result.level === "minor") return chalk.yellow(version);
  if (result.level === "patch") return chalk.cyan(version);
  return chalk.red(version);
}

function colorStatus(result: DriftResult): string {
  if (result.status === "sync") return chalk.green("✓ sync");
  if (result.status === "unknown") return chalk.yellow("? unknown");
  if (result.level === "major") return chalk.bold.red("⚠ major drift");
  if (result.level === "minor") return chalk.yellow("⚠ minor drift");
  if (result.level === "patch") return chalk.cyan("⚠ patch drift");
  return chalk.red("⚠ drift");
}

function renderDriftTable(results: DriftResult[], envNames: string[]): string {
  const headers = [chalk.dim("Service"), ...envNames.map((name) => chalk.dim(name)), chalk.dim("Status")];
  const rows = results.map((result) => [
    chalk.bold(result.service),
    ...envNames.map((env) => colorVersion(result.versions[env] || "—", result)),
    colorStatus(result),
  ]);

  return renderTable(headers, rows);
}

function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) =>
    Math.max(visibleWidth(header), ...rows.map((row) => visibleWidth(row[index] || ""))),
  );

  const top = border("┌", "┬", "┐", widths);
  const mid = border("├", "┼", "┤", widths);
  const bottom = border("└", "┴", "┘", widths);

  const lines = [
    chalk.dim(top),
    formatRow(headers, widths),
    chalk.dim(mid),
    ...rows.map((row) => formatRow(row, widths)),
    chalk.dim(bottom),
  ];

  return lines.join("\n");
}

function border(left: string, join: string, right: string, widths: number[]): string {
  return `${left}${widths.map((width) => "─".repeat(width + 2)).join(join)}${right}`;
}

function formatRow(cells: string[], widths: number[]): string {
  return `│ ${cells
    .map((cell, index) => padCell(cell, widths[index]))
    .join(" │ ")} │`;
}

function padCell(value: string, width: number): string {
  const padding = Math.max(0, width - visibleWidth(value));
  return `${value}${" ".repeat(padding)}`;
}

function visibleWidth(value: string): number {
  return Array.from(value.replace(ANSI_REGEX, "")).length;
}
