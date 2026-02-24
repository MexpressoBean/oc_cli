const fs = require("fs");
const os = require("os");
const path = require("path");
const { DEFAULT_ACCENT, isHexColor } = require("./ui");

const DEFAULTS = {
  defaults: {
    webPort: 18789,
    mcPort: 18791
  },
  ssh: {
    user: "",
    host: "",
    serverAliveInterval: 30,
    serverAliveCountMax: 3
  },
  missionControl: {
    remoteDir: "",
    readyMaxTries: 40,
    readyDelayMs: 500
  },
  ui: {
    accentColor: DEFAULT_ACCENT
  }
};

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Config must be a JSON object.");
    }
    return parsed;
  } catch (error) {
    throw new Error(`Invalid JSON in config file "${filePath}": ${error.message}`);
  }
}

function mergeConfig(base, extra) {
  return {
    defaults: {
      ...base.defaults,
      ...(extra.defaults || {})
    },
    ssh: {
      ...base.ssh,
      ...(extra.ssh || {})
    },
    missionControl: {
      ...base.missionControl,
      ...(extra.missionControl || {})
    },
    ui: {
      ...base.ui,
      ...(extra.ui || {})
    }
  };
}

function normalizePositiveInt(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizePort(value, fallback) {
  const parsed = normalizePositiveInt(value, fallback);
  if (parsed < 1 || parsed > 65535) return fallback;
  return parsed;
}

function normalizeHexColor(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim();
  return isHexColor(normalized) ? normalized : fallback;
}

function loadConfigFile() {
  const envPath = process.env.OC_CONFIG_PATH;
  const cwdPath = path.join(process.cwd(), "oc.config.json");
  const homePath = path.join(os.homedir(), ".oc-cli", "config.json");
  const candidates = [envPath, cwdPath, homePath].filter(Boolean);

  for (const configPath of candidates) {
    if (fs.existsSync(configPath)) {
      return readJsonFile(configPath);
    }
  }

  return {};
}

function validateRequired(config) {
  const missing = [];
  if (!config.ssh.user) missing.push("ssh.user");
  if (!config.ssh.host) missing.push("ssh.host");
  if (!config.missionControl.remoteDir) missing.push("missionControl.remoteDir");

  if (missing.length > 0) {
    throw new Error(
      `Missing required config: ${missing.join(", ")}.\n` +
      "Create ./oc.config.json from ./oc.config.example.json, or set env vars OC_SSH_USER/OC_SSH_HOST/OC_REMOTE_DIR."
    );
  }
}

function loadConfig() {
  const config = mergeConfig(DEFAULTS, loadConfigFile());

  config.ssh.user = process.env.OC_SSH_USER || config.ssh.user;
  config.ssh.host = process.env.OC_SSH_HOST || config.ssh.host;
  config.missionControl.remoteDir =
    process.env.OC_REMOTE_DIR || config.missionControl.remoteDir;

  config.ssh.user = String(config.ssh.user).trim();
  config.ssh.host = String(config.ssh.host).trim();
  config.missionControl.remoteDir = String(config.missionControl.remoteDir).trim();

  config.defaults.webPort = normalizePort(
    process.env.OC_WEB_PORT ?? config.defaults.webPort,
    DEFAULTS.defaults.webPort
  );
  config.defaults.mcPort = normalizePort(
    process.env.OC_MC_PORT ?? config.defaults.mcPort,
    DEFAULTS.defaults.mcPort
  );
  config.ssh.serverAliveInterval = normalizePositiveInt(
    process.env.OC_SERVER_ALIVE_INTERVAL ?? config.ssh.serverAliveInterval,
    DEFAULTS.ssh.serverAliveInterval
  );
  config.ssh.serverAliveCountMax = normalizePositiveInt(
    process.env.OC_SERVER_ALIVE_COUNT_MAX ?? config.ssh.serverAliveCountMax,
    DEFAULTS.ssh.serverAliveCountMax
  );
  config.missionControl.readyMaxTries = normalizePositiveInt(
    process.env.OC_READY_MAX_TRIES ?? config.missionControl.readyMaxTries,
    DEFAULTS.missionControl.readyMaxTries
  );
  config.missionControl.readyDelayMs = normalizePositiveInt(
    process.env.OC_READY_DELAY_MS ?? config.missionControl.readyDelayMs,
    DEFAULTS.missionControl.readyDelayMs
  );
  config.ui.accentColor = normalizeHexColor(
    process.env.OC_ACCENT_COLOR ?? config.ui.accentColor,
    DEFAULTS.ui.accentColor
  );

  validateRequired(config);

  return {
    ...config,
    sshDest: `${config.ssh.user}@${config.ssh.host}`
  };
}

module.exports = {
  loadConfig
};
