## 1. Build Infrastructure

- [x] 1.1 Create new Dockerfile in `docker/` using multi-stage build (build stage with GCC, runtime with Python)
- [x] 1.2 Configure Klipper `.config` for simulator target (`CONFIG_MACH_SIMU=y`) and build `klipper.elf`
- [x] 1.3 Install Moonraker Python dependencies and Klippy dependencies in the runtime stage
- [x] 1.4 Update `docker/compose.yaml` — rename service to `moonraker-dev`, rebuild from new Dockerfile

## 2. Container Entrypoint

- [x] 2.1 Create `docker/entrypoint.sh` that starts processes in order (simulator MCU → Klippy → Moonraker)
- [x] 2.2 Implement PTY creation: create a pseudo-terminal pair, wire simulator MCU stdin/stdout to slave side
- [x] 2.3 Add health check: wait for Klippy to reach `ready` state before signaling container healthy

## 3. CNC Printer Config

- [x] 3.1 Create `docker/printer.cfg` with cartesian kinematics, three stepper axes (X/Y/Z), and simulator MCU serial path
- [x] 3.2 Add `[spindle]` section with S-word, M3/M4/M5 support (NOOP hardware, real state tracking)
- [x] 3.3 Add `[coolant]` section with M7/M8/M9 support (NOOP hardware, real state tracking)
- [x] 3.4 Add `[work_coordinate_systems]` section supporting G54–G59
- [x] 3.5 Include E3CNC macros: `wcs_macros.cfg`, `e3cnc_macros.cfg`, `cnc_base.cfg` via `[include]`

## 4. Moonraker Dev Config

- [x] 4.1 Create `docker/moonraker.conf` matching production config: `[server]`, `[authorization]`, CORS, `[cnc_agent]`, `[cnc_metadata]`
- [x] 4.2 Set `klippy_uds_address` to `/tmp/klippy_uds` (shared with Klippy)
- [x] 4.3 Enable debug mode and set database to ephemeral path

## 5. Remove Old Mock (Cleanup)

- [x] 5.1 Remove `docker/moonraker-mock/Dockerfile`
- [x] 5.2 Remove `docker/moonraker-mock/moonraker-mock.py`
- [x] 5.3 Update `docker/README.md` to document the new full-stack setup

## 6. Verification

- [x] 6.1 `docker compose build` succeeds (simulator compiles, Python deps install)
- [x] 6.2 `docker compose up -d` starts and container becomes healthy
- [x] 6.3 `curl http://localhost:7125/server/info` returns Moonraker info with `klippy_state: "ready"`
- [x] 6.4 WebSocket connects from Vite dev server and dashboard renders with live state
- [x] 6.5 Jog command from UI updates toolhead position and DRO reflects the change
- [x] 6.6 Spindle M3/M5 commands toggle spindle state in the UI
- [x] 6.7 G-code via MDI/Console is processed and output returned