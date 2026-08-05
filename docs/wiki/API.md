# API Reference

The E3CNC UI project exposes two API surfaces: the **CNC agent** HTTP endpoints (mounted under `/server/cnc/` in Moonraker) and the **MCP server** tools (for AI agent integration).

---

## CNC Agent HTTP Endpoints

Registered by the `[cnc_agent]` Moonraker component.

| Endpoint | Methods | Description |
|---|---|---|
| `/server/cnc/state` | GET | Full agent state snapshot (spindle, coolant, units, WCS, settings, profile) |
| `/server/cnc/spindle` | GET | Get spindle state (state, rpm, override) |
| `/server/cnc/spindle` | POST | Set spindle state. Payload: `{"state": "cw"\|"ccw"\|"off", "rpm": 12000}` |
| `/server/cnc/coolant` | GET | Get coolant state (flood, mist) |
| `/server/cnc/coolant` | POST | Set coolant state. Payload: `{"flood": true\|false, "mist": true\|false}` |
| `/server/cnc/units` | GET | Get current units (`"G20"` or `"G21"`) |
| `/server/cnc/units` | POST | Set units. Payload: `{"units": "G20"\|"G21"}` |
| `/server/cnc/wcs` | GET | Get all WCS offset tables and active selection |
| `/server/cnc/wcs/select` | POST | Select active WCS. Payload: `{"wcs": "G54"\|"G55"\|"G56"\|"G57"\|"G58"\|"G59"}` |
| `/server/cnc/wcs/set-zero` | POST | Set work zero. Payload: `{"axes": ["X", "Y"]}` or `{"axis": "Z"}` |
| `/server/cnc/jog` | POST | Execute a jog move. Payload: `{"axis": "X", "distance": 5.0, "feedrate": 100}` |
| `/server/cnc/settings` | GET | Get CNC dashboard settings |
| `/server/cnc/settings` | POST | Update CNC dashboard settings. Payload: arbitrary JSON patch |

### Spindle POST payload

```json
{
  "state": "cw",       // "cw", "ccw", or "off"
  "rpm": 12000,        // optional, spindle speed
  "override": 0.75     // optional, speed override factor
}
```

Sends `M3 S12000` or `M4 S12000` or `M5` accordingly.

### Coolant POST payload

```json
{
  "flood": true,       // M8
  "mist": false        // M7 (set both false → M9)
}
```

### Jog POST payload

```json
{
  "axis": "X",
  "distance": 5.0,
  "feedrate": 100
}
```

Sends `G91 G1 X5 F6000` wrapped in `SAVE_GCODE_STATE`/`RESTORE_GCODE_STATE`. Feedrate is converted from mm/s to mm/min (`F = feedrate × 60`). Jog operations are rate-limited per axis (default 50ms between jogs on the same axis).

### WCS select

```json
{
  "wcs": "G55"
}
```

### Set zero

```json
{
  "axes": ["X", "Z"]
}
```

Defaults to all axes (`["X", "Y", "Z"]`) if omitted. Sends `G10 L20 P<n> X0 Z0` where `P<n>` maps G54→1, G55→2, etc. Rejects `G53` (machine coordinates).

---

## MCP Server Tools

The MCP server (`moonraker-mcp`) exposes Moonraker API functionality as MCP tools for AI agents. There are **13 tools** across 8 capability areas.

### Running

```bash
moonraker-mcp    # after pip install -e .
```

Environment: `MOONRAKER_URL` (default `http://127.0.0.1:7125`), `MOONRAKER_API_KEY`, `MOONRAKER_TIMEOUT` (default `15`).

---

### 1. Server & Configuration

| Tool | Parameters | What it returns |
|---|---|---|
| `moonraker_server_info` | — | Moonraker version, API version, loaded components list |
| `moonraker_server_config` | — | Full parsed `moonraker.conf` — all sections, all settings |

**Use cases:** Check Moonraker is running, verify config, see what components are loaded.

---

### 2. Printer & Klipper State

| Tool | Parameters | What it returns |
|---|---|---|
| `moonraker_printer_info` | — | Klippy state (`ready`/`error`/`shutdown`), firmware version, CPU info, host details |
| `moonraker_printer_objects_list` | — | All loaded Klipper printer objects (toolhead, extruder, heater_bed, gcode_move, print_stats, fan, etc.) |

**Use cases:** Check if Klipper is running, discover everything that can be queried.

---

### 3. Query Detailed Printer State

| Tool | Parameters |
|---|---|
| `moonraker_query_printer_objects` | `objects`: mapping of object names to attribute lists |

Pass a mapping like:
```json
{
  "toolhead": ["position", "status"],
  "extruder": ["temperature", "target"],
  "gcode_move": null
}
```

**What you can query on each object:**

| Object | Fields you can read |
|---|---|
| `toolhead` | Position (X/Y/Z), velocity, homed flags, max velocity/acceleration |
| `gcode_move` | G-code position, absolute/relative mode, speed factor, extruder factor |
| `extruder` | Temperature, target, power, pressure_advance |
| `heater_bed` | Temperature, target |
| `heater_generic …` | Any named heater — temperature, target |
| `temperature_sensor …` | Any named sensor — temperature, measured_min_temp, measured_max_temp |
| `fan` | Speed, rpm |
| `print_stats` | State (standby/printing/paused/complete/error), filename, total_duration, filament_used, message |
| `configfile` | Full current Klipper config settings |
| `mcu` | MCU version, build/uptime info, last_stats |
| `system_stats` | Sysload, cputime, memavail |
| `display_status` | Progress, message |
| `gcode_macro …` | Any custom macro — evaluate and read macro variables |
| `work_coordinate_systems` | (E3CNC plugin) Per-WCS offset tables (G54–G59), active WCS, machine mode |
| `motion_report` | Live position data from the MCU |
| `endstop` | Endstop states and position at trigger |
| `probe` | Probe state, last result, deployed/retracted |
| `pause_resume` | Is paused, virtual SDCard position |

