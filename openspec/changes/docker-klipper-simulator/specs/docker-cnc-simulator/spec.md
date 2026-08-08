## ADDED Requirements

### Requirement: Single Docker Compose service
The system SHALL define a single Docker Compose service named `moonraker-dev` that runs all three processes (Moonraker, Klippy, Simulator MCU) inside one container.

#### Scenario: Compose file exists
- **WHEN** the user runs `docker compose -f docker/compose.yaml up -d`
- **THEN** a container named `e3cnc-moonraker-dev` SHALL start

#### Scenario: Port mapping
- **WHEN** the container is running
- **THEN** port 7125 SHALL be mapped to the host on port 7125

### Requirement: Container entrypoint starts processes in order
The container SHALL start processes in this dependency order:
1. Simulator MCU binary (creates the PTY)
2. Klippy (connects to MCU via PTY, opens UDS for Moonraker)
3. Moonraker (connects to Klippy via UDS)

#### Scenario: All processes running
- **WHEN** the container is healthy
- **THEN** all three processes SHALL be running inside the container

#### Scenario: Klippy not ready
- **WHEN** Klippy fails to start or connect to the MCU
- **THEN** Moonraker SHALL report `klippy_state: "disconnected"` and the container health check SHALL fail

### Requirement: Dev workflow unchanged
The developer workflow SHALL remain:
```bash
cd docker
docker compose up -d
cd ..
VITE_DEV_PROXY_TARGET=http://localhost:7125 bun run dev
```

#### Scenario: UI connects to containerized Moonraker
- **WHEN** the Vite dev server is started with `VITE_DEV_PROXY_TARGET=http://localhost:7125`
- **THEN** the UI SHALL connect to Moonraker via the Vite proxy and WebSocket SHALL establish

### Requirement: Container rebuild on source changes
The Docker image SHALL be rebuildable with `docker compose build` and SHALL recompile the simulator MCU and reinstall Python deps on each build.

#### Scenario: Rebuild after Klipper source change
- **WHEN** the user modifies a file under `vendor/klipper/` and runs `docker compose build`
- **THEN** the simulator MCU binary SHALL be recompiled

### Requirement: Logs visible
All three process logs SHALL be visible via `docker compose logs -f`.

#### Scenario: View logs
- **WHEN** the user runs `docker compose logs -f`
- **THEN** stdout/stderr from Moonraker, Klippy, and the simulator MCU SHALL be visible