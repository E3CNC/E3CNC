# Moonraker MCP

A Moonraker component and MCP (Model Context Protocol) server for the E3CNC UI project.

## What's inside

This package contains two things:

| Component | Purpose |
|---|---|
| **CNC agent** (`cnc_agent.py`) | Moonraker component registered under `[cnc_agent]` — owns spindle, coolant, units, WCS, jog, and settings state. Vended into `moonraker/moonraker/components/` during install. |
| **MCP server** (`mcp_server.py`) | A standalone stdio-based MCP server that exposes Moonraker's API as MCP tools for AI agents. |

## CNC Agent

The CNC agent owns CNC-specific state that Klipper does not model:

- spindle state and control (`state`, `rpm`, `override`)
- coolant state and control (`flood`, `mist`)
- units tracking (`G20`/`G21`)
- active work coordinate system (`G54`..`G59`, `G53`) and per-WCS offsets
- safe jog / set-zero / WCS-select command endpoints
- CNC dashboard settings persistence (separate from Mainsail's settings)
- machine profile loading for capability/safety/frontend feature gating

It registers HTTP endpoints under `/server/cnc/*`:

| Endpoint | Methods | Description |
|---|---|---|
| `/server/cnc/state` | GET | Full agent state snapshot |
| `/server/cnc/spindle` | GET, POST | Read or control spindle (M3/M4/M5) |
| `/server/cnc/coolant` | GET, POST | Read or control coolant (M7/M8/M9) |
| `/server/cnc/units` | GET, POST | Read or set units (G20/G21) |
| `/server/cnc/wcs` | GET | Query WCS offsets from Klipper |
| `/server/cnc/wcs/select` | POST | Select active WCS (G54–G59) |
| `/server/cnc/wcs/set-zero` | POST | Set work zero at current position (G10 L20) |
| `/server/cnc/jog` | POST | Execute a guarded jog move |
| `/server/cnc/settings` | GET, POST | Read or persist CNC dashboard settings |

Read-only Klipper machine state is **not** re-exposed — the frontend reads it directly from Mainsail's existing websocket store subscription.

## MCP Server

The MCP server connects to a running Moonraker instance and exposes 13 tools that AI agents can call.

### 13 Exposed MCP Tools

| Tool | Moonraker Endpoint | What it does |
|---|---|---|
| `moonraker_server_info` | `GET /server/info` | Moonraker version, loaded components |
| `moonraker_server_config` | `GET /server/config` | Parsed moonraker.conf |
| `moonraker_printer_info` | `GET /printer/info` | Klippy host info |
| `moonraker_printer_objects_list` | `GET /printer/objects/list` | Loaded Klipper objects |
| `moonraker_query_printer_objects` | `POST /printer/objects/query` | Query printer object state |
| `moonraker_gcode_help` | `GET /printer/gcode/help` | Supported G-code commands |
| `moonraker_send_gcode` | `POST /printer/gcode/script` | Send G-code to Klipper |
| `moonraker_job_queue_status` | `GET /server/job_queue/status` | Job queue state |
| `moonraker_history_list` | `GET /server/history/list` | Print history (filterable) |
| `moonraker_webcams_list` | `GET /server/webcams/list` | Configured webcams |
| `moonraker_system_info` | `GET /machine/system_info` | Host OS and service info |
| `moonraker_proc_stats` | `GET /machine/proc_stats` | Process statistics |
| `moonraker_request` | Generic | Raw request to any Moonraker endpoint |

### Running the MCP server

**Option A — install from PyPI (recommended):**

```bash
pip install moonraker-mcp
moonraker-mcp
```

**Option B — install from source:**

```bash
cd E3CNC/moonraker-mcp
pip install -e .
moonraker-mcp
```

**Option C — run directly (no install):**

```bash
cd E3CNC/moonraker-mcp
PYTHONPATH=src python -m moonraker_mcp.mcp_server
```

### Environment variables

| Env Var | Default | Purpose |
|---|---|---|
| `MOONRAKER_URL` | `http://127.0.0.1:7125` | Moonraker API base URL |
| `MOONRAKER_API_KEY` | (none) | API key if Moonraker auth is configured |
| `MOONRAKER_TIMEOUT` | `15` | Request timeout in seconds |

### Connecting to AI Agents

The MCP server uses **stdio transport** — it communicates via stdin/stdout. Register it in your AI agent's MCP configuration.

#### Claude Desktop

Add to `claude_desktop_config.json` (typically at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "moonraker": {
      "command": "moonraker-mcp",
      "args": [],
      "env": {
        "MOONRAKER_URL": "http://192.168.1.100:7125"
      }
    }
  }
}
```

If you didn't `pip install -e .`, use the full Python path:

```json
{
  "mcpServers": {
    "moonraker": {
      "command": "/usr/bin/python3",
      "args": ["-m", "moonraker_mcp.mcp_server"],
      "env": {
        "MOONRAKER_URL": "http://192.168.1.100:7125"
      }
    }
  }
}
```

#### Cursor

Go to **Settings → MCP → Add New MCP Server** and fill in:

- **Name**: `moonraker`
- **Type**: `command`
- **Command**: `moonraker-mcp`
- **Env** (optional): `MOONRAKER_URL=http://192.168.1.100:7125`