**Use cases:** Check all temperatures, see current position/feedrate/mode, verify a job is running/paused/finished, evaluate macro variables, read WCS offsets, monitor system load.

---

### 4. G-Code Control

| Tool | Parameters | What it does |
|---|---|---|
| `moonraker_gcode_help` | — | List all registered G-code commands with help text |
| `moonraker_send_gcode` | `script`: any G-code string | Send arbitrary G-code to Klipper |

**What you can send (examples):**

| Category | Examples |
|---|---|
| **Motion** | `G28` (home all), `G28 X Y` (home X and Y only), `G1 X10 F3000` (linear move), `G90`/`G91` (absolute/relative), `G53 G0 X0` (machine-coordinate move) |
| **Spindle** | `M3 S12000` (spindle CW at 12000 RPM), `M4 S8000` (spindle CCW), `M5` (spindle stop) |
| **Coolant** | `M7` (mist coolant on), `M8` (flood coolant on), `M9` (all coolant off) |
| **Feedrate** | `M220 S50` (set feedrate override to 50%), `M220` (report current override) |
| **WCS** | `G54`/`G55`/`G56`/`G57`/`G58`/`G59` (select work coordinate system), `G10 L20 P1 X0 Y0 Z0` (set zero on G54) |
| **Dwell** | `G4 P2000` (dwell 2000ms) |
| **Probing** | `G38.2 Z-10 F100` (straight probe), `G30` (bed/probe Z) |
| **Job control** | `M23 filename.gcode` (set file), `M24` (start/resume), `M25` (pause), `M601` (pause), `M602` (resume) |
| **Macros** | Any registered `[gcode_macro]` name (e.g. `START_PRINT`, `END_PRINT`, custom CNC macros) |
| **Status** | `M105` (report temperatures), `M119` (report endstop states) |

**Use cases:** Home axes, jog to position, set WCS, start/stop spindle, control coolant, pause/resume/cancel jobs, run macros, change coordinate modes, probe.

---

### 5. Job Queue & Print History

| Tool | Parameters | What it returns |
|---|---|---|
| `moonraker_job_queue_status` | — | Currently running job, queued jobs |
| `moonraker_history_list` | `limit` (default 50), `start` (offset), `since`, `before`, `order` (`asc`/`desc`) | Paginated history — per job: filename, start/end time, total duration, filament used, status, print settings |

**Use cases:** See what's queued, browse recent jobs, check how long a print took, find failed prints.

---

### 6. Webcams

| Tool | Parameters | What it returns |
|---|---|---|
| `moonraker_webcams_list` | — | Configured webcam entries — name, streaming URL, rotation, flip, aspect ratio, stream type (mjpeg/webrtc/hls) |

**Use cases:** List configured cameras, get the stream URL for embedding.

---

### 7. Host System Health

| Tool | Parameters | What it returns |
|---|---|---|
| `moonraker_system_info` | — | OS name/version, CPU cores/arch, system temps, service info (uptime, memory usage for Klipper+Moonraker) |
| `moonraker_proc_stats` | — | Current CPU usage, memory, network I/O |

**Use cases:** Check if the host is overheating, running out of memory, or overloaded.

---

### 8. Raw Endpoint Access

| Tool | Parameters |
|---|---|
| `moonraker_request` | `method` (GET/POST/DELETE), `path` (relative URL), `params` (query string), `body` (JSON payload) |

This can reach **any** Moonraker endpoint not covered by the dedicated tools:

| Category | Examples |
|---|---|
| **Services** | `GET /machine/services` (list services), `POST /machine/services/restart?name=moonraker` (restart service) |
| **Files** | `GET /server/files/list?root=gcodes` (list files), `DELETE /server/files/gcodes/test.gcode` (delete file), `POST /server/files/upload` (upload via multipart) |
| **Database** | `GET /server/database/item?namespace=GCODE_METADATA&key=file.gcode` (read metadata), `POST /server/database/item` (write to database) |
| **Config** | `GET /printer/configfile` (full current Klipper config) |
| **Endstops** | `GET /printer/endstops` (all endstop states) |
| **MCU** | `GET /printer/mcu/interrupt` (MCU interrupt status) |
| **Power** | `GET /machine/device_power/devices` (list power devices), `POST /machine/device_power/on?device=...` |

**Use cases:** Anything not covered by the other tools — manage files, read/write the database, restart services, control power devices, query raw endstops.

---

### AI Agent Integration

Register `moonraker-mcp` as a stdio MCP server in your AI agent's config:

**Claude Desktop** (`claude_desktop_config.json`):
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

**Cursor** (`.cursor/mcp.json` or Settings → MCP):
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

**VS Code (Continue)** (`~/.continue/config.json`):
```json
{
  "experimental": {
    "mcpServers": [
      {
        "name": "moonraker",
        "command": "moonraker-mcp",
        "env": { "MOONRAKER_URL": "http://192.168.1.100:7125" }
      }
    ]
  }
}
```
