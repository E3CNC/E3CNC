## Context

The current `docker/moonraker-mock/` is a lightweight Python script that responds to a subset of Moonraker's HTTP/WebSocket API with static, hardcoded state. It's useful for layout testing but cannot simulate real interactions: jogging doesn't update position, G-code isn't parsed, and state never mutates.

The project vendors both Moonraker (`vendor/moonraker/`) and Klipper (`vendor/klipper/`), including Klipper's host simulator MCU (`src/simulator/`). This makes a full-stack local dev environment feasible without any real hardware.

## Goals / Non-Goals

**Goals:**
- Replace `docker/moonraker-mock/` with a container running the real Moonraker + Klipper
- Build Klipper's simulator MCU firmware (`CONFIG_MACH_SIMU=y`) inside the container
- Provide a standard CNC `printer.cfg` for the simulated machine
- Provide a Moonraker dev config matching production E3CNC setup
- All state changes (jog, spindle, coolant, etc.) flow through real Klipper G-code processing
- Preserve the existing dev workflow: `docker compose up` + `bun run dev`

**Non-Goals:**
- Real-time machine control or kinematics simulation accuracy (this is for UI dev, not CAM validation)
- Mocking every possible error condition
- Supporting multiple printer kinematics types (cartesian only)
- Persisting Moonraker database across container restarts (in-memory is fine for dev)

## Decisions

### Decision: Single container with init process
All three processes (Moonraker → Klippy → Simulator MCU) share one container via Docker Compose entrypoint. Uses a shell script or supervisord-lite to start processes in dependency order.

**Rationale**: The Unix Domain Socket between Moonraker and Klippy, plus the PTY between Klippy and the MCU simulator, require shared filesystem access. Separate containers would need volume mounts for the UDS and PTY, adding complexity with no benefit for a dev environment.

### Decision: PTY for Klippy↔MCU serial
Klippy's `serialhdl.py` expects a serial device for MCU communication. A pseudo-terminal (PTY) pair bridges the C simulator binary and Klippy's Python serial layer.

```
┌───────────────────────────────────────────────┐
│  Container                                     │
│                                                │
│  Klippy ─── /dev/pts/X ──── Simulator MCU     │
│  (Python)    (PTY master)   (C binary, reads   │
│                              stdin/stdout via   │
│                              PTY slave)         │
└───────────────────────────────────────────────┘
```

### Decision: CNC-relevant printer objects only
The `printer.cfg` omits 3D-printer-specific sections (extruder, heater_bed, fans) and includes CNC-relevant objects: stepper axes (X/Y/Z), spindle, coolant, work coordinate systems, probe, endstops, and all E3CNC macros.

### Decision: NOOP for `[spindle]` and `[coolant]` in simulator
The simulator MCU has stub GPIO — it can't actually spin a spindle. The vendored E3CNC Klipper does **not** ship the native `[spindle]` / `[coolant]` modules (they were never part of this fork). Rather than upgrade vendored Klipper, spindle/coolant are implemented as gcode macros (`docker/spindle_coolant.cfg`) that track real state in a shared `_CNC_STATE` variables object (spindle state/speed, coolant type). The UI sees real state transitions (spindle speed, coolant on/off) via `printer.gcode_macro _CNC_STATE` — no hardware.

### Decision: Simulator serial layer reads stdin
The vendored `src/simulator/serial.c` is an upstream *example* that never calls `serial_rx_byte()` (the receive path is commented out), so the MCU can't accept commands. Since the spec requires the simulator to "accept serial communication via stdin/stdout", `serial.c` is normalized to read stdin via a self-waking poll task and feed the Klipper receive buffer. This is a minimal, required deviation from "no Klipper source changes."

### Decision: Moonraker config mirrors production
The `moonraker.conf` in Docker matches the production E3CNC config (`config/moonraker/moonraker.conf.example`) closely, including `[cnc_agent]`, `[cnc_metadata]`, authorization, and CORS. Differences: debug mode enabled, database path set to a temp dir, no Klipper service management.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Klipper startup is slow (config parsing, MCU handshake) | Container health check waits for Klippy to reach `ready` state before signaling healthy |
| Simulator MCU binary build adds to image build time | Cache the build outputs; only rebuild when Klipper source changes |
| PTY setup is OS-specific | Entrypoint script uses `socat` or `openpty()` in Python to create the PTY |
| Container size grows (Python + build toolchain) | Multi-stage Docker build: build stage has GCC, runtime stage copies only the binary + Python deps |