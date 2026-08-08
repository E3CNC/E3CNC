# E3CNC Docker Development Environment

Run a full-stack Moonraker + Klipper + simulator MCU locally for frontend
development and visual QA. Unlike the old static mock, this environment runs
the real Klipper G-code parser and Moonraker API server — every G-code flows
through Klipper's Jinja2 macro engine, and state changes propagate back to
the UI exactly as they would on a real CNC machine.

## Quick Start

```bash
# Build and start the full-stack simulator
cd docker
docker compose up -d --build

# Verify it's running
curl http://localhost:7125/server/info

# Start the frontend dev server
cd ..
VITE_DEV_PROXY_TARGET=http://localhost:7125 bun run dev
```

Then open `http://localhost:5173` in your browser.

## What's Inside

The container runs three processes in dependency order:

```
┌───────────────────────────────────────────────┐
│  Container (e3cnc-moonraker-dev)               │
│                                                 │
│  Moonraker ──UDS── Klippy ──PTY── Simulator MCU│
│  (API server)     (G-code)    (virtual CNC)     │
│  Port 7125         /tmp/        stdin/stdout    │
│                    klippy_uds   via socat        │
└───────────────────────────────────────────────┘
```

| Process | Description |
|---------|-------------|
| **Simulator MCU** | Klipper firmware compiled for `CONFIG_MACH_SIMU=y`. Runs as a Linux userspace process, communicates via PTY. |
| **Klippy** | Real Klipper host process. Parses `printer.cfg`, executes G-code, tracks machine state. |
| **Moonraker** | Real Moonraker API server. Proxies WebSocket/HTTP to Klippy via Unix Domain Socket. |

## Configuration Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build: GCC stage compiles Klipper simulator, Python stage runs stack |
| `compose.yaml` | Docker Compose service definition (`moonraker-dev`) |
| `entrypoint.sh` | Container entrypoint: starts processes in order, health check |
| `printer.cfg` | Klipper config for cartesian CNC machine with spindle, coolant, WCS |
| `moonraker.conf` | Moonraker config mirroring production E3CNC setup |

## Usage

```bash
# Build (recompiles simulator MCU + reinstalls Python deps)
docker compose build

# Start
docker compose up -d

# View logs (all three process logs visible)
docker compose logs -f

# Check health
docker compose ps

# Stop
docker compose down

# Full rebuild (no cache)
docker compose build --no-cache
```

## Development Workflow

```bash
# 1. Start the simulator
cd docker && docker compose up -d && cd ..

# 2. Wait for healthy (Klippy ready)
until curl -sf http://localhost:7125/server/info | grep -q '"klippy_state":"ready"'; do
  sleep 2
done

# 3. Start the frontend dev server
VITE_DEV_PROXY_TARGET=http://localhost:7125 bun run dev
```

## Verification

Once running, verify the stack is working:

```bash
# Moonraker info
curl http://localhost:7125/server/info

# List available printer objects
curl http://localhost:7125/printer/objects/list

# Query toolhead position
curl 'http://localhost:7125/printer/objects/query?toolhead'

# Send G-code (via WebSocket or HTTP API)
# See Moonraker docs for G-code API
```

## Notes

- This is a **development environment** — it does not control real hardware.
- The simulator MCU has stub GPIO: spindle and coolant state is tracked but no actual hardware is controlled.
- The Moonraker database is ephemeral and resets on container restart.
- All three processes must be running for the stack to be healthy.
- If Klippy fails to connect to the MCU, the health check will report unhealthy.
- Logs for all processes are visible via `docker compose logs -f`.
- Rebuild after changes to `vendor/klipper/` to recompile the simulator MCU.