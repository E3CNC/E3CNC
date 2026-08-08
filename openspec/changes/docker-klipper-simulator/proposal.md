## Why

The current Docker moonraker-mock serves static state data, which makes it impossible to test real UI interactions like jogging, G-code execution, spindle control, and dynamic state updates. Running a real Moonraker connected to a simulator-mode Klipper gives a fully realistic local development environment — every G-code flows through Klipper's parser and Jinja2 macro engine, and state changes propagate back to the UI exactly as they would on a real CNC machine.

## What Changes

- Build a Klipper MCU simulator binary (`CONFIG_MACH_SIMU`) from the vendored Klipper source
- Run Klippy (the real Klipper host process) in the container, configured for a cartesian CNC machine
- Run the real vendored Moonraker in the container, configured with the E3CNC `cnc_agent` component
- Wire Moonraker to Klippy via the standard Unix Domain Socket protocol
- Wire Klippy to the simulator MCU via a pseudo-terminal (PTY)
- Replace the existing `docker/moonraker-mock/` with this full-stack setup
- Update the dev workflow (`.env.development.local`, scripts, docs) to use the new container

## Capabilities

### New Capabilities

- `docker-cnc-simulator`: Full-stack Docker development environment running real Moonraker + Klipper + simulator MCU for local UI testing
- `klipper-mcu-simulator-build`: Build the Klipper MCU firmware with `CONFIG_MACH_SIMU=y` for the simulator target, producing a host-runnable binary
- `cnc-printer-config`: Klipper `printer.cfg` for a cartesian CNC machine with spindle, coolant, work coordinate systems, and E3CNC macros

### Modified Capabilities

- (none — first delta spec for this area)

## Impact

- **Docker**: Replaces `docker/moonraker-mock/` with a new multi-process container. The `docker/` directory gains a `Dockerfile`, a `printer.cfg`, a `moonraker.conf`, and an entrypoint script.
- **Vendored Klipper**: Minimal normalization of `src/simulator/serial.c` so the simulator reads stdin (the upstream example never calls `serial_rx_byte()`). Required for the MCU to "accept serial communication via stdin/stdout". No other Klipper source changes.
- **Dev workflow**: `docker compose up -d` now starts the full stack. `VITE_DEV_PROXY_TARGET=http://localhost:7125 bun run dev` remains the same.
- **Dependencies**: Docker image includes Python (Moonraker + Klippy), GCC toolchain (build simulator), and build tools.
