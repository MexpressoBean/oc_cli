# oc-cli

Personal local CLI for common OpenClaw VPS workflows (SSH tunnels + Mission Control helpers).

## Requirements

- macOS (uses `open` command)
- Node.js 18+ (recommended)
- `ssh`, `lsof`, and `kill` available in your shell

## Install

```bash
npm install
```

Optional (so you can run `oc` globally from any folder during development):

```bash
npm link
```

## Configuration

Create your local config file:

```bash
cp oc.config.example.json oc.config.json
```

Then edit `oc.config.json` with your VPS details.

Recommended (works from any directory): copy your config to the global location:

```bash
mkdir -p ~/.oc-cli
cp oc.config.json ~/.oc-cli/config.json
```

After this, `oc ...` commands work no matter where you run them from.

### Config lookup order

The CLI loads config from the first location that exists:

1. `OC_CONFIG_PATH` (if set)
2. `./oc.config.json` (current working directory)
3. `~/.oc-cli/config.json`

Tip: if you run `oc` from many different directories, prefer `~/.oc-cli/config.json`.

### Required config fields

- `ssh.user`
- `ssh.host`
- `missionControl.remoteDir`

### Optional UI config

- `ui.accentColor` - hex color for headings/accent text (format: `#RRGGBB`)
- Default: `#ff6b6b`

### Environment overrides

These env vars override file values:

- `OC_SSH_USER`
- `OC_SSH_HOST`
- `OC_REMOTE_DIR`
- `OC_WEB_PORT`
- `OC_MC_PORT`
- `OC_SERVER_ALIVE_INTERVAL`
- `OC_SERVER_ALIVE_COUNT_MAX`
- `OC_READY_MAX_TRIES`
- `OC_READY_DELAY_MS`
- `OC_ACCENT_COLOR`

## Usage

Show help:

```bash
oc --help
oc mc --help
```

### `oc ssh`

Opens an interactive SSH session to your configured VPS target (`ssh.user@ssh.host`).

### `oc web`

Opens a foreground SSH tunnel for the OpenClaw web UI using configured web port.

- Runs until you press `Ctrl+C`
- Prints tunnel details in terminal

### `oc mc [port]`

Mission Control helper flow:

1. Ensures local SSH tunnel exists on `port` (or default MC port).
2. Checks if remote dev server is already listening.
3. Starts remote `npm run dev` if needed.
4. Waits for readiness.
5. Opens browser to `http://localhost:<port>`.

### `oc mc kill [port]`

Kills local SSH tunnel process(es) matching `-L <port>:127.0.0.1:<port>`.

## Development

Run syntax checks:

```bash
npm run check
```

Project structure:

- `oc.js` - CLI entrypoint and Commander command tree
- `src/config.js` - config loading, overrides, validation
- `src/commands.js` - command implementations (`ssh`, `web`, `mc`, `mc kill`)
- `oc.config.example.json` - example config template

## Notes

- Local secrets/config are protected by `.gitignore` (`oc.config.json`, `.env*`, logs, `node_modules`).
- This tool is designed for personal/local use and easy incremental extension.
