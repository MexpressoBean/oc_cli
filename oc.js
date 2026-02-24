#!/usr/bin/env node

const { Command } = require("commander");
const { loadConfig } = require("./src/config");
const { parsePort, runMc, runKill, runWeb, runSsh } = require("./src/commands");
const { DEFAULT_ACCENT, createUi } = require("./src/ui");

const FALLBACK_MC_PORT = 18791;
const FALLBACK_CONFIG = {
  ui: {
    accentColor: DEFAULT_ACCENT
  }
};

let cachedConfig = null;
function getConfig() {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

function getDefaultMcPort() {
  try {
    return getConfig().defaults.mcPort;
  } catch {
    return FALLBACK_MC_PORT;
  }
}

function getUiConfig() {
  try {
    return getConfig();
  } catch {
    return FALLBACK_CONFIG;
  }
}

function getUi() {
  return createUi(getUiConfig().ui.accentColor);
}

function formatHelp(cmd, helper) {
  const ui = getUi();
  const lines = [];

  lines.push(ui.heading(`Usage: ${helper.commandUsage(cmd)}`), "");

  const description = helper.commandDescription(cmd);
  if (description) {
    lines.push(description, "");
  }

  const args = helper.visibleArguments(cmd);
  if (args.length > 0) {
    lines.push(ui.heading("Arguments:"));
    const argWidth = helper.longestArgumentTermLength(cmd, helper);
    for (const arg of args) {
      const term = helper.argumentTerm(arg).padEnd(argWidth);
      const desc = helper.argumentDescription(arg) || "";
      lines.push(`  ${ui.accent(term)}  ${ui.muted(desc)}`);
    }
    lines.push("");
  }

  const options = helper.visibleOptions(cmd);
  if (options.length > 0) {
    lines.push(ui.heading("Options:"));
    const optionWidth = helper.longestOptionTermLength(cmd, helper);
    for (const option of options) {
      const term = helper.optionTerm(option).padEnd(optionWidth);
      const desc = helper.optionDescription(option) || "";
      lines.push(`  ${ui.accent(term)}  ${ui.muted(desc)}`);
    }
    lines.push("");
  }

  const commands = helper.visibleCommands(cmd);
  if (commands.length > 0) {
    lines.push(ui.heading("Commands:"));
    const cmdWidth = helper.longestSubcommandTermLength(cmd, helper);
    for (const sub of commands) {
      const term = helper.subcommandTerm(sub).padEnd(cmdWidth);
      const desc = helper.subcommandDescription(sub) || "";
      lines.push(`  ${ui.accent(term)}  ${ui.muted(desc)}`);
    }
  }

  return lines.join("\n");
}

function wrapAction(action) {
  return async (...args) => {
    try {
      await action(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(getUi().error(`✖ ${message}`));
      process.exit(1);
    }
  };
}

const program = new Command();

program
  .name("oc")
  .description("OpenClaw CLI")
  .showHelpAfterError();

program.configureHelp({
  formatHelp
});

program.configureOutput({
  outputError: (str, write) => write(getUi().error(str))
});

program
  .command("web")
  .description("Open SSH tunnel for OC web. Runs in foreground.")
  .action(wrapAction(() => runWeb(getConfig())));

program
  .command("ssh")
  .description("SSH into the configured VPS host.")
  .action(wrapAction(() => runSsh(getConfig())));

const mcCommand = program
  .command("mc")
  .description("Mission Control commands.");

mcCommand
  .argument("[port]", "Local/remote port for Mission Control", parsePort)
  .action(wrapAction(async (portArg) => {
    const config = getConfig();
    const port = portArg || config.defaults.mcPort;
    await runMc(config, port);
  }));

mcCommand
  .command("kill")
  .description("Kill SSH tunnel for Mission Control.")
  .argument("[port]", "Port to kill tunnel on", parsePort)
  .action(wrapAction((portArg) => runKill(getUiConfig(), portArg || getDefaultMcPort())));

program.parse(process.argv);
