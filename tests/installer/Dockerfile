# syntax=docker/dockerfile:1
# E3CNC Installer Integration Test Container — Debian 12 slim
# Built by the Go test framework (docker_test.go) which copies the
# compiled e3cnc-tui binary into the image.

FROM debian:12-slim

ARG DEBIAN_FRONTEND=noninteractive

# Install system dependencies matching what the bootstrap step installs,
# plus tools needed by tests (python3, ss, jq).
RUN apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    zstd \
    sudo \
    python3 \
    python3-pip \
    python3-venv \
    iproute2 \
    coreutils \
    procps \
    net-tools \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user that mimics the real biqu user on the CNC board.
# Has passwordless sudo so bootstrap steps (apt-get, tee) can run.
ARG USERNAME=testuser
RUN useradd -m -s /bin/bash "${USERNAME}" && \
    echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# The Go binary is baked in at build-time by docker_test.go.
# It goes to /usr/local/bin so it's on PATH for the test user.
ARG E3CNC_BIN=e3cnc-tui
COPY --chown=root:root "${E3CNC_BIN}" /usr/local/bin/e3cnc-tui
RUN chmod 755 /usr/local/bin/e3cnc-tui

# Working directory is the test user's home, where ~/E3CNC and ~/e3cnc
# will be created during tests.
WORKDIR /home/testuser
USER testuser

# Keep the container alive; tests drive it via docker exec.
CMD ["sleep", "infinity"]
