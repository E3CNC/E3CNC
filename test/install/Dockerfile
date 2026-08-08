# test/install/Dockerfile
# Multi-arch Docker test for install.sh
# Build: docker build --build-arg DISTRO=ubuntu:22.04 --platform linux/arm64 -t e3cnc-install-test .
# Run:   docker run --rm --privileged e3cnc-install-test

ARG BASE_IMAGE=ubuntu:22.04
FROM ${BASE_IMAGE}

ENV DEBIAN_FRONTEND=noninteractive
ENV E3CNC_DIR=/root/E3CNC

# Install system dependencies
RUN apt-get update && apt-get install -y \
    bash \
    curl \
    git \
    sudo \
    jq \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /root/E3CNC

# Copy repo
COPY . /root/E3CNC/

RUN chmod +x /root/E3CNC/install.sh

# Run install.sh in unattended mode
CMD ["bash", "-c", "cd /root/E3CNC && cat install.sh | head -20 && echo '---' && echo 'Would run: sudo ./install.sh --unattended'"]