Or add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "moonraker": {
      "command": "moonraker-mcp",
      "args": [],
      "env": {
        "MOONRAKER_URL": "http://192.168.1.100:7125"
      }
    }
  }
}
```

#### VS Code (Continue extension)

Add to `~/.continue/config.json`:

```json
{
  "experimental": {
    "mcpServers": [
      {
        "name": "moonraker",
        "command": "moonraker-mcp",
        "env": {
          "MOONRAKER_URL": "http://192.168.1.100:7125"
        }
      }
    ]
  }
}
```

#### Windsurf

Add to your Windsurf MCP config:

```json
{
  "mcpServers": {
    "moonraker": {
      "command": "moonraker-mcp",
      "env": {
        "MOONRAKER_URL": "http://192.168.1.100:7125"
      }
    }
  }
}
```

#### Any MCP-compatible agent

The pattern is always the same: register a subprocess that runs `moonraker-mcp` (or `python -m moonraker_mcp.mcp_server`) with `MOONRAKER_URL` set to your printer's Moonraker address.

### Example AI prompts

Once connected, an AI agent can use the tools. Some examples:

> **"What's the printer status?"**
> → calls `moonraker_printer_info` + `moonraker_query_printer_objects`

> **"Home all axes"**
> → calls `moonraker_send_gcode({ "script": "G28" })`

> **"Set spindle to 12000 RPM clockwise"**
> → calls `moonraker_send_gcode({ "script": "M3 S12000" })`

> **"Show the last 10 print jobs"**
> → calls `moonraker_history_list({ "limit": 10 })`

> **"What webcams are configured?"**
> → calls `moonraker_webcams_list`

> **"List all loaded Klipper objects"**
> → calls `moonraker_printer_objects_list`

### Network notes

- The MCP server runs on the **same machine as the AI agent** (your dev machine). It connects to Moonraker over HTTP.
- If Moonraker is on a different machine (the printer), set `MOONRAKER_URL` to the printer's IP (e.g. `http://192.168.1.100:7125`).
- Make sure your dev machine's IP is in Moonraker's `trusted_clients` list (in `moonraker.conf`).

## Installing the CNC Agent on a Printer

### Ansible playbook (recommended)

```sh
cd ~/E3CNC
ansible-playbook ansible/playbooks/install.yml
```

This vendors the CNC agent into Moonraker, configures `[cnc_agent]` and `[cnc_metadata]` sections, deploys the WCS plugin and macros, builds the frontend, and restarts services.

### Legacy bash script

```sh
cd ~/E3CNC
./scripts/install_to_moonraker.sh
```

## Updating E3CNC

E3CNC no longer relies on Moonraker's `update_manager` for its own stack updates.

Use one of these supported paths instead:

- **In-app:** E3CNC top-corner menu → **Update** / **Rollback**
- **CLI:** `./e3cnc-cli update`, `./e3cnc-cli rollback`, `./e3cnc-cli releases`

The Moonraker CNC agent exposes the update/rollback endpoints used by the in-app menu, and `e3cnc-cli update` remains the source of truth for full-stack deployment.

`build-scripts/post_update.sh` is kept as a compatibility wrapper around `./e3cnc-cli update --yes`, but new installs no longer register an `[update_manager E3CNC]` block in `moonraker.conf`.
