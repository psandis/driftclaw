import { Command } from "commander";

const program = new Command();

program
  .name("driftclaw")
  .description("Environment version drift detection CLI")
  .version("0.1.0")
  .option("-c, --config <path>", "path to config file")
  .option("-j, --json", "output as JSON")
  .option("-p, --plain", "plain output (default)")
  .option("--ink", "Ink/TUI output for report commands")
  .option("--fail-on-drift", "exit code 1 when drift is detected (for CI)")
  .action(async (options) => {
    const { runDefault } = await import("./commands/default.js");
    await runDefault(options);
  });

program
  .command("init")
  .description("Create a driftclaw.yaml config file interactively")
  .action(async () => {
    const { runInit } = await import("./commands/init.js");
    await runInit();
  });

program
  .command("check <service>")
  .description("Check a single service across all environments")
  .action(async (service, _options, cmd) => {
    const { runCheck } = await import("./commands/check.js");
    await runCheck(service, cmd.optsWithGlobals());
  });

program
  .command("drift")
  .description("Show only services with version drift")
  .action(async (_options, cmd) => {
    const { runDrift } = await import("./commands/drift.js");
    await runDrift(cmd.optsWithGlobals());
  });

export { program };
