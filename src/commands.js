const { spawn, spawnSync } = require("child_process");
const { createUi } = require("./ui");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePort(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return parsed;
}

function shellQuote(input) {
  return `'${String(input).replace(/'/g, `'\\''`)}'`;
}

function checkLocalTunnelExists(port) {
  const result = spawnSync(
    "lsof",
    [`-nP`, `-iTCP:127.0.0.1:${port}`, `-sTCP:LISTEN`],
    { encoding: "utf8" }
  );
  if (result.status !== 0 || !result.stdout) return false;
  return result.stdout.includes("ssh");
}

function checkRemotePortListening(config, port) {
  const result = spawnSync(
    "ssh",
    ["-T", config.sshDest, `ss -ltn 2>/dev/null | grep -q ':${port} '`],
    { stdio: "ignore" }
  );
  return result.status === 0;
}

function runOrThrow(bin, args) {
  const result = spawnSync(bin, args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${bin} failed with exit code ${result.status || 1}`);
  }
}

async function runMc(config, port) {
  const ui = createUi(config.ui.accentColor);
  const url = `http://localhost:${port}`;
  const tunnelSpec = `${port}:127.0.0.1:${port}`;

  console.log(ui.divider());
  console.log(ui.heading("OpenClaw Mission Control"));
  console.log(ui.divider());
  console.log(`${ui.info("Port:")} ${ui.accent(String(port))}`);
  console.log(`${ui.info("VPS:")} ${config.sshDest}`);
  console.log(`${ui.info("Remote dir:")} ${config.missionControl.remoteDir}`);
  console.log("");
  console.log(ui.heading("STEP 1: SSH tunnel check"));

  if (checkLocalTunnelExists(port)) {
    console.log(ui.success(`✔ SSH tunnel already listening on 127.0.0.1:${port}`));
  } else {
    console.log(ui.warn("No existing tunnel found."));
    console.log(ui.info("Creating SSH tunnel:"));
    console.log(ui.muted(`  Local 127.0.0.1:${port} -> Remote 127.0.0.1:${port}`));

    const tunnel = spawnSync(
      "ssh",
      [
        "-f",
        "-N",
        "-T",
        "-o",
        "ExitOnForwardFailure=yes",
        "-o",
        `ServerAliveInterval=${config.ssh.serverAliveInterval}`,
        "-o",
        `ServerAliveCountMax=${config.ssh.serverAliveCountMax}`,
        "-L",
        tunnelSpec,
        config.sshDest
      ],
      { stdio: "inherit" }
    );

    if (tunnel.status !== 0) {
      throw new Error("Failed to establish SSH tunnel.");
    }

    console.log(ui.success("✔ SSH tunnel established successfully."));
  }

  console.log("");
  console.log(ui.heading("STEP 2: Remote dev server check"));
  console.log(ui.muted(`Checking remote port ${port}...`));

  if (checkRemotePortListening(config, port)) {
    console.log(ui.success(`✔ Remote dev server already listening on port ${port}.`));
  } else {
    console.log(ui.warn(`No dev server detected on VPS port ${port}.`));
    console.log(ui.info("Attempting to start remote dev server..."));

    const remoteDir = shellQuote(config.missionControl.remoteDir);
    const startRemote = spawnSync(
      "ssh",
      [
        "-T",
        config.sshDest,
        `set -e
cd ${remoteDir}
echo 'Running npm run dev...'
nohup npm run dev > dev-${port}.log 2>&1 &
disown`
      ],
      { stdio: "inherit" }
    );

    if (startRemote.status !== 0) {
      throw new Error("Failed to start remote dev server.");
    }

    console.log(ui.muted(`Waiting for remote port ${port} to become available...`));

    let tries = 0;
    while (!checkRemotePortListening(config, port)) {
      await sleep(config.missionControl.readyDelayMs);
      tries += 1;
      console.log(ui.muted(`  Checking... (${tries})`));

      if (tries > config.missionControl.readyMaxTries) {
        throw new Error(
          `Timed out waiting for remote dev server. Check VPS log: ${config.missionControl.remoteDir}/dev-${port}.log`
        );
      }
    }

    console.log(ui.success("✔ Remote dev server is now running."));
  }

  console.log("");
  console.log(ui.heading("STEP 3: Open browser"));
  console.log(`${ui.info("Opening:")} ${ui.accent(url)}`);
  runOrThrow("open", [url]);

  console.log("");
  console.log(ui.divider());
  console.log(ui.success("Done."));
  console.log(ui.divider());
}

