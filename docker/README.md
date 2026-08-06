# E3CNC Docker Development Environment

Run a Moonraker mock locally for frontend development and visual QA.

## Quick Start

```bash
# Build and start the Moonraker mock
cd docker
docker compose up -d

# Verify it's running
curl http://localhost:7125/server/info

# Start the frontend dev server pointing at the mock
cd ..
VITE_DEV_PROXY_TARGET=http://localhost:7125 bun run dev
```

Then open `http://localhost:5173` in your browser.

## What It Provides

The mock serves enough Moonraker API to render all E3CNC panels:

| Feature | Status |
|---------|--------|
| Dashboard, DRO, printer status | ✅ |
| Jog panel, feedrate controls | ✅ |
| WCS offsets (G54–G59) | ✅ |
| Spindle & Coolant | ✅ |
| MDI / Console | ✅ |
| G-code viewer (`/viewer`) | ✅ (no files) |
| Files / File management | ✅ (empty) |
| Settings persistence | ✅ |
| WebSocket connection | ✅ |

## Usage

```bash
# Start
docker compose -f docker/compose.yaml up -d

# Stop
docker compose -f docker/compose.yaml down

# View logs
docker compose -f docker/compose.yaml logs -f

# Rebuild (after changes to moonraker-mock.py)
docker compose -f docker/compose.yaml build
```

## Notes

- This is a **mock** — it doesn't run actual Klipper or control real hardware.
- It provides realistic state data for UI development and visual QA.
- The mock runs on the default Moonraker port (7125) to match production configs.
- The Vite dev server proxies `/websocket` and API paths to this mock.