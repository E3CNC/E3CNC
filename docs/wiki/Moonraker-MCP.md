# Moonraker MCP

The Moonraker MCP server is a stdio-based [Model Context Protocol](https://modelcontextprotocol.io) server that exposes Moonraker's API as tools for AI agents.

It is part of the `moonraker/` package in this repo and ships alongside the CNC agent.

## What's inside

| Component | Purpose |
|---|---|
| **CNC agent** (`cnc_agent.py`) | Moonraker component registered under `[cnc_agent]` — owns spindle, coolant, units, WCS, jog, and settings state. Vended into `moonraker/moonraker/components/` during install. |
| **MCP server** (`moonraker/mcp/mcp_server.py`) | Standalone stdio MCP server that exposes Moonraker's API as MCP tools for AI agents. |

## Quick Start

### 1. Install

Recommended:

```bash
cd ~/E3CNC/moonraker
pip install -e .
moonraker-mcp
```

Or run directly without installing:

```bash
cd ~/E3CNC/moonraker
PYTHONPATH=. python -m moonraker.mcp.mcp_server
```

### 2. Set the printer address

By default the server connects to `http://127.0.0.1:7125`.

If Moonraker is on another machine:

```bash
export MOONRAKER_URL="http://192.168.1.100:7125"
```

If auth is enabled:

```bash
export MOONRAKER_API_KEY="your-api-key"
```

### 3. Register with your AI agent

Example Claude Desktop config:

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

The same pattern works for Cursor, Continue, Windsurf, Copilot, Codex CLI, and other MCP-compatible clients: run `moonraker-mcp` as a subprocess and set `MOONRAKER_URL`.

## Exposed MCP Tools

The server exposes 13 tools:

| Tool | Moonraker Endpoint | What it does |
|---|---|---|
| `moonraker_server_info` | `GET /server/info` | Moonraker version, loaded components |
| `moonraker_server_config` | `GET /server/config` | Parsed `moonraker.conf` |
| `moonraker_printer_info` | `GET /printer/info` | Klippy host info |
| `moonraker_printer_objects_list` | `GET /printer/objects/list` | Loaded Klipper objects |
| `moonraker_query_printer_objects` | `POST /printer/objects/query` | Query printer object state |
| `moonraker_gcode_help` | `GET /printer/gcode/help` | Supported G-code commands |
| `moonraker_send_gcode` | `POST /printer/gcode/script` | Send G-code to Klipper |
| `moonraker_job_queue_status` | `GET /server/job_queue/status` | Job queue state |
| `moonraker_history_list` | `GET /server/history/list` | Print history |
| `moonraker_webcams_list` | `GET /server/webcams/list` | Configured webcams |
| `moonraker_system_info` | `GET /machine/system_info` | Host OS and service info |
| `moonraker_proc_stats` | `GET /machine/proc_stats` | Process statistics |
| `moonraker_request` | Generic | Raw request to any Moonraker endpoint |

## Example prompts

- "What's the printer status?"
- "Home all axes with G28"
- "Set spindle to 12000 RPM clockwise"
- "Show the last 10 print jobs"
- "What webcams are configured?"

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `MOONRAKER_URL` | `http://127.0.0.1:7125` | Moonraker API base URL |
| `MOONRAKER_API_KEY` | none | API key if auth is enabled |
| `MOONRAKER_TIMEOUT` | `15` | Request timeout in seconds |

## Network Notes

- The MCP server runs on your **development machine**, not the printer.
- It connects to Moonraker over HTTP.
- Add your dev machine IP to Moonraker's `[authorization] trusted_clients` if needed.
- Default Moonraker port is `7125`.

## Installing E3CNC on the printer

To install the CNC agent and the rest of E3CNC on a printer, use the main installer:

```bash
cd ~/E3CNC
./e3cnc-cli install
```

For updates, use:

```bash
./e3cnc-cli update
./e3cnc-cli rollback
./e3cnc-cli releases
```

E3CNC no longer relies on Moonraker's `[update_manager]` for stack updates.