function runKill(config, port) {
  const ui = createUi(config.ui.accentColor);
  console.log(`${ui.info("Looking for SSH tunnel on port")} ${ui.accent(String(port))}${ui.info("...")}`);
  const list = spawnSync(
    "lsof",
    [`-nP`, `-iTCP:127.0.0.1:${port}`, `-sTCP:LISTEN`],
    { encoding: "utf8" }
  );

  if (list.error) {
    throw new Error("Failed to inspect local listeners with lsof.");
  }

  if (list.status !== 0 && !list.stdout) {
    console.log(ui.warn(`No SSH tunnel found for port ${port}.`));
    return;
  }

  const pids = (list.stdout || "")
    .split("\n")
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((columns) => columns.length >= 2 && columns[0] === "ssh")
    .map((columns) => columns[1])
    .filter(Boolean);

  if (pids.length === 0) {
    console.log(ui.warn(`No SSH tunnel found for port ${port}.`));
    return;
  }

  let hadError = false;
  for (const pid of pids) {
    console.log(`${ui.info("Killing SSH tunnel (PID:")} ${ui.accent(pid)}${ui.info(")...")}`);
    const killed = spawnSync("kill", [pid], { stdio: "inherit" });
    if (killed.status !== 0) {
      hadError = true;
    }
  }

  if (hadError) {
    throw new Error("Failed to stop one or more tunnels.");
  }

  console.log(ui.success("✔ Tunnel stopped."));
}

function runWeb(config) {
  const ui = createUi(config.ui.accentColor);
  const port = config.defaults.webPort;

  console.log(ui.divider());
  console.log(ui.heading("OpenClaw Gateway Web UI"));
  console.log(ui.divider());
  console.log(`${ui.info("Local:")} ${ui.accent(`http://localhost:${port}`)}`);
  console.log(
    `${ui.info("Forward:")} 127.0.0.1:${port} -> ${config.sshDest}:127.0.0.1:${port}`
  );
  console.log("");
  console.log(ui.success("Tunnel is active."));
  console.log(ui.muted("Press Ctrl+C to close it."));
  console.log(ui.divider());

  const child = spawn(
    "ssh",
    [
      "-N",
      "-T",
      "-o",
      `ServerAliveInterval=${config.ssh.serverAliveInterval}`,
      "-o",
      `ServerAliveCountMax=${config.ssh.serverAliveCountMax}`,
      "-L",
      `${port}:127.0.0.1:${port}`,
      config.sshDest
    ],
    { stdio: "inherit" }
  );

  process.on("SIGINT", () => {
    child.kill("SIGINT");
  });

  child.on("exit", (code, signal) => {
    if (signal === "SIGINT" || code === 130) {
      console.log("");
      console.log(ui.warn("Tunnel closed."));
      console.log(ui.divider());
      process.exit(0);
    }
    process.exit(code || 1);
  });
}

function runSsh(config) {
  const ui = createUi(config.ui.accentColor);
  console.log(ui.divider());
  console.log(ui.heading("OpenClaw SSH"));
  console.log(`${ui.info("Connecting to:")} ${ui.accent(config.sshDest)}`);
  console.log(ui.divider());
  const child = spawn("ssh", [config.sshDest], { stdio: "inherit" });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(1);
    }
    process.exit(code || 0);
  });
}

module.exports = {
  parsePort,
  runMc,
  runKill,
  runWeb,
  runSsh
};
