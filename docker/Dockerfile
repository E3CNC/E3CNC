# E3CNC full-stack dev environment
#
# Builds Klipper MCU simulator binary (build stage), then installs
# Moonraker + Klippy Python deps in the runtime stage. The container
# runs all three processes: simulator MCU → Klippy → Moonraker.
#
# Multi-stage build keeps the final image lean — GCC toolchain stays
# in the build stage, only the compiled klipper.elf is copied across.

# ──────────────────────────────────────────────
# Build stage: compile Klipper for simulator target
# ──────────────────────────────────────────────
FROM gcc:13-bookworm AS builder

WORKDIR /klipper

# Copy Klipper source (vendored under vendor/klipper/)
COPY vendor/klipper/ ./

# Configure for simulator target (CONFIG_MACH_SIMU=y)
# Write config directly then run olddefconfig to resolve dependencies
RUN printf '%s\n' \
        '# CONFIG_MACH_AVR is not set' \
        '# CONFIG_MACH_ATSAM is not set' \
        '# CONFIG_MACH_ATSAMD is not set' \
        '# CONFIG_MACH_LPC176X is not set' \
        '# CONFIG_MACH_STM32 is not set' \
        '# CONFIG_MACH_HC32F460 is not set' \
        '# CONFIG_MACH_RPXXXX is not set' \
        '# CONFIG_MACH_PRU is not set' \
        '# CONFIG_MACH_AR100 is not set' \
        '# CONFIG_MACH_LINUX is not set' \
        'CONFIG_MACH_SIMU=y' \
    > .config && \
    make olddefconfig

# Build klipper.elf for simulator
RUN make

# ──────────────────────────────────────────────
# Runtime stage: Python + Klippy + Moonraker
# ──────────────────────────────────────────────
FROM python:3.11-slim-bookworm AS runtime

WORKDIR /app

# Install runtime system deps (socat for PTY, procps for health check,
# build-essential + libffi-dev for cffi wheel compilation)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        libffi-dev \
        libsodium-dev \
        procps \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Klipper simulator binary from build stage
COPY --from=builder /klipper/out/klipper.elf /usr/local/bin/klipper_simulator

# Copy vendored Klipper (needed by Klippy at runtime)
COPY vendor/klipper/ /app/vendor/klipper/

# Copy vendored Moonraker
COPY vendor/moonraker/ /app/vendor/moonraker/

# Install Moonraker dependencies (from pyproject.toml)
RUN pip install --no-cache-dir \
        "tornado>=6.2.0" \
        "pyserial==3.4" \
        "pillow>=9.5.0" \
        "streaming-form-data>=1.11.0" \
        "distro==1.9.0" \
        "inotify-simple==2.0.1" \
        "libnacl==2.1.0" \
        "paho-mqtt==2.1.0" \
        "jinja2==3.1.6" \
        "importlib_metadata>=6.7.0" \
        "preprocess-cancellation==0.2.1"

# Install Klippy dependencies from requirements file
RUN pip install --no-cache-dir -r /app/vendor/klipper/scripts/klippy-requirements.txt

# Additional runtime deps for Klippy (cheetah3 for template rendering, pyyaml for config)
RUN pip install --no-cache-dir \
        cheetah3 \
        pyyaml \
        websockets

# Copy entrypoint and configs
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/printer.cfg /app/printer.cfg
COPY docker/spindle_coolant.cfg /app/spindle_coolant.cfg
COPY docker/moonraker.conf /app/moonraker.conf

# Copy E3CNC macros (referenced by printer.cfg [include])
COPY config/macros/ /app/config/macros/

# Expose Moonraker API port
EXPOSE 7125

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD /entrypoint.sh health

ENTRYPOINT ["/entrypoint.sh"]
CMD ["start"]